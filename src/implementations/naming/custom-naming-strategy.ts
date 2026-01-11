import { INamingStrategy, ParsedFileName, NamingStrategyType } from '../../interfaces/naming/i-naming-strategy';
import { StickyNote } from '../../types/core-types';

/**
 * カスタムフォーマットベースのファイル命名方式
 * 
 * サポートするプレースホルダー:
 * - {YYYY}: 年（4桁）
 * - {MM}: 月（2桁）
 * - {DD}: 日（2桁）
 * - {HH}: 時（2桁、24時間形式）
 * - {mm}: 分（2桁）
 * - {ss}: 秒（2桁）
 * - {SSS}: ミリ秒（3桁）
 * 
 * 例: "Note-{YYYY}-{MM}-{DD}_{HH}{mm}{ss}" → "Note-2026-01-11_164530"
 */
export class CustomNamingStrategy implements INamingStrategy {
    readonly strategyType: NamingStrategyType = 'custom';
    
    private format: string;

    /**
     * @param format カスタムフォーマット文字列
     */
    constructor(format: string = 'Sticky-{YYYY}{MM}{DD}-{HH}{mm}{ss}') {
        this.format = format;
    }

    /**
     * フォーマットを更新する
     */
    setFormat(format: string): void {
        this.format = format;
    }

    /**
     * カスタムフォーマットでファイル名を生成する
     * 一意性を保証するため、フォーマットにミリ秒が含まれない場合は自動でサフィックスを追加
     * @param note 付箋データ（使用しない）
     * @returns フォーマットに基づいたファイル名
     */
    generateFileName(note: Partial<StickyNote>): string {
        const now = new Date();
        
        let fileName = this.format
            .replace(/{YYYY}/g, now.getFullYear().toString())
            .replace(/{MM}/g, (now.getMonth() + 1).toString().padStart(2, '0'))
            .replace(/{DD}/g, now.getDate().toString().padStart(2, '0'))
            .replace(/{HH}/g, now.getHours().toString().padStart(2, '0'))
            .replace(/{mm}/g, now.getMinutes().toString().padStart(2, '0'))
            .replace(/{ss}/g, now.getSeconds().toString().padStart(2, '0'))
            .replace(/{SSS}/g, now.getMilliseconds().toString().padStart(3, '0'));
        
        // 一意性を保証: フォーマットにミリ秒({SSS})が含まれていない場合、
        // ランダムサフィックスを追加して重複を防ぐ
        if (!this.format.includes('{SSS}')) {
            const randomSuffix = Math.random().toString(36).substring(2, 6);
            fileName = `${fileName}-${randomSuffix}`;
        }
        
        return fileName;
    }

    /**
     * ファイル名から情報を抽出する
     * カスタムフォーマットは多様なため、基本的なパースのみ行う
     * @param fileName ファイル名（拡張子なし）
     * @returns 抽出された情報、またはパース失敗時はnull
     */
    parseFileName(fileName: string): ParsedFileName | null {
        // カスタムフォーマットからタイムスタンプを抽出する試み
        // 一般的なパターン: 数字の連続を探す
        const dateMatch = fileName.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
        
        if (dateMatch) {
            const [, year, month, day, hour, minute, second] = dateMatch;
            const timestamp = new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1,
                parseInt(day, 10),
                parseInt(hour, 10),
                parseInt(minute, 10),
                parseInt(second, 10)
            );
            
            if (!isNaN(timestamp.getTime())) {
                return { timestamp };
            }
        }
        
        return null;
    }
}
