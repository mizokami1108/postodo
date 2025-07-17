import { Vault, TFile, TFolder } from 'obsidian';
import { IStorageAdapter } from '../../interfaces/storage/i-storage-adapter';
import { Result } from '../../types/core-types';

export class ObsidianStorageAdapter implements IStorageAdapter {
    constructor(private vault: Vault) {}

    async read(filePath: string): Promise<Result<string>> {
        try {
            const file = this.vault.getAbstractFileByPath(filePath);
            if (!file || !(file instanceof TFile)) {
                return { success: false, error: new Error(`File not found: ${filePath}`) };
            }
            
            const content = await this.vault.read(file);
            return { success: true, data: content };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async write(filePath: string, content: string): Promise<Result<void>> {
        try {
            const file = this.vault.getAbstractFileByPath(filePath);
            
            if (file && file instanceof TFile) {
                // 既存ファイルの更新
                await this.vault.modify(file, content);
            } else {
                // 新規ファイルの作成
                await this.vault.create(filePath, content);
            }
            
            return { success: true, data: undefined };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }

    async delete(filePath: string): Promise<Result<void>> {
        try {
            const file = this.vault.getAbstractFileByPath(filePath);
            if (!file) {
                return { success: false, error: new Error(`File not found: ${filePath}`) };
            }
            
            await this.vault.delete(file);
            return { success: true, data: undefined };
        } catch (error) {
            return { success: false, error: error as Error };
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
        try {
            const exists = await this.exists(folderPath);
            if (exists.success && exists.data) {
                return { success: true, data: undefined };
            }
            
            await this.vault.createFolder(folderPath);
            return { success: true, data: undefined };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }
}