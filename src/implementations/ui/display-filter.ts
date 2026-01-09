import { IDisplayFilter, DisplayFilterType } from '../../interfaces/ui/i-display-filter';
import { StickyNote } from '../../types/core-types';

/**
 * 表示フィルターの実装
 * 付箋の完了状態に基づいて表示/非表示を決定する
 */
export class DisplayFilter implements IDisplayFilter {
    private _currentFilter: DisplayFilterType;
    private listeners: Set<(filter: DisplayFilterType) => void> = new Set();

    /**
     * @param defaultFilter デフォルトのフィルター（デフォルト: 'incomplete'）
     */
    constructor(defaultFilter: DisplayFilterType = 'incomplete') {
        this._currentFilter = defaultFilter;
    }

    /**
     * 現在のフィルター種類を取得
     */
    get currentFilter(): DisplayFilterType {
        return this._currentFilter;
    }

    /**
     * フィルターを設定
     * @param filter 設定するフィルター種類
     */
    setFilter(filter: DisplayFilterType): void {
        if (this._currentFilter !== filter) {
            this._currentFilter = filter;
            this.notifyListeners();
        }
    }

    /**
     * 付箋を表示すべきかどうかを判定
     * @param note 判定対象の付箋
     * @returns 表示すべき場合はtrue
     */
    shouldDisplay(note: StickyNote): boolean {
        switch (this._currentFilter) {
            case 'incomplete':
                return !note.completed;
            case 'complete':
                return note.completed;
            case 'all':
                return true;
            default:
                return true;
        }
    }

    /**
     * フィルター変更時のコールバックを登録
     * @param callback フィルター変更時に呼ばれるコールバック
     * @returns 登録解除関数
     */
    onFilterChanged(callback: (filter: DisplayFilterType) => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * 全てのリスナーに通知
     */
    private notifyListeners(): void {
        this.listeners.forEach(listener => {
            try {
                listener(this._currentFilter);
            } catch (error) {
                console.error('Error in filter change listener:', error);
            }
        });
    }

    /**
     * クリーンアップ
     */
    cleanup(): void {
        this.listeners.clear();
    }
}
