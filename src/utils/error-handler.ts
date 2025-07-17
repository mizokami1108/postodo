import { IEventBus } from '../core/event-bus';

export interface ErrorContext {
    component: string;
    action: string;
    noteId?: string;
    filePath?: string;
    userAction?: string;
    timestamp: number;
    userId?: string;
}

export interface ErrorDetails {
    message: string;
    code: string;
    context: ErrorContext;
    originalError?: Error;
    stack?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recoverable: boolean;
    userMessage: string;
    suggestions: string[];
}

export class PostodoError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly context: ErrorContext,
        public readonly severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
        public readonly recoverable: boolean = true,
        public readonly userMessage: string = message,
        public readonly suggestions: string[] = []
    ) {
        super(message);
        this.name = 'PostodoError';
    }
}

export class FileOperationError extends PostodoError {
    constructor(
        message: string,
        filePath: string,
        operation: string,
        originalError?: Error
    ) {
        super(
            message,
            'FILE_OPERATION_ERROR',
            {
                component: 'FileSystem',
                action: operation,
                filePath,
                timestamp: Date.now()
            },
            'high',
            true,
            'ファイル操作でエラーが発生しました',
            [
                'ファイルの権限を確認してください',
                'ディスク容量を確認してください',
                'しばらく待ってから再試行してください'
            ]
        );
        
        if (originalError) {
            this.stack = originalError.stack;
        }
    }
}

export class ValidationError extends PostodoError {
    constructor(
        message: string,
        field: string,
        value: any
    ) {
        super(
            message,
            'VALIDATION_ERROR',
            {
                component: 'Validation',
                action: 'validate',
                userAction: `validating ${field}`,
                timestamp: Date.now()
            },
            'medium',
            true,
            `入力値エラー: ${message}`,
            ['入力内容を確認してください']
        );
    }
}

export class SyncError extends PostodoError {
    constructor(
        message: string,
        noteId: string,
        operation: string
    ) {
        super(
            message,
            'SYNC_ERROR',
            {
                component: 'Sync',
                action: operation,
                noteId,
                timestamp: Date.now()
            },
            'high',
            true,
            '同期エラーが発生しました',
            [
                'ネットワーク接続を確認してください',
                'しばらく待ってから再試行してください',
                'データの競合がないか確認してください'
            ]
        );
    }
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private errorLog: ErrorDetails[] = [];
    private maxLogSize = 100;
    private notificationCallbacks: ((error: ErrorDetails) => void)[] = [];

    constructor(private eventBus: IEventBus) {}

    static getInstance(eventBus: IEventBus): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler(eventBus);
        }
        return ErrorHandler.instance;
    }

    handleError(error: Error, context?: Partial<ErrorContext>): void {
        const errorDetails = this.processError(error, context);
        
        // エラーログに記録
        this.logError(errorDetails);
        
        // イベントバスにエラーを通知
        this.eventBus.emit('error-occurred', errorDetails);
        
        // 通知コールバックを実行
        this.notificationCallbacks.forEach(callback => {
            try {
                callback(errorDetails);
            } catch (callbackError) {
                console.error('Error in notification callback:', callbackError);
            }
        });
        
        // 自動復旧の試行
        this.attemptRecovery(errorDetails);
    }

    private processError(error: Error, context?: Partial<ErrorContext>): ErrorDetails {
        const baseContext: ErrorContext = {
            component: 'Unknown',
            action: 'unknown',
            timestamp: Date.now(),
            ...context
        };

        if (error instanceof PostodoError) {
            return {
                message: error.message,
                code: error.code,
                context: { ...baseContext, ...error.context },
                originalError: error,
                stack: error.stack,
                severity: error.severity,
                recoverable: error.recoverable,
                userMessage: error.userMessage,
                suggestions: error.suggestions
            };
        }

        // 一般的なエラーの処理
        return this.processGenericError(error, baseContext);
    }

    private processGenericError(error: Error, context: ErrorContext): ErrorDetails {
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        let recoverable = true;
        let userMessage = '予期しないエラーが発生しました';
        let suggestions: string[] = ['ページを再読み込みしてください'];
        let code = 'GENERIC_ERROR';

        // エラーメッセージに基づく分類
        if (error.message.includes('Network') || error.message.includes('fetch')) {
            severity = 'high';
            userMessage = 'ネットワークエラーが発生しました';
            suggestions = [
                'インターネット接続を確認してください',
                'しばらく待ってから再試行してください'
            ];
            code = 'NETWORK_ERROR';
        } else if (error.message.includes('Permission') || error.message.includes('EACCES')) {
            severity = 'high';
            userMessage = 'アクセス権限エラーが発生しました';
            suggestions = [
                'ファイルの権限を確認してください',
                '管理者権限で実行してください'
            ];
            code = 'PERMISSION_ERROR';
        } else if (error.message.includes('QuotaExceeded') || error.message.includes('ENOSPC')) {
            severity = 'critical';
            userMessage = 'ストレージ容量不足です';
            suggestions = [
                'ディスク容量を確認してください',
                '不要なファイルを削除してください'
            ];
            code = 'STORAGE_ERROR';
        }

        return {
            message: error.message,
            code,
            context,
            originalError: error,
            stack: error.stack,
            severity,
            recoverable,
            userMessage,
            suggestions
        };
    }

    private logError(errorDetails: ErrorDetails): void {
        // ログサイズの制限
        if (this.errorLog.length >= this.maxLogSize) {
            this.errorLog.shift();
        }

        this.errorLog.push(errorDetails);

        // 重要なエラーはコンソールに出力
        if (errorDetails.severity === 'high' || errorDetails.severity === 'critical') {
            console.error('Postodo Error:', errorDetails);
        }
    }

    private attemptRecovery(errorDetails: ErrorDetails): void {
        if (!errorDetails.recoverable) return;

        switch (errorDetails.code) {
            case 'FILE_OPERATION_ERROR':
                this.retryFileOperation(errorDetails);
                break;
            case 'SYNC_ERROR':
                this.retrySyncOperation(errorDetails);
                break;
            case 'NETWORK_ERROR':
                this.retryNetworkOperation(errorDetails);
                break;
        }
    }

    private async retryFileOperation(errorDetails: ErrorDetails): Promise<void> {
        const retryDelay = 1000; // 1秒後に再試行
        
        setTimeout(async () => {
            try {
                // 元の操作を再試行（実装は呼び出し元で行う）
                this.eventBus.emit('retry-file-operation', errorDetails);
            } catch (error) {
                console.error('Recovery failed:', error);
            }
        }, retryDelay);
    }

    private async retrySyncOperation(errorDetails: ErrorDetails): Promise<void> {
        const retryDelay = 2000; // 2秒後に再試行
        
        setTimeout(async () => {
            try {
                this.eventBus.emit('retry-sync-operation', errorDetails);
            } catch (error) {
                console.error('Sync recovery failed:', error);
            }
        }, retryDelay);
    }

    private async retryNetworkOperation(errorDetails: ErrorDetails): Promise<void> {
        const retryDelay = 3000; // 3秒後に再試行
        
        setTimeout(async () => {
            try {
                this.eventBus.emit('retry-network-operation', errorDetails);
            } catch (error) {
                console.error('Network recovery failed:', error);
            }
        }, retryDelay);
    }

    // 通知コールバックの登録
    onError(callback: (error: ErrorDetails) => void): () => void {
        this.notificationCallbacks.push(callback);
        
        return () => {
            const index = this.notificationCallbacks.indexOf(callback);
            if (index > -1) {
                this.notificationCallbacks.splice(index, 1);
            }
        };
    }

    // エラーログの取得
    getErrorLog(): ErrorDetails[] {
        return [...this.errorLog];
    }

    // エラーログのクリア
    clearErrorLog(): void {
        this.errorLog = [];
    }

    // 特定のエラーの統計情報
    getErrorStats(): { [key: string]: number } {
        const stats: { [key: string]: number } = {};
        
        this.errorLog.forEach(error => {
            stats[error.code] = (stats[error.code] || 0) + 1;
        });
        
        return stats;
    }
}

// 便利な関数
export function createErrorHandler(eventBus: IEventBus): ErrorHandler {
    return ErrorHandler.getInstance(eventBus);
}

export function handleAsyncError<T>(
    promise: Promise<T>,
    errorHandler: ErrorHandler,
    context?: Partial<ErrorContext>
): Promise<T> {
    return promise.catch(error => {
        errorHandler.handleError(error, context);
        throw error;
    });
}

export function wrapWithErrorHandler<T extends (...args: any[]) => any>(
    fn: T,
    errorHandler: ErrorHandler,
    context?: Partial<ErrorContext>
): T {
    return ((...args: any[]) => {
        try {
            const result = fn(...args);
            
            // Promise の場合はエラーハンドリングを追加
            if (result && typeof result.then === 'function') {
                return result.catch((error: Error) => {
                    errorHandler.handleError(error, context);
                    throw error;
                });
            }
            
            return result;
        } catch (error) {
            errorHandler.handleError(error as Error, context);
            throw error;
        }
    }) as T;
}