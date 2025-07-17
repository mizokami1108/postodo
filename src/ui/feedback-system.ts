import { StickyNote } from '../types/core-types';

export class FeedbackSystem {
    private notificationContainer?: HTMLElement;
    private activeAnimations = new Set<string>();

    constructor(private container: HTMLElement) {
        this.setupNotificationContainer();
    }

    private setupNotificationContainer(): void {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'postodo-notifications';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(this.notificationContainer);
    }

    showNoteCreated(note: StickyNote): void {
        const noteElement = this.findNoteElement(note.id);
        if (noteElement) {
            this.animateNoteAppear(noteElement);
        }
        // 通知は手動で制御するため削除
    }

    showNoteUpdated(note: StickyNote): void {
        const noteElement = this.findNoteElement(note.id);
        if (noteElement) {
            this.animateNoteUpdate(noteElement);
        }
    }

    showNoteDeleted(noteId: string): void {
        const noteElement = this.findNoteElement(noteId);
        if (noteElement) {
            this.animateNoteDisappear(noteElement);
        }
        // 通知は手動で制御するため削除
    }

    showDragStart(noteId: string): void {
        const noteElement = this.findNoteElement(noteId);
        if (noteElement) {
            this.animateDragStart(noteElement);
        }
    }

    showDragEnd(noteId: string): void {
        const noteElement = this.findNoteElement(noteId);
        if (noteElement) {
            this.animateDragEnd(noteElement);
        }
    }

    showValidationError(message: string): void {
        this.showNotification(message, 'error');
    }

    showSyncStatus(status: 'syncing' | 'synced' | 'error'): void {
        const messages = {
            syncing: '同期中...',
            synced: '同期完了',
            error: '同期エラー'
        };
        
        const types = {
            syncing: 'info',
            synced: 'success',
            error: 'error'
        } as const;
        
        this.showNotification(messages[status], types[status]);
    }

    showSuccess(message: string): void {
        this.showNotification(message, 'success');
    }

    showWarning(message: string): void {
        this.showNotification(message, 'warning');
    }

    showError(message: string): void {
        this.showNotification(message, 'error');
    }

    showInfo(message: string): void {
        this.showNotification(message, 'info');
    }

    private animateNoteAppear(element: HTMLElement): void {
        if (this.activeAnimations.has(element.id)) return;
        
        this.activeAnimations.add(element.id);
        
        // 初期状態
        element.style.opacity = '0';
        element.style.transform = 'scale(0.8) rotate(-5deg)';
        element.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        // アニメーション開始
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'scale(1) rotate(0deg)';
        });
        
        // アニメーション終了後のクリーンアップ
        setTimeout(() => {
            element.style.transition = '';
            this.activeAnimations.delete(element.id);
        }, 300);
    }

    private animateNoteUpdate(element: HTMLElement): void {
        if (this.activeAnimations.has(element.id)) return;
        
        this.activeAnimations.add(element.id);
        
        // パルス効果
        element.style.transition = 'transform 0.2s ease';
        element.style.transform = 'scale(1.05)';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 100);
        
        setTimeout(() => {
            element.style.transition = '';
            this.activeAnimations.delete(element.id);
        }, 200);
    }

    private animateNoteDisappear(element: HTMLElement): void {
        if (this.activeAnimations.has(element.id)) return;
        
        this.activeAnimations.add(element.id);
        
        // フェードアウト
        element.style.transition = 'all 0.3s ease';
        element.style.opacity = '0';
        element.style.transform = 'scale(0.8) rotate(5deg)';
        
        setTimeout(() => {
            element.remove();
            this.activeAnimations.delete(element.id);
        }, 300);
    }

    private animateDragStart(element: HTMLElement): void {
        element.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        element.style.transform = 'scale(1.05) rotate(2deg)';
        element.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
    }

    private animateDragEnd(element: HTMLElement): void {
        element.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        element.style.transform = 'scale(1) rotate(0deg)';
        element.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        
        setTimeout(() => {
            element.style.transition = '';
        }, 300);
    }

    private showNotification(message: string, type: 'success' | 'info' | 'warning' | 'error'): void {
        if (!this.notificationContainer) return;
        
        const notification = document.createElement('div');
        notification.className = `postodo-notification postodo-notification--${type}`;
        notification.textContent = message;
        
        // スタイル設定
        notification.style.cssText = `
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 4px;
            font-size: 14px;
            color: white;
            background: ${this.getNotificationColor(type)};
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            pointer-events: auto;
        `;
        
        this.notificationContainer.appendChild(notification);
        
        // アニメーション開始
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // 自動削除
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    private getNotificationColor(type: string): string {
        const colors = {
            success: '#4caf50',
            info: '#2196f3',
            warning: '#ff9800',
            error: '#f44336'
        };
        return colors[type as keyof typeof colors] || colors.info;
    }

    private findNoteElement(noteId: string): HTMLElement | null {
        return this.container.querySelector(`[data-note-id="${noteId}"]`) as HTMLElement;
    }

    cleanup(): void {
        if (this.notificationContainer) {
            this.notificationContainer.remove();
        }
        this.activeAnimations.clear();
    }
}