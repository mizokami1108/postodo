import { INoteRepository } from '../../interfaces/data/i-note-repository';
import { IStorageAdapter } from '../../interfaces/storage/i-storage-adapter';
import { StickyNote, CreateNoteOptions, UpdateNoteOptions, Result } from '../../types/core-types';
import { IEventBus } from '../../core/event-bus';
import { SyncError } from '../../utils/error-handler';
import { ObsidianStorageAdapter } from '../storage/obsidian-storage';

export class NoteRepository implements INoteRepository {
    private noteCache = new Map<string, StickyNote>();
    private folderPath: string;
    private fileWatchers = new Map<string, () => void>();
    private syncStatus = new Map<string, 'syncing' | 'synced' | 'error'>();

    constructor(
        private storageAdapter: IStorageAdapter,
        private eventBus: IEventBus,
        folderPath: string = 'Postodo'
    ) {
        this.folderPath = folderPath;
        this.initializeFolder();
    }

    private async initializeFolder(): Promise<void> {
        const result = await this.storageAdapter.createFolder(this.folderPath);
        if (!result.success) {
            console.error('Failed to create Postodo folder:', result.error);
        }
    }

    async save(note: StickyNote): Promise<Result<void>> {
        try {
            const content = this.serializeNote(note);
            const result = await this.storageAdapter.write(note.filePath, content);
            
            if (result.success) {
                this.noteCache.set(note.id, note);
                this.eventBus.emit('note-saved', { note });
            }
            
            return result;
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async findById(id: string): Promise<Result<StickyNote | null>> {
        try {
            // キャッシュから確認
            if (this.noteCache.has(id)) {
                return { success: true, data: this.noteCache.get(id)! };
            }

            // ファイルから読み込み
            const filePath = this.getFilePathFromId(id);
            const result = await this.storageAdapter.read(filePath);
            
            if (!result.success) {
                return { success: true, data: null };
            }

            const note = this.deserializeNote(result.data);
            if (note) {
                this.noteCache.set(id, note);
                return { success: true, data: note };
            }

            return { success: true, data: null };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async findAll(): Promise<Result<StickyNote[]>> {
        try {
            const result = await this.storageAdapter.list(this.folderPath);
            if (!result.success) {
                return { success: false, error: result.error };
            }

            const notes: StickyNote[] = [];
            for (const filePath of result.data) {
                if (filePath.endsWith('.md')) {
                    const fileResult = await this.storageAdapter.read(filePath);
                    if (fileResult.success) {
                        const note = this.deserializeNote(fileResult.data);
                        if (note) {
                            notes.push(note);
                            this.noteCache.set(note.id, note);
                        }
                    }
                }
            }

            return { success: true, data: notes };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async update(id: string, options: UpdateNoteOptions): Promise<Result<StickyNote>> {
        try {
            const noteResult = await this.findById(id);
            if (!noteResult.success) {
                return { success: false, error: noteResult.error };
            }

            if (!noteResult.data) {
                return { success: false, error: new Error(`Note not found: ${id}`) };
            }

            const updatedNote: StickyNote = {
                ...noteResult.data,
                ...options,
                appearance: {
                    ...noteResult.data.appearance,
                    ...options.appearance
                },
                metadata: {
                    ...noteResult.data.metadata,
                    modified: new Date().toISOString()
                }
            };

            const saveResult = await this.save(updatedNote);
            if (!saveResult.success) {
                return { success: false, error: saveResult.error };
            }

            return { success: true, data: updatedNote };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async delete(id: string): Promise<Result<void>> {
        try {
            const filePath = this.getFilePathFromId(id);
            const result = await this.storageAdapter.delete(filePath);
            
            if (result.success) {
                this.noteCache.delete(id);
                this.eventBus.emit('note-deleted', { id });
            }
            
            return result;
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async exists(id: string): Promise<Result<boolean>> {
        try {
            if (this.noteCache.has(id)) {
                return { success: true, data: true };
            }

            const filePath = this.getFilePathFromId(id);
            return await this.storageAdapter.exists(filePath);
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    private getFilePathFromId(id: string): string {
        return `${this.folderPath}/${id}.md`;
    }

    private serializeNote(note: StickyNote): string {
        const frontmatter = {
            id: note.id,
            position: note.position,
            dimensions: note.dimensions,
            appearance: note.appearance,
            metadata: note.metadata
        };

        const yamlContent = Object.entries(frontmatter)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n');

        return `---\n${yamlContent}\n---\n\n${note.content}`;
    }

    private deserializeNote(content: string): StickyNote | null {
        try {
            const match = content.match(/^---\n(.*?)\n---\n\n(.*)$/s);
            if (!match) return null;

            const [, frontmatterText, noteContent] = match;
            const frontmatter: any = {};

            frontmatterText.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(': ');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join(': ');
                    try {
                        frontmatter[key] = JSON.parse(value);
                    } catch {
                        frontmatter[key] = value;
                    }
                }
            });

            return {
                id: frontmatter.id,
                filePath: this.getFilePathFromId(frontmatter.id),
                content: noteContent,
                position: frontmatter.position,
                dimensions: frontmatter.dimensions,
                appearance: frontmatter.appearance,
                metadata: frontmatter.metadata
            };
        } catch (error) {
            console.error('Failed to deserialize note:', error);
            return null;
        }
    }

    private setSyncStatus(noteId: string, status: 'syncing' | 'synced' | 'error'): void {
        this.syncStatus.set(noteId, status);
        this.eventBus.emit('note-sync-status', { noteId, status });
    }

    private setupFileWatcher(noteId: string, filePath: string): void {
        // 既存のウォッチャーを削除
        this.cleanupFileWatcher(noteId);
        
        // ファイル監視機能を使用（存在する場合）
        if (this.storageAdapter.watchFile) {
            const unwatch = this.storageAdapter.watchFile(filePath, () => {
                this.handleFileChange(noteId, filePath);
            });
            this.fileWatchers.set(noteId, unwatch);
        }
    }

    private cleanupFileWatcher(noteId: string): void {
        const unwatch = this.fileWatchers.get(noteId);
        if (unwatch) {
            unwatch();
            this.fileWatchers.delete(noteId);
        }
    }

    private async handleFileChange(noteId: string, filePath: string): Promise<void> {
        try {
            const result = await this.storageAdapter.read(filePath);
            if (result.success) {
                const note = this.deserializeNote(result.data);
                if (note) {
                    const oldNote = this.noteCache.get(noteId);
                    this.noteCache.set(noteId, note);
                    
                    // 外部からの変更を通知
                    this.eventBus.emit('note-externally-modified', { 
                        noteId, 
                        oldNote, 
                        newNote: note 
                    });
                }
            }
        } catch (error) {
            console.error(`Error handling file change for note ${noteId}:`, error);
        }
    }

    private async isNoteUpToDate(note: StickyNote): Promise<boolean> {
        // 簡単な実装：キャッシュされた付箋は常に最新として扱う
        // 実際の実装では、ファイルの最終更新時刻と比較する
        return true;
    }

    getSyncStatus(noteId: string): 'syncing' | 'synced' | 'error' | undefined {
        return this.syncStatus.get(noteId);
    }

    async resyncNote(noteId: string): Promise<Result<StickyNote>> {
        try {
            // キャッシュから削除して再読み込み
            this.noteCache.delete(noteId);
            const result = await this.findById(noteId);
            if (!result.success) {
                return { success: false, error: result.error };
            }
            if (!result.data) {
                return { 
                    success: false, 
                    error: new SyncError(
                        `Note not found: ${noteId}`,
                        noteId,
                        'resync'
                    )
                };
            }
            return { success: true, data: result.data };
        } catch (error) {
            return { 
                success: false, 
                error: new SyncError(
                    `Failed to resync note ${noteId}: ${(error as Error).message}`,
                    noteId,
                    'resync'
                )
            };
        }
    }

    cleanup(): void {
        // ファイルウォッチャーのクリーンアップ
        this.fileWatchers.forEach((unwatch: () => void) => unwatch());
        this.fileWatchers.clear();
        
        // ストレージアダプターのクリーンアップ
        if (this.storageAdapter.cleanup) {
            this.storageAdapter.cleanup();
        }
    }
}