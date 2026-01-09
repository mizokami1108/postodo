import { INoteRepository } from '../../interfaces/data/i-note-repository';
import { IStorageAdapter } from '../../interfaces/storage/i-storage-adapter';
import { StickyNote, CreateNoteOptions, UpdateNoteOptions, Result } from '../../types/core-types';
import { IEventBus } from '../../core/event-bus';
import { SyncError } from '../../utils/error-handler';
import { ObsidianStorageAdapter } from '../storage/obsidian-storage';
import { PostodoNoteDetector } from '../../utils/postodo-note-detector';
import { Vault, TFile } from 'obsidian';

export class NoteRepository implements INoteRepository {
    private noteCache = new Map<string, StickyNote>();
    private fileWatchers = new Map<string, () => void>();
    private syncStatus = new Map<string, 'syncing' | 'synced' | 'error'>();

    constructor(
        private storageAdapter: IStorageAdapter,
        private eventBus: IEventBus,
        private vault?: Vault,
        private configProvider?: any
    ) {}


    async save(note: StickyNote): Promise<Result<void>> {
        try {
            console.log(`[DEBUG] Saving note ${note.id} to ${note.filePath}`);
            await this.ensureFolderExists(note.filePath);
            
            const existingContent = await this.storageAdapter.read(note.filePath);
            const originalContent = existingContent.success ? existingContent.data : '';
            
            const content = PostodoNoteDetector.updateNoteContent(originalContent, note);
            console.log(`[DEBUG] Generated content for ${note.id}:`, content.substring(0, 200));
            
            const result = await this.storageAdapter.write(note.filePath, content);
            
            if (result.success) {
                console.log(`[DEBUG] Successfully saved note ${note.id}`);
                this.noteCache.set(note.id, note);
                this.eventBus.emit('note-saved', { note });
                
                setTimeout(() => {
                    this.setupFileWatcher(note.id, note.filePath);
                }, 100);
            } else {
                console.error(`[DEBUG] Failed to save note ${note.id}:`, result.error);
            }
            
            return result;
        } catch (error) {
            console.error(`[DEBUG] Error saving note ${note.id}:`, error);
            return { success: false, error: error as Error };
        }
    }

