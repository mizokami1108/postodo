// イベントバスシステム
export interface IEventBus {
    on<T = any>(event: string, listener: EventListener<T>): () => void;
    once<T = any>(event: string, listener: EventListener<T>): () => void;
    off<T = any>(event: string, listener: EventListener<T>): void;
    emit<T = any>(event: string, data?: T): void;
    onPattern(pattern: string, listener: EventListener): () => void;
}

export class EventBus implements IEventBus {
    private listeners = new Map<string, EventListener[]>();
    private onceListeners = new Map<string, EventListener[]>();
    private wildcardListeners: WildcardListener[] = [];

    on<T = any>(event: string, listener: EventListener<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);

        // アンサブスクライブ関数を返す
        return () => this.off(event, listener);
    }

    once<T = any>(event: string, listener: EventListener<T>): () => void {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, []);
        }
        this.onceListeners.get(event)!.push(listener);

        return () => this.off(event, listener);
    }

    off<T = any>(event: string, listener: EventListener<T>): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }

        const onceListeners = this.onceListeners.get(event);
        if (onceListeners) {
            const index = onceListeners.indexOf(listener);
            if (index > -1) {
                onceListeners.splice(index, 1);
            }
        }
    }

    emit<T = any>(event: string, data?: T): void {
        // 通常のリスナー
        const listeners = this.listeners.get(event) || [];
        listeners.forEach(listener => {
            try {
                listener(data, event);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });

        // 一回限りのリスナー
        const onceListeners = this.onceListeners.get(event) || [];
        onceListeners.forEach(listener => {
            try {
                listener(data, event);
            } catch (error) {
                console.error(`Error in once listener for ${event}:`, error);
            }
        });
        this.onceListeners.delete(event);

        // ワイルドカードリスナー
        this.wildcardListeners.forEach(({ pattern, listener }) => {
            if (this.matchPattern(pattern, event)) {
                try {
                    listener(data, event);
                } catch (error) {
                    console.error(`Error in wildcard listener for ${pattern}:`, error);
                }
            }
        });
    }

    // ワイルドカードパターンのサポート（例: "note.*", "ui.theme.*"）
    onPattern(pattern: string, listener: EventListener): () => void {
        const wildcardListener = { pattern, listener };
        this.wildcardListeners.push(wildcardListener);

        return () => {
            const index = this.wildcardListeners.indexOf(wildcardListener);
            if (index > -1) {
                this.wildcardListeners.splice(index, 1);
            }
        };
    }

    private matchPattern(pattern: string, event: string): boolean {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(event);
    }
}

export interface EventListener<T = any> {
    (data?: T, event?: string): void;
}

interface WildcardListener {
    pattern: string;
    listener: EventListener;
}