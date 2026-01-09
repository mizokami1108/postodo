import { INamingStrategy, ParsedFileName, NamingStrategyType } from '../../interfaces/naming/i-naming-strategy';
import { StickyNote } from '../../types/core-types';

/**
 * 既存ファイルを走査するためのインターフェース
 */
export interface IFileScanner {
    /**
     * 指定フォルダ内のファイル名一覧を取得する
     * @returns ファイル名の配列（拡張子なし）
     */
    getExistingFileNames(): string[] | Promise<string[]>;
}

/**
 * 連番ベースのファイル命名戦略
 * 形式: Sticky-{seqNo} (4桁ゼロパディング)
 */
export class SequentialNamingStrategy implements INamingStrategy {
    readonly strategyType: NamingStrategyType = 'sequential';
    
    private fileScanner?: IFileScanner;

    /**
     * @param fileScanner 既存ファイルを走査するためのスキャナー
     */
    constructor(fileScanner?: IFileScanner) {
        this.fileScanner = fileScanner;
    }

    /**
     * ファイルスキャナーを設定する
     */
    setFileScanner(fileScanner: IFileScanner): void {
        this.fileScanner = fileScanner;
    }

    /**
     * 連番形式でファイル名を生成する
     * @param note 付箋データ（使用しない）
     * @returns Sticky-{seqNo} 形式のファイル名
     */
    async generateFileName(note: Partial<StickyNote>): Promise<string> {
        const nextSeqNo = await this.getNextSequenceNumber();
        return `Sticky-${nextSeqNo.toString().padStart(4, '0')}`;
    }

    /**
     * ファイル名から連番を抽出する
     * @param fileName ファイル名（拡張子なし）
     * @returns 抽出された情報、またはパース失敗時はnull
     */
    parseFileName(fileName: string): ParsedFileName | null {
        const match = fileName.match(/^Sticky-(\d+)$/);
        if (!match) {
            return null;
        }

        const seqNo = parseInt(match[1], 10);
        if (isNaN(seqNo) || seqNo < 0) {
            return null;
        }

        return { seqNo };
    }

    /**
     * 次の連番を取得する
     * 既存ファイルを走査して最大の連番を見つけ、+1した値を返す
     */
    private async getNextSequenceNumber(): Promise<number> {
        if (!this.fileScanner) {
            return 1;
        }

        const existingFileNames = await this.fileScanner.getExistingFileNames();
        let maxSeqNo = 0;

        for (const fileName of existingFileNames) {
            const parsed = this.parseFileName(fileName);
            if (parsed && parsed.seqNo !== undefined) {
                maxSeqNo = Math.max(maxSeqNo, parsed.seqNo);
            }
        }

        return maxSeqNo + 1;
    }
}
