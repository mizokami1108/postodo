import { Vault, TFile, TFolder } from 'obsidian';
import { IStorageAdapter } from '../../interfaces/storage/i-storage-adapter';
import { Result } from '../../types/core-types';
import { FileOperationError } from '../../utils/error-handler';
import { FileValidator } from '../../utils/validators';

export class ObsidianStorageAdapter implements IStorageAdapter {
    private operationQueue = new Map<string, Promise<any>>();
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1秒

    constructor(private vault: Vault) {}

    async read(filePath: string): Promise<Result<string>> {
        // ファイルパスのバリデーション
        const pathValidation = FileValidator.validateFilePath(filePath);
        if (!pathValidation.valid) {
            return { 
                success: false, 
                error: new FileOperationError(pathValidation.error!, filePath, 'read')
            };
        }

        return this.withRetry(async () => {
            const file = this.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                throw new FileOperationError(`File not found: ${filePath}`, filePath, 'read');
            }
            
            const content = await this.vault.read(file);
            return { success: true, data: content };
        }, 'read', filePath);
    }

    async write(filePath: string, content: string): Promise<Result<void>> {
        // ファイルパスのバリデーション
        const pathValidation = FileValidator.validateFilePath(filePath);
        if (!pathValidation.valid) {
            return { 
                success: false, 
                error: new FileOperationError(pathValidation.error!, filePath, 'write')
            };
        }

        // 同じファイルへの同時書き込みを防ぐためのキューイング
        if (this.operationQueue.has(filePath)) {
            await this.operationQueue.get(filePath);
        }

        const operation = this.withRetry(async () => {
            const file = this.vault.getAbstractFileByPath(filePath);
            
            if (file && file instanceof TFile) {
                // 既存ファイルの更新
                await this.vault.modify(file, content);
            } else {
                // 新規ファイルの作成（フォルダも作成）
                await this.ensureDirectoryExists(filePath);
                await this.vault.create(filePath, content);
            }
            
            return { success: true, data: undefined };
        }, 'write', filePath);

        this.operationQueue.set(filePath, operation);
        
        try {
            const result = await operation;
            return result;
        } finally {
            this.operationQueue.delete(filePath);
        }
    }

    async delete(filePath: string): Promise<Result<void>> {
        // ファイルパスのバリデーション
        const pathValidation = FileValidator.validateFilePath(filePath);
        if (!pathValidation.valid) {
            return { 
                success: false, 
                error: new FileOperationError(pathValidation.error!, filePath, 'delete')
            };
        }

        // 同じファイルへの同時操作を防ぐためのキューイング
        if (this.operationQueue.has(filePath)) {
            await this.operationQueue.get(filePath);
        }

        const operation = this.withRetry(async () => {
            const file = this.vault.getAbstractFileByPath(filePath);
            if (!file) {
                throw new FileOperationError(`File not found: ${filePath}`, filePath, 'delete');
            }
            
            await this.vault.delete(file);
            return { success: true, data: undefined };
        }, 'delete', filePath);

        this.operationQueue.set(filePath, operation);
        
        try {
            const result = await operation;
            return result;
        } finally {
            this.operationQueue.delete(filePath);
        }
    }

    async exists(filePath: string): Promise<Result<boolean>> {
        try {
            const file = this.vault.getAbstractFileByPath(filePath);
            return { success: true, data: file !== null };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async list(folderPath: string): Promise<Result<string[]>> {
        try {
            const folder = this.vault.getAbstractFileByPath(folderPath);
            if (!folder || !(folder instanceof TFolder)) {
                return { success: false, error: new Error(`Folder not found: ${folderPath}`) };
            }
            
            const files = folder.children
                .filter(child => child instanceof TFile)
                .map(file => file.path);
            
            return { success: true, data: files };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async createFolder(folderPath: string): Promise<Result<void>> {
        return this.withRetry(async () => {
            const exists = await this.exists(folderPath);
            if (exists.success && exists.data) {
                return { success: true, data: undefined };
            }
            
            await this.vault.createFolder(folderPath);
            return { success: true, data: undefined };
        }, 'createFolder', folderPath);
    }

    private async withRetry<T>(
        operation: () => Promise<Result<T>>,
        operationType: string,
        filePath: string
    ): Promise<Result<T>> {
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                
                if (attempt < this.MAX_RETRIES) {
                    // 再試行可能なエラーかどうかをチェック
                    if (this.isRetryableError(error as Error)) {
                        await this.delay(this.RETRY_DELAY * attempt);
                        console.warn(`Retrying ${operationType} operation for ${filePath} (attempt ${attempt + 1}/${this.MAX_RETRIES})`);
                        continue;
                    }
                }
                
                break;
            }
        }
        
        return { 
            success: false, 
            error: new FileOperationError(
                `${operationType} operation failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`,
                filePath,
                operationType,
                lastError || undefined
            )
        };
    }

    private isRetryableError(error: Error): boolean {
        const retryablePatterns = [
            'EBUSY',
            'ENOENT',
            'EMFILE',
            'ENFILE',
            'EAGAIN',
            'EACCES'
        ];
        
        return retryablePatterns.some(pattern => 
            error.message.includes(pattern)
        );
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async ensureDirectoryExists(filePath: string): Promise<void> {
        const directoryPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (directoryPath) {
            const exists = await this.exists(directoryPath);
            if (!exists.success || !exists.data) {
                await this.vault.createFolder(directoryPath);
            }
        }
    }

    // ファイルの監視とキャッシュ無効化
    private fileWatchers = new Map<string, () => void>();
    
    watchFile(filePath: string, callback: () => void): () => void {
        // 既存のウォッチャーがある場合は削除
        if (this.fileWatchers.has(filePath)) {
            this.fileWatchers.get(filePath)!();
        }
        
        const eventRef = this.vault.on('modify', (file) => {
            if (file.path === filePath) {
                callback();
            }
        });
        
        const unwatch = () => {
            this.vault.offref(eventRef);
            this.fileWatchers.delete(filePath);
        };
        
        this.fileWatchers.set(filePath, unwatch);
        return unwatch;
    }

    // クリーンアップ
    cleanup(): void {
        this.fileWatchers.forEach(unwatch => unwatch());
        this.fileWatchers.clear();
        this.operationQueue.clear();
    }
}