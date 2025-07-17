import { StickyNote, CreateNoteOptions, UpdateNoteOptions, Result } from '../../types/core-types';

export interface IDataManager {
    createNote(options: CreateNoteOptions): Promise<Result<StickyNote>>;
    updateNote(id: string, options: UpdateNoteOptions): Promise<Result<StickyNote>>;
    deleteNote(id: string): Promise<Result<void>>;
    getNote(id: string): Promise<Result<StickyNote | null>>;
    getAllNotes(): Promise<Result<StickyNote[]>>;
    isNoteBeingEdited(id: string): boolean;
    
    // イベント
    onNoteCreated(callback: (note: StickyNote) => void): () => void;
    onNoteUpdated(callback: (note: StickyNote) => void): () => void;
    onNoteDeleted(callback: (id: string) => void): () => void;
}