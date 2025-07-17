import { IDataManager } from '../../interfaces/data/i-data-manager';
import { INoteRepository } from '../../interfaces/data/i-note-repository';
import { StickyNote, CreateNoteOptions, UpdateNoteOptions, Result } from '../../types/core-types';
import { IEventBus } from '../../core/event-bus';
import { NoteValidator } from '../../utils/validators';
import { ErrorHandler, ValidationError } from '../../utils/error-handler';

export class DataManager implements IDataManager {
    private editingNotes = new Set<string>();
    private errorHandler: ErrorHandler;
    private configWatchers: (() => void)[] = [];

    constructor(
        private noteRepository: INoteRepository,
        private eventBus: IEventBus
    ) {
        this.errorHandler = ErrorHandler.getInstance(eventBus);
        this.setupConfigWatchers();
    }

    async createNote(options: CreateNoteOptions): Promise<Result<StickyNote>> {
        try {
            // バリデーション
            const validation = NoteValidator.validateCreateNoteOptions(options);
            if (!validation.valid) {
                const validationError = new ValidationError(
                    validation.error!,
                    'createNoteOptions',
                    options
                );
                this.errorHandler.handleError(validationError, {
                    component: 'DataManager',
                    action: 'createNote'
                });
                return { success: false, error: validationError };
            }

            const note = this.buildNote(options);
            const result = await this.noteRepository.save(note);
            
            if (result.success) {
                this.eventBus.emit('note-created', { note });
                return { success: true, data: note };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            this.errorHandler.handleError(error as Error, {
                component: 'DataManager',
                action: 'createNote'
            });
            return { success: false, error: error as Error };
        }
    }

    async updateNote(id: string, options: UpdateNoteOptions): Promise<Result<StickyNote>> {
        try {
            // IDのバリデーション
            const idValidation = NoteValidator.validateNoteId(id);
            if (!idValidation.valid) {
                const validationError = new ValidationError(
                    idValidation.error!,
                    'noteId',
                    id
                );
                this.errorHandler.handleError(validationError, {
                    component: 'DataManager',
                    action: 'updateNote',
                    noteId: id
                });
                return { success: false, error: validationError };
            }

            // コンテンツのバリデーション（指定されている場合）
            if (options.content !== undefined) {
                const contentValidation = NoteValidator.validateContent(options.content);
                if (!contentValidation.valid) {
                    const validationError = new ValidationError(
                        contentValidation.error!,
                        'content',
                        options.content
                    );
                    this.errorHandler.handleError(validationError, {
                        component: 'DataManager',
                        action: 'updateNote',
                        noteId: id
                    });
                    return { success: false, error: validationError };
                }
            }

            // 位置のバリデーション（指定されている場合）
            if (options.position) {
                const positionValidation = NoteValidator.validatePosition(options.position);
                if (!positionValidation.valid) {
                    const validationError = new ValidationError(
                        positionValidation.error!,
                        'position',
                        options.position
                    );
                    this.errorHandler.handleError(validationError, {
                        component: 'DataManager',
                        action: 'updateNote',
                        noteId: id
                    });
                    return { success: false, error: validationError };
                }
            }

            const result = await this.noteRepository.update(id, options);
            
            if (result.success) {
                this.eventBus.emit('note-updated', { note: result.data, changes: options });
                return result;
            }
            
            return result;
        } catch (error) {
            this.errorHandler.handleError(error as Error, {
                component: 'DataManager',
                action: 'updateNote',
                noteId: id
            });
            return { success: false, error: error as Error };
        }
    }

    async deleteNote(id: string): Promise<Result<void>> {
        try {
            // IDのバリデーション
            const idValidation = NoteValidator.validateNoteId(id);
            if (!idValidation.valid) {
                const validationError = new ValidationError(
                    idValidation.error!,
                    'noteId',
                    id
                );
                this.errorHandler.handleError(validationError, {
                    component: 'DataManager',
                    action: 'deleteNote',
                    noteId: id
                });
                return { success: false, error: validationError };
            }

            const result = await this.noteRepository.delete(id);
            
            if (result.success) {
                this.editingNotes.delete(id);
                this.eventBus.emit('note-deleted', { id });
            }
            
            return result;
        } catch (error) {
            this.errorHandler.handleError(error as Error, {
                component: 'DataManager',
                action: 'deleteNote',
                noteId: id
            });
            return { success: false, error: error as Error };
        }
    }

    async getNote(id: string): Promise<Result<StickyNote | null>> {
        try {
            // IDのバリデーション
            const idValidation = NoteValidator.validateNoteId(id);
            if (!idValidation.valid) {
                const validationError = new ValidationError(
                    idValidation.error!,
                    'noteId',
                    id
                );
                this.errorHandler.handleError(validationError, {
                    component: 'DataManager',
                    action: 'getNote',
                    noteId: id
                });
                return { success: false, error: validationError };
            }

            return await this.noteRepository.findById(id);
        } catch (error) {
            this.errorHandler.handleError(error as Error, {
                component: 'DataManager',
                action: 'getNote',
                noteId: id
            });
            return { success: false, error: error as Error };
        }
    }

    async getAllNotes(): Promise<Result<StickyNote[]>> {
        try {
            return await this.noteRepository.findAll();
        } catch (error) {
            this.errorHandler.handleError(error as Error, {
                component: 'DataManager',
                action: 'getAllNotes'
            });
            return { success: false, error: error as Error };
        }
    }

    isNoteBeingEdited(id: string): boolean {
        return this.editingNotes.has(id);
    }

    setNoteEditing(id: string, editing: boolean): void {
        if (editing) {
            this.editingNotes.add(id);
        } else {
            this.editingNotes.delete(id);
        }
    }

    onNoteCreated(callback: (note: StickyNote) => void): () => void {
        return this.eventBus.on('note-created', (event) => {
            callback(event.note);
        });
    }

    onNoteUpdated(callback: (note: StickyNote) => void): () => void {
        return this.eventBus.on('note-updated', (event) => {
            callback(event.note);
        });
    }

    onNoteDeleted(callback: (id: string) => void): () => void {
        return this.eventBus.on('note-deleted', (event) => {
            callback(event.id);
        });
    }

    private buildNote(options: CreateNoteOptions): StickyNote {
        const now = new Date().toISOString();
        const id = this.generateId();
        
        return {
            id,
            filePath: `Postodo/${id}.md`,
            content: options.content,
            position: options.position || { x: 100, y: 100, zIndex: 1 },
            dimensions: options.dimensions || { width: 200, height: 180 },
            appearance: {
                color: options.appearance?.color || 'yellow',
                size: options.appearance?.size || 'medium',
                rotation: options.appearance?.rotation || 0
            },
            metadata: {
                created: now,
                modified: now,
                tags: [],
                links: [],
                attachments: []
            }
        };
    }

    private generateId(): string {
        return 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    private setupConfigWatchers(): void {
        // 設定変更の監視はプラグインの初期化時に設定される
        // ここでは将来的な拡張のための準備
        this.eventBus.on('config-changed', (event) => {
            this.handleConfigChange(event.path, event.value);
        });
    }

    private handleConfigChange(path: string, value: any): void {
        // 設定変更に応じた処理
        switch (path) {
            case 'core.maxNotes':
                this.eventBus.emit('max-notes-changed', { maxNotes: value });
                break;
            case 'core.saveInterval':
                this.eventBus.emit('save-interval-changed', { saveInterval: value });
                break;
            case 'rendering.maxRenderedNotes':
                this.eventBus.emit('max-rendered-notes-changed', { maxRenderedNotes: value });
                break;
        }
    }

    cleanup(): void {
        // 設定ウォッチャーのクリーンアップ
        this.configWatchers.forEach(unwatch => unwatch());
        this.configWatchers = [];
    }
}