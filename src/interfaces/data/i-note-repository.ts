import { StickyNote, CreateNoteOptions, UpdateNoteOptions, Result } from '../../types/core-types';

export interface INoteRepository {
    save(note: StickyNote): Promise<Result<void>>;
    findById(id: string): Promise<Result<StickyNote | null>>;
    findAll(): Promise<Result<StickyNote[]>>;
    update(id: string, options: UpdateNoteOptions): Promise<Result<StickyNote>>;
    delete(id: string): Promise<Result<void>>;
    exists(id: string): Promise<Result<boolean>>;
}