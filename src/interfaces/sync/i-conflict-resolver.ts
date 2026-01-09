import { StickyNote, Result } from '../../types/core-types';

/**
 * 競合の種類
 * - position: 位置の競合（UI優先）
 * - content: コンテンツの競合（新しい方優先）
 * - metadata: メタデータの競合（マージ）
 */
export type ConflictType = 'position' | 'content' | 'metadata';

/**
 * 競合解決の戦略
 */
export type ResolveStrategy = 'file-wins' | 'ui-wins' | 'merge' | 'user-choice';

/**
 * 競合解決の結果
 */
export interface ResolveResult {
    /** 解決が成功したかどうか */
    success: boolean;
    /** 解決後の付箋データ */
    result: StickyNote;
    /** 適用された解決戦略 */
    strategy: ResolveStrategy;
}

/**
 * 競合検出の結果
 */
export interface ConflictDetectionResult {
    /** 競合があるかどうか */
    hasConflict: boolean;
    /** 検出された競合の種類（複数の場合あり） */
    conflictTypes: ConflictType[];
}

/**
 * 競合解決インターフェース
 * ファイルとUIの変更間の競合を検出・解決する
 * 
 * Requirements: 8.1, 8.2, 8.3
 */
export interface IConflictResolver {
    /**
     * 競合を検出する
     * @param fileNote ファイルから読み込んだ付箋データ
     * @param uiNote UI上の付箋データ
     * @returns 検出された競合の種類、競合がない場合はnull
     */
    detectConflict(fileNote: StickyNote, uiNote: StickyNote): ConflictType | null;

    /**
     * 複数の競合を検出する
     * @param fileNote ファイルから読み込んだ付箋データ
     * @param uiNote UI上の付箋データ
     * @returns 競合検出結果
     */
    detectAllConflicts(fileNote: StickyNote, uiNote: StickyNote): ConflictDetectionResult;

    /**
     * 競合を解決する
     * @param fileNote ファイルから読み込んだ付箋データ
     * @param uiNote UI上の付箋データ
     * @param conflictType 競合の種類
     * @returns 解決結果
     */
    resolveConflict(
        fileNote: StickyNote,
        uiNote: StickyNote,
        conflictType: ConflictType
    ): Promise<ResolveResult>;

    /**
     * 全ての競合を解決する
     * @param fileNote ファイルから読み込んだ付箋データ
     * @param uiNote UI上の付箋データ
     * @returns 解決結果
     */
    resolveAllConflicts(
        fileNote: StickyNote,
        uiNote: StickyNote
    ): Promise<ResolveResult>;
}
