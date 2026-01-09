import { StickyNote, CreateNoteOptions, UpdateNoteOptions, Result } from '../../types/core-types';
import { DisplayFilterType } from '../../types/config-types';
import { IDisplayFilter } from '../ui/i-display-filter';

export interface IDataManager {
    createNote(options: CreateNoteOptions): Promise<Result<StickyNote>>;
    updateNote(id: string, options: UpdateNoteOptions): Promise<Result<StickyNote>>;
    deleteNote(id: string): Promise<Result<void>>;
    getNote(id: string): Promise<Result<StickyNote | null>>;
    getAllNotes(): Promise<Result<StickyNote[]>>;
    getFilteredNotes(filter: IDisplayFilter): Promise<Result<StickyNote[]>>;
    getNotesByCompletionStatus(filterType: DisplayFilterType): Promise<Result<StickyNote[]>>;
    isNoteBeingEdited(id: string): boolean;
    
    // イベント
    onNoteCreated(callback: (note: StickyNote) => void): () => void;
    onNoteUpdated(callback: (note: StickyNote) => void): () => void;
    onNoteDeleted(callback: (id: string) => void): () => void;
}