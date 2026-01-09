import { StickyNote, Result } from '../../types/core-types';
import { ISyncManager, SyncStatus, SyncResult } from '../../interfaces/sync/i-sync-manager';
import { IConflictResolver } from '../../interfaces/sync/i-conflict-resolver';
import { INoteRepository } from '../../interfaces/data/i-note-repository';
import { IEventBus } from '../../core/event-bus';

/**
 * リトライ設定
 * Requirements: 7.4
 */
export interface RetryConfig {
    /** 最大リトライ回数 */
    maxRetries: number;
    /** 初期遅延時間（ミリ秒） */
    initialDelayMs: number;
    /** バックオフ倍率 */
    backoffMultiplier: number;
}

/**
 * リトライ結果
 */
export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
}

/**
 * 指数バックオフでリトライを実行する
 * Requirements: 7.4
 * 
 * @param operation 実行する非同期操作
 * @param config リトライ設定
 * @returns リトライ結果
 */
export async function executeWithRetry<T>(
    operation: () => Promise<Result<T>>,
    config: RetryConfig
): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    let attempts = 0;
    
    for (let i = 0; i <= config.maxRetries; i++) {
        attempts = i + 1;
        
        try {
            const result = await operation();
            
            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    attempts
                };
            }
            
            lastError = result.error;
            
            // 最後の試行でなければ、指数バックオフで待機
            if (i < config.maxRetries) {
                const delayMs = config.initialDelayMs * Math.pow(config.backoffMultiplier, i);
                await sleep(delayMs);
            }
        } catch (error) {
            lastError = error as Error;
            
            // 最後の試行でなければ、指数バックオフで待機
            if (i < config.maxRetries) {
                const delayMs = config.initialDelayMs * Math.pow(config.backoffMultiplier, i);
                await sleep(delayMs);
            }
        }
    }
    
    return {
        success: false,
        error: lastError,
        attempts
    };
}

