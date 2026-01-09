import { StickyNote } from '../../types/core-types';

/**
 * 表示フィルターの種類
 * - incomplete: 未完了のみ表示
 * - complete: 完了のみ表示
 * - all: すべて表示
 */
export type DisplayFilterType = 'incomplete' | 'complete' | 'all';

/**
 * 表示フィルターインターフェース
 * Canvas上のStickyNote表示をフィルタリングする
 */
export interface IDisplayFilter {
    /**
     * 現在のフィルター種類を取得
     */
    readonly currentFilter: DisplayFilterType;

    /**
     * フィルターを設定
     * @param filter 設定するフィルター種類
     */
    setFilter(filter: DisplayFilterType): void;

    /**
     * 付箋を表示すべきかどうかを判定
     * @param note 判定対象の付箋
     * @returns 表示すべき場合はtrue
     */
    shouldDisplay(note: StickyNote): boolean;

    /**
     * フィルター変更時のコールバックを登録
     * @param callback フィルター変更時に呼ばれるコールバック
     * @returns 登録解除関数
     */
    onFilterChanged(callback: (filter: DisplayFilterType) => void): () => void;
}
