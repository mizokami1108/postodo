import { IFileScanner } from './sequential-naming-strategy';
import { Vault } from 'obsidian';

/**
 * Obsidian Vault を使用したファイルスキャナー
 * 指定フォルダ内のファイル名一覧を取得する
 */
export class VaultFileScanner implements IFileScanner {
    constructor(
        private vault: Vault,
        private folderPath: string
    ) {}

    /**
     * 指定フォルダ内のファイル名一覧を取得する
     * @returns ファイル名の配列（拡張子なし）
     */
    getExistingFileNames(): string[] {
        const files = this.vault.getMarkdownFiles();
        const folderPrefix = this.folderPath + '/';
        
        return files
            .filter(file => file.path.startsWith(folderPrefix))
            .map(file => {
                // パスからファイル名を抽出し、拡張子を除去
                const fileName = file.path.substring(folderPrefix.length);
                return fileName.replace(/\.md$/, '');
            });
    }

    /**
     * フォルダパスを更新する
     */
    setFolderPath(folderPath: string): void {
        this.folderPath = folderPath;
    }
}
