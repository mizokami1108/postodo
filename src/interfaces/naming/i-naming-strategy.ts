import { StickyNote } from '../../types/core-types';

/**
 * ファイル名生成戦略のインターフェース
 * 付箋ファイルの命名規則を定義する
 */
export interface INamingStrategy {
    /**
     * 付箋データからファイル名を生成する
     * @param note 付箋データ（部分的でも可）
     * @returns 生成されたファイル名（拡張子なし）
     */
    generateFileName(note: Partial<StickyNote>): string | Promise<string>;

    /**
     * ファイル名から情報を抽出する
     * @param fileName ファイル名（拡張子なし）
     * @returns 抽出された情報、またはパース失敗時はnull
     */
    parseFileName(fileName: string): ParsedFileName | null;

    /**
     * 命名方式の種類を取得する
     */
    readonly strategyType: NamingStrategyType;
}

/**
 * ファイル名から抽出された情報
 */
export interface ParsedFileName {
    /** タイトル（存在する場合） */
    title?: string;
    /** タイムスタンプ（存在する場合） */
    timestamp?: Date;
    /** 連番（存在する場合） */
    seqNo?: number;
}

/**
 * 命名方式の種類
 */
export type NamingStrategyType = 'timestamp' | 'custom';