/**
 * 指定時間待機する
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 同期マネージャー実装
 * UIとファイル間のデータ同期を管理し、競合を解決する
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export class SyncManager implements ISyncManager {
    private editingNotes = new Set<string>();
    private status: SyncStatus = 'idle';
    private isWatching = false;
    private pendingSyncs = new Map<string, NodeJS.Timeout>();
    private readonly DEBOUNCE_MS = 500;
    
    /** デフォルトのリトライ設定: 1秒、2秒、4秒の間隔で最大3回 */
    private readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2
    };

    constructor(
        private noteRepository: INoteRepository,
        private conflictResolver: IConflictResolver,
        private eventBus: IEventBus,
        retryConfig?: Partial<RetryConfig>
    ) {
        if (retryConfig) {
            this.DEFAULT_RETRY_CONFIG = {
                ...this.DEFAULT_RETRY_CONFIG,
                ...retryConfig
            };
        }
    }

    /**
     * リトライ設定を取得する
     */
    getRetryConfig(): RetryConfig {
        return { ...this.DEFAULT_RETRY_CONFIG };
    }

    /**
     * 付箋をファイルに即座に同期する（デバウンスなし、リトライ機能付き）
     * Requirements: 7.4
     */
    async syncNoteToFileImmediate(note: StickyNote): Promise<Result<void>> {
        this.setStatus('syncing');

        const retryResult = await executeWithRetry(
            () => this.noteRepository.save(note),
            this.DEFAULT_RETRY_CONFIG
        );

        if (retryResult.success) {
            this.setStatus('saved');
            this.eventBus.emit('note-synced-to-file', { note });
            
            if (retryResult.attempts > 1) {
                this.eventBus.emit('sync-retry-succeeded', {
                    noteId: note.id,
                    attempts: retryResult.attempts
                });
            }
            
            return { success: true, data: undefined };
        } else {
            this.setStatus('error');
            this.eventBus.emit('sync-retry-failed', {
                noteId: note.id,
                attempts: retryResult.attempts,
                error: retryResult.error?.message
            });
            return { success: false, error: retryResult.error || new Error('Sync failed after retries') };
        }
    }

    /**
     * ファイル監視を開始する
     */
    startWatching(): void {
        if (this.isWatching) {
            return;
        }
        this.isWatching = true;
        this.eventBus.emit('sync-watching-started', {});
    }

    /**
     * ファイル監視を停止する
     */
    stopWatching(): void {
        if (!this.isWatching) {
            return;
        }
        this.isWatching = false;
        
        // 保留中の同期をキャンセル
        this.pendingSyncs.forEach(timeout => clearTimeout(timeout));
        this.pendingSyncs.clear();
        
        this.eventBus.emit('sync-watching-stopped', {});
    }

    /**
     * 付箋をファイルに同期する（デバウンス付き、リトライ機能付き）
     * Requirements: 7.1, 7.4
     */
    async syncNoteToFile(note: StickyNote): Promise<Result<void>> {
        // 既存の保留中の同期をキャンセル
        const existingTimeout = this.pendingSyncs.get(note.id);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(async () => {
                this.pendingSyncs.delete(note.id);
                this.setStatus('syncing');

                // 指数バックオフリトライを使用して保存を実行
                const retryResult = await executeWithRetry(
                    () => this.noteRepository.save(note),
                    this.DEFAULT_RETRY_CONFIG
                );

                if (retryResult.success) {
                    this.setStatus('saved');
                    this.eventBus.emit('note-synced-to-file', { note });
                    
                    if (retryResult.attempts > 1) {
                        this.eventBus.emit('sync-retry-succeeded', {
                            noteId: note.id,
                            attempts: retryResult.attempts
                        });
                    }
                    
                    resolve({ success: true, data: undefined });
                } else {
                    this.setStatus('error');
                    this.eventBus.emit('sync-retry-failed', {
                        noteId: note.id,
                        attempts: retryResult.attempts,
                        error: retryResult.error?.message
                    });
                    resolve({ success: false, error: retryResult.error || new Error('Sync failed after retries') });
                }
            }, this.DEBOUNCE_MS);

            this.pendingSyncs.set(note.id, timeout);
        });
    }

    /**
     * ファイルから付箋を同期する
     * Requirements: 7.2
     */
    async syncFileToNote(filePath: string): Promise<Result<StickyNote>> {
        this.setStatus('syncing');

        try {
            // ファイルパスからIDを抽出（実際の実装ではリポジトリから取得）
            const allNotesResult = await this.noteRepository.findAll();
            
            if (!allNotesResult.success) {
                this.setStatus('error');
                return { success: false, error: allNotesResult.error };
            }

            const note = allNotesResult.data.find(n => n.filePath === filePath);
            
            if (!note) {
                this.setStatus('error');
                return { 
                    success: false, 
                    error: new Error(`Note not found for file path: ${filePath}`) 
                };
            }

            this.setStatus('saved');
            this.eventBus.emit('note-synced-from-file', { note });
            
            return { success: true, data: note };
        } catch (error) {
            this.setStatus('error');
            return { success: false, error: error as Error };
        }
    }

    /**
     * 付箋が編集中かどうかを確認する
     */
    isNoteBeingEdited(noteId: string): boolean {
        return this.editingNotes.has(noteId);
    }

    /**
     * 付箋を編集中としてマークする
     */
    markNoteAsEditing(noteId: string): void {
        this.editingNotes.add(noteId);
    }

    /**
     * 付箋の編集中マークを解除する
     */
    unmarkNoteAsEditing(noteId: string): void {
        this.editingNotes.delete(noteId);
    }

    /**
     * 競合を検出して解決する（リトライ機能付き）
     * Requirements: 7.3, 7.4
     */
    async resolveAndSync(fileNote: StickyNote, uiNote: StickyNote): Promise<SyncResult> {
        this.setStatus('syncing');

        try {
            // 競合を検出
            const conflictDetection = this.conflictResolver.detectAllConflicts(fileNote, uiNote);

            if (!conflictDetection.hasConflict) {
                // 競合なし - UIの状態をファイルに同期（リトライ付き）
                const retryResult = await executeWithRetry(
                    () => this.noteRepository.save(uiNote),
                    this.DEFAULT_RETRY_CONFIG
                );
                
                if (retryResult.success) {
                    this.setStatus('saved');
                    
                    if (retryResult.attempts > 1) {
                        this.eventBus.emit('sync-retry-succeeded', {
                            noteId: uiNote.id,
                            attempts: retryResult.attempts
                        });
                    }
                    
                    return {
                        success: true,
                        note: uiNote,
                        hadConflict: false
                    };
                } else {
                    this.setStatus('error');
                    this.eventBus.emit('sync-retry-failed', {
                        noteId: uiNote.id,
                        attempts: retryResult.attempts,
                        error: retryResult.error?.message
                    });
                    return {
                        success: false,
                        hadConflict: false,
                        error: retryResult.error?.message || 'Save failed after retries'
                    };
                }
            }

            // 競合あり - 解決を試みる
            const resolution = await this.conflictResolver.resolveAllConflicts(fileNote, uiNote);

            if (resolution.success) {
                // 解決結果をファイルに保存（リトライ付き）
                const retryResult = await executeWithRetry(
                    () => this.noteRepository.save(resolution.result),
                    this.DEFAULT_RETRY_CONFIG
                );
                
                if (retryResult.success) {
                    this.setStatus('saved');
                    this.eventBus.emit('conflict-resolved', {
                        noteId: uiNote.id,
                        conflictTypes: conflictDetection.conflictTypes,
                        strategy: resolution.strategy
                    });
                    
                    if (retryResult.attempts > 1) {
                        this.eventBus.emit('sync-retry-succeeded', {
                            noteId: uiNote.id,
                            attempts: retryResult.attempts
                        });
                    }
                    
                    return {
                        success: true,
                        note: resolution.result,
                        hadConflict: true
                    };
                } else {
                    this.setStatus('error');
                    this.eventBus.emit('sync-retry-failed', {
                        noteId: uiNote.id,
                        attempts: retryResult.attempts,
                        error: retryResult.error?.message
                    });
                    return {
                        success: false,
                        hadConflict: true,
                        error: retryResult.error?.message || 'Save failed after retries'
                    };
                }
            } else {
                this.setStatus('error');
                return {
                    success: false,
                    hadConflict: true,
                    error: 'Failed to resolve conflict'
                };
            }
        } catch (error) {
            this.setStatus('error');
            return {
                success: false,
                hadConflict: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 現在の同期ステータスを取得する
     */
    getStatus(): SyncStatus {
        return this.status;
    }

    /**
     * リソースをクリーンアップする
     */
    cleanup(): void {
        this.stopWatching();
        this.editingNotes.clear();
        this.status = 'idle';
    }

    /**
     * ステータスを設定してイベントを発火する
     */
    private setStatus(status: SyncStatus): void {
        const previousStatus = this.status;
        this.status = status;
        
        if (previousStatus !== status) {
            this.eventBus.emit('sync-status-changed', { 
                previousStatus, 
                currentStatus: status 
            });
        }
    }
}
