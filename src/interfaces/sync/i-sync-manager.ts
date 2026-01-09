import { StickyNote, Result } from '../../types/core-types';

/**
 * 同期ステータス
 */
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error';

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
 * Requirements: 7.1, 7.2, 7.3
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
     * 付箋をファイルに同期する
     * @param note 同期する付箋
     * @returns 同期結果
     */
    syncNoteToFile(note: StickyNote): Promise<Result<void>>;

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
     * リソースをクリーンアップする
     */
    cleanup(): void;
}