    async findById(id: string): Promise<Result<StickyNote | null>> {
        try {
            if (this.noteCache.has(id)) {
                return { success: true, data: this.noteCache.get(id)! };
            }

            if (this.vault) {
                const allFiles = this.vault.getMarkdownFiles();
                for (const file of allFiles) {
                    const content = await this.vault.read(file);
                    const postodoData = PostodoNoteDetector.extractPostodoData(content, file.path);
                    
                    if (postodoData && postodoData.id === id) {
                        const note = PostodoNoteDetector.toStickyNote(postodoData, file.path);
                        this.noteCache.set(id, note);
                        this.setupFileWatcher(note.id, note.filePath);
                        return { success: true, data: note };
                    }
                }
            }

            return { success: true, data: null };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async findAll(): Promise<Result<StickyNote[]>> {
        try {
            console.log(`[DEBUG] Finding all postodo notes...`);
            const notes: StickyNote[] = [];

            if (this.vault) {
                const allFiles = this.vault.getMarkdownFiles();
                // 設定からPostodoフォルダを取得
                let postodoFolder = 'Postodo';
                try {
                    if (this.configProvider) {
                        postodoFolder = this.configProvider.get('postodoFolder') || 'Postodo';
                    }
                } catch (error) {
                    console.warn('Failed to get postodoFolder from config, using default:', error);
                }
                
                // Postodoフォルダのファイルのみをフィルタリング
                const postodoFiles = allFiles.filter(file => file.path.startsWith(postodoFolder + '/'));
                
                console.log(`[DEBUG] Scanning ${postodoFiles.length} files in ${postodoFolder} folder (filtered from ${allFiles.length} total files)`);
                
                for (const file of postodoFiles) {
                    try {
                        const content = await this.vault.read(file);
                        const postodoData = PostodoNoteDetector.extractPostodoData(content, file.path);
                        
                        if (postodoData) {
                            console.log(`[DEBUG] Found postodo note in ${file.path}:`, postodoData.id);
                            const note = PostodoNoteDetector.toStickyNote(postodoData, file.path);
                            notes.push(note);
                            this.noteCache.set(note.id, note);
                            this.setupFileWatcher(note.id, file.path);
                        }
                    } catch (error) {
                        console.warn(`Failed to process file ${file.path}:`, error);
                    }
                }
            }

            console.log(`[DEBUG] Found ${notes.length} postodo notes`);
            return { success: true, data: notes };
        } catch (error) {
            console.error(`[DEBUG] Error in findAll:`, error);
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
            const noteResult = await this.findById(id);
            if (!noteResult.success || !noteResult.data) {
                return { success: false, error: new Error(`Note not found: ${id}`) };
            }
            
            const result = await this.storageAdapter.delete(noteResult.data.filePath);
            
            if (result.success) {
                this.noteCache.delete(id);
                this.cleanupFileWatcher(id);
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

            const findResult = await this.findById(id);
            if (findResult.success) {
                return { success: true, data: findResult.data !== null };
            }
            
            return { success: false, error: findResult.error };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async rename(id: string, newTitle: string): Promise<Result<StickyNote>> {
        try {
            console.log(`[DEBUG] Renaming note ${id} to title: ${newTitle}`);
            
            // 既存のノートを取得
            const noteResult = await this.findById(id);
            if (!noteResult.success) {
                return { success: false, error: noteResult.error };
            }

            if (!noteResult.data) {
                return { success: false, error: new Error(`Note not found: ${id}`) };
            }

            const note = noteResult.data;
            const oldFilePath = note.filePath;
            
            // 新しいファイル名を生成（タイトルをサニタイズ）
            const sanitizedTitle = this.sanitizeFileName(newTitle);
            const folderPath = oldFilePath.substring(0, oldFilePath.lastIndexOf('/'));
            const newFilePath = `${folderPath}/${sanitizedTitle}.md`;
            
            console.log(`[DEBUG] Renaming file from ${oldFilePath} to ${newFilePath}`);
            
            // ファイルパスが同じ場合はタイトルのみ更新
            if (oldFilePath === newFilePath) {
                const updatedNote: StickyNote = {
                    ...note,
                    title: newTitle,
                    metadata: {
                        ...note.metadata,
                        modified: new Date().toISOString()
                    }
                };
                
                const saveResult = await this.save(updatedNote);
                if (!saveResult.success) {
                    return { success: false, error: saveResult.error };
                }
                
                return { success: true, data: updatedNote };
            }
            
            // ファイルウォッチャーをクリーンアップ
            this.cleanupFileWatcher(id);
            
            // ストレージアダプターにrenameメソッドがある場合は使用
            if (this.storageAdapter.rename) {
                const renameResult = await this.storageAdapter.rename(oldFilePath, newFilePath);
                if (!renameResult.success) {
                    // リネームに失敗した場合、ファイルウォッチャーを再設定
                    this.setupFileWatcher(id, oldFilePath);
                    return { success: false, error: renameResult.error };
                }
            } else {
                // renameメソッドがない場合は、読み取り→書き込み→削除で対応
                const readResult = await this.storageAdapter.read(oldFilePath);
                if (!readResult.success) {
                    this.setupFileWatcher(id, oldFilePath);
                    return { success: false, error: readResult.error };
                }
                
                const writeResult = await this.storageAdapter.write(newFilePath, readResult.data);
                if (!writeResult.success) {
                    this.setupFileWatcher(id, oldFilePath);
                    return { success: false, error: writeResult.error };
                }
                
                const deleteResult = await this.storageAdapter.delete(oldFilePath);
                if (!deleteResult.success) {
                    // 新しいファイルを削除してロールバック
                    await this.storageAdapter.delete(newFilePath);
                    this.setupFileWatcher(id, oldFilePath);
                    return { success: false, error: deleteResult.error };
                }
            }
            
            // 更新されたノートを作成
            const updatedNote: StickyNote = {
                ...note,
                filePath: newFilePath,
                title: newTitle,
                metadata: {
                    ...note.metadata,
                    modified: new Date().toISOString()
                }
            };
            
            // キャッシュを更新
            this.noteCache.set(id, updatedNote);
            
            // 新しいファイルパスでファイルウォッチャーを設定
            this.setupFileWatcher(id, newFilePath);
            
            // ファイル内容を更新（タイトルを反映）
            const saveResult = await this.save(updatedNote);
            if (!saveResult.success) {
                console.warn(`[DEBUG] Failed to save updated note content after rename:`, saveResult.error);
            }
            
            // イベントを発火
            this.eventBus.emit('note-renamed', { 
                noteId: id, 
                oldFilePath, 
                newFilePath, 
                oldTitle: note.title,
                newTitle 
            });
            
            console.log(`[DEBUG] Successfully renamed note ${id}`);
            return { success: true, data: updatedNote };
        } catch (error) {
            console.error(`[DEBUG] Error renaming note ${id}:`, error);
            return { success: false, error: error as Error };
        }
    }

    /**
     * ファイル名として使用できるようにタイトルをサニタイズする
     */
    private sanitizeFileName(title: string): string {
        if (!title || title.trim() === '') {
            return `Sticky-${Date.now()}`;
        }
        
        // ファイル名として使用できない文字を置換
        return title
            .trim()
            .replace(/[\\/:*?"<>|]/g, '-')  // Windows/Unix で使用できない文字
            .replace(/\s+/g, ' ')            // 連続する空白を単一の空白に
            .substring(0, 100);              // 長すぎるファイル名を制限
    }


    private setSyncStatus(noteId: string, status: 'syncing' | 'synced' | 'error'): void {
        this.syncStatus.set(noteId, status);
        this.eventBus.emit('note-sync-status', { noteId, status });
    }

    private setupFileWatcher(noteId: string, filePath: string): void {
        console.log(`[DEBUG] Setting up file watcher for ${noteId} at ${filePath}`);
        this.cleanupFileWatcher(noteId);
        
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
            // ファイル作成直後の空のファイル読み込みを空くために少し遅延
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const result = await this.storageAdapter.read(filePath);
            if (result.success) {
                console.log(`File change detected for ${noteId}, reading content...`);
                const postodoData = PostodoNoteDetector.extractPostodoData(result.data, filePath);
                
                if (postodoData && postodoData.id === noteId) {
                    const note = PostodoNoteDetector.toStickyNote(postodoData, filePath);
                    const oldNote = this.noteCache.get(noteId);
                    
                    if (!oldNote || oldNote.completed !== note.completed || oldNote.content !== note.content) {
                        console.log(`File change detected: ${noteId}, completed: ${oldNote?.completed} -> ${note.completed}`);
                        this.noteCache.set(noteId, note);
                        
                        this.eventBus.emit('note-externally-modified', { 
                            noteId, 
                            oldNote, 
                            newNote: note 
                        });
                        
                        this.eventBus.emit('note-updated', { note, changes: {} });
                    }
                } else if (this.noteCache.has(noteId)) {
                    // ファイル作成直後の空のファイルの場合、削除しない
                    if (result.data.trim().length > 0) {
                        console.log(`Postodo data removed from note ${noteId} - content preview:`, result.data.substring(0, 200));
                        this.noteCache.delete(noteId);
                        this.eventBus.emit('note-deleted', { id: noteId });
                    }
                }
            }
        } catch (error) {
            console.error(`Error handling file change for note ${noteId}:`, error);
        }
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

    private async ensureFolderExists(filePath: string): Promise<void> {
        if (!this.vault) {
            return;
        }
        
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (folderPath) {
            try {
                const folder = this.vault.getAbstractFileByPath(folderPath);
                if (!folder) {
                    await this.vault.createFolder(folderPath);
                }
            } catch (error) {
                // フォルダが存在しない場合、作成を試行
                try {
                    await this.vault.createFolder(folderPath);
                } catch (createError) {
                    console.warn(`Failed to create folder ${folderPath}:`, createError);
                }
            }
        }
    }

    cleanup(): void {
        this.fileWatchers.forEach((unwatch) => {
            if (typeof unwatch === 'function') {
                unwatch();
            }
        });
        this.fileWatchers.clear();
        
        if (this.storageAdapter.cleanup) {
            this.storageAdapter.cleanup();
        }
    }
}