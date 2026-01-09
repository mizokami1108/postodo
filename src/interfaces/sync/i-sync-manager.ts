import { StickyNote, Result } from '../../types/core-types';

/**
 * 同期ステータス
 */
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

/**
 * リトライ設定
 * Requirements: 7.4
 */
export interface RetryConfig {
    /** 最大リトライ回数 */
    maxRetries: number;
    /** 初期遅延時間（ミリ秒） */
    initialDelayMs: number;
    /** バックオフ倍率 */
    backoffMultiplier: number;
}

/**
 * 同期結果
 */
export interface SyncResult {
    /** 同期が成功したかどうか */
    success: boolean;
    /** 同期後の付箋データ */
    note?: StickyNote;
    /** 競合が発生したかどうか */
    hadConflict: boolean;
    /** エラーメッセージ（失敗時） */
    error?: string;
}

/**
 * 同期マネージャーインターフェース
 * UIとファイル間のデータ同期を管理する
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
export interface ISyncManager {
    /**
     * ファイル監視を開始する
     */
    startWatching(): void;

    /**
     * ファイル監視を停止する
     */
    stopWatching(): void;

    /**
     * 付箋をファイルに同期する（デバウンス付き）
     * @param note 同期する付箋
     * @returns 同期結果
     */
    syncNoteToFile(note: StickyNote): Promise<Result<void>>;

    /**
     * 付箋をファイルに即座に同期する（デバウンスなし、リトライ機能付き）
     * Requirements: 7.4
     * @param note 同期する付箋
     * @returns 同期結果
     */
    syncNoteToFileImmediate(note: StickyNote): Promise<Result<void>>;

    /**
     * ファイルから付箋を同期する
     * @param filePath ファイルパス
     * @returns 同期結果
     */
    syncFileToNote(filePath: string): Promise<Result<StickyNote>>;

    /**
     * 付箋が編集中かどうかを確認する
     * @param noteId 付箋ID
     * @returns 編集中の場合true
     */
    isNoteBeingEdited(noteId: string): boolean;

    /**
     * 付箋を編集中としてマークする
     * @param noteId 付箋ID
     */
    markNoteAsEditing(noteId: string): void;

    /**
     * 付箋の編集中マークを解除する
     * @param noteId 付箋ID
     */
    unmarkNoteAsEditing(noteId: string): void;

    /**
     * 競合を検出して解決する
     * @param fileNote ファイルから読み込んだ付箋
     * @param uiNote UI上の付箋
     * @returns 同期結果
     */
    resolveAndSync(fileNote: StickyNote, uiNote: StickyNote): Promise<SyncResult>;

    /**
     * 現在の同期ステータスを取得する
     * @returns 同期ステータス
     */
    getStatus(): SyncStatus;

    /**
     * リトライ設定を取得する
     * Requirements: 7.4
     * @returns リトライ設定
     */
    getRetryConfig(): RetryConfig;

    /**
     * リソースをクリーンアップする
     */
    cleanup(): void;
}
