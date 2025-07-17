import { IDataManager } from '../../interfaces/data/i-data-manager';
import { INoteRepository } from '../../interfaces/data/i-note-repository';
import { StickyNote, CreateNoteOptions, UpdateNoteOptions, Result } from '../../types/core-types';
import { IEventBus } from '../../core/event-bus';

export class DataManager implements IDataManager {
    private editingNotes = new Set<string>();

    constructor(
        private noteRepository: INoteRepository,
        private eventBus: IEventBus
    ) {}

    async createNote(options: CreateNoteOptions): Promise<Result<StickyNote>> {
        try {
            const note = this.buildNote(options);
            const result = await this.noteRepository.save(note);
            
            if (result.success) {
                this.eventBus.emit('note-created', { note });
                return { success: true, data: note };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async updateNote(id: string, options: UpdateNoteOptions): Promise<Result<StickyNote>> {
        try {
            const result = await this.noteRepository.update(id, options);
            
            if (result.success) {
                this.eventBus.emit('note-updated', { note: result.data, changes: options });
                return result;
            }
            
            return result;
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async deleteNote(id: string): Promise<Result<void>> {
        try {
            const result = await this.noteRepository.delete(id);
            
            if (result.success) {
                this.editingNotes.delete(id);
                this.eventBus.emit('note-deleted', { id });
            }
            
            return result;
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async getNote(id: string): Promise<Result<StickyNote | null>> {
        return await this.noteRepository.findById(id);
    }

    async getAllNotes(): Promise<Result<StickyNote[]>> {
        return await this.noteRepository.findAll();
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
}