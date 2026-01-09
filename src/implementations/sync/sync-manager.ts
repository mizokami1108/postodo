import { StickyNote, Result } from '../../types/core-types';
import { ISyncManager, SyncStatus, SyncResult } from '../../interfaces/sync/i-sync-manager';
import { IConflictResolver } from '../../interfaces/sync/i-conflict-resolver';
import { INoteRepository } from '../../interfaces/data/i-note-repository';
import { IEventBus } from '../../core/event-bus';

/**
 * 同期マネージャー実装
 * UIとファイル間のデータ同期を管理し、競合を解決する
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
export class SyncManager implements ISyncManager {
    private editingNotes = new Set<string>();
    private status: SyncStatus = 'idle';
    private isWatching = false;
    private pendingSyncs = new Map<string, NodeJS.Timeout>();
    private readonly DEBOUNCE_MS = 500;

    constructor(
        private noteRepository: INoteRepository,
        private conflictResolver: IConflictResolver,
        private eventBus: IEventBus
    ) {}

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
     * 付箋をファイルに同期する（デバウンス付き）
     * Requirements: 7.1
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

                try {
                    const result = await this.noteRepository.save(note);
                    
                    if (result.success) {
                        this.setStatus('saved');
                        this.eventBus.emit('note-synced-to-file', { note });
                        resolve({ success: true, data: undefined });
                    } else {
                        this.setStatus('error');
                        resolve(result);
                    }
                } catch (error) {
                    this.setStatus('error');
                    resolve({ success: false, error: error as Error });
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
     * 競合を検出して解決する
     * Requirements: 7.3
     */
    async resolveAndSync(fileNote: StickyNote, uiNote: StickyNote): Promise<SyncResult> {
        this.setStatus('syncing');

        try {
            // 競合を検出
            const conflictDetection = this.conflictResolver.detectAllConflicts(fileNote, uiNote);

            if (!conflictDetection.hasConflict) {
                // 競合なし - UIの状態をファイルに同期
                const saveResult = await this.noteRepository.save(uiNote);
                
                if (saveResult.success) {
                    this.setStatus('saved');
                    return {
                        success: true,
                        note: uiNote,
                        hadConflict: false
                    };
                } else {
                    this.setStatus('error');
                    return {
                        success: false,
                        hadConflict: false,
                        error: saveResult.error.message
                    };
                }
            }

            // 競合あり - 解決を試みる
            const resolution = await this.conflictResolver.resolveAllConflicts(fileNote, uiNote);

            if (resolution.success) {
                // 解決結果をファイルに保存
                const saveResult = await this.noteRepository.save(resolution.result);
                
                if (saveResult.success) {
                    this.setStatus('saved');
                    this.eventBus.emit('conflict-resolved', {
                        noteId: uiNote.id,
                        conflictTypes: conflictDetection.conflictTypes,
                        strategy: resolution.strategy
                    });
                    
                    return {
                        success: true,
                        note: resolution.result,
                        hadConflict: true
                    };
                } else {
                    this.setStatus('error');
                    return {
                        success: false,
                        hadConflict: true,
                        error: saveResult.error.message
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
