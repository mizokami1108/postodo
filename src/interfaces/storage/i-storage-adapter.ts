import { Result } from '../../types/core-types';

export interface IStorageAdapter {
    read(filePath: string): Promise<Result<string>>;
    write(filePath: string, content: string): Promise<Result<void>>;
    delete(filePath: string): Promise<Result<void>>;
    exists(filePath: string): Promise<Result<boolean>>;
    list(folderPath: string): Promise<Result<string[]>>;
    createFolder(folderPath: string): Promise<Result<void>>;
    rename?(oldPath: string, newPath: string): Promise<Result<void>>;
    watchFile?(filePath: string, callback: () => void): () => void;
    cleanup?(): void;
}