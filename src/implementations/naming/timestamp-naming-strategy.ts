import { INamingStrategy, ParsedFileName, NamingStrategyType } from '../../interfaces/naming/i-naming-strategy';
import { StickyNote } from '../../types/core-types';

/**
 * タイムスタンプベースのファイル命名戦略
 * 形式: Sticky-yyyyMMddHHmmss
 */
export class TimestampNamingStrategy implements INamingStrategy {
    readonly strategyType: NamingStrategyType = 'timestamp';

    /**
     * タイムスタンプ形式でファイル名を生成する
     * @param note 付箋データ（使用しない）
     * @returns Sticky-yyyyMMddHHmmss 形式のファイル名
     */
    generateFileName(note: Partial<StickyNote>): string {
        const now = new Date();
        const timestamp = this.formatTimestamp(now);
        return `Sticky-${timestamp}`;
    }

    /**
     * ファイル名からタイムスタンプを抽出する
     * @param fileName ファイル名（拡張子なし）
     * @returns 抽出された情報、またはパース失敗時はnull
     */
    parseFileName(fileName: string): ParsedFileName | null {
        const match = fileName.match(/^Sticky-(\d{14})$/);
        if (!match) {
            return null;
        }

        const timestampStr = match[1];
        const timestamp = this.parseTimestamp(timestampStr);
        
        if (!timestamp) {
            return null;
        }

        return { timestamp };
    }

    /**
     * Date オブジェクトを yyyyMMddHHmmss 形式の文字列に変換する
     */
    private formatTimestamp(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }

    /**
     * yyyyMMddHHmmss 形式の文字列を Date オブジェクトに変換する
     */
    private parseTimestamp(timestampStr: string): Date | null {
        if (timestampStr.length !== 14) {
            return null;
        }

        const year = parseInt(timestampStr.substring(0, 4), 10);
        const month = parseInt(timestampStr.substring(4, 6), 10) - 1;
        const day = parseInt(timestampStr.substring(6, 8), 10);
        const hours = parseInt(timestampStr.substring(8, 10), 10);
        const minutes = parseInt(timestampStr.substring(10, 12), 10);
        const seconds = parseInt(timestampStr.substring(12, 14), 10);

        // 値の妥当性チェック
        if (month < 0 || month > 11 || day < 1 || day > 31 ||
            hours < 0 || hours > 23 || minutes < 0 || minutes > 59 ||
            seconds < 0 || seconds > 59) {
            return null;
        }

        const date = new Date(year, month, day, hours, minutes, seconds);
        
        // 日付が有効かチェック（例: 2月30日などの無効な日付を検出）
        if (date.getMonth() !== month || date.getDate() !== day) {
            return null;
        }

        return date;
    }
}
