import { StickyNote } from '../types/core-types';
import { DataManager } from '../implementations/data/data-manager';

export class SimpleDragHandler {
    private isDragging = false;
    private startX = 0;
    private startY = 0;
    private initialX = 0;
    private initialY = 0;
    private offsetX = 0;
    private offsetY = 0;
    private currentNote?: StickyNote;
    private noteElement?: HTMLElement;
    private canvasElement?: HTMLElement;
    private onDragEnd?: (timestamp: number) => void;

    constructor(private dataManager: DataManager) {}

    setupDragHandlers(noteElement: HTMLElement, note: StickyNote, canvasElement: HTMLElement, onDragEnd?: (timestamp: number) => void): void {
        this.noteElement = noteElement;
        this.currentNote = note;
        this.canvasElement = canvasElement;
        this.onDragEnd = onDragEnd;

        noteElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
        noteElement.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    }

    private handleMouseDown = (e: MouseEvent): void => {
        // 削除ボタンクリック時はドラッグを開始しない
        if ((e.target as HTMLElement).classList.contains('note-delete-btn')) {
            return;
        }

        e.preventDefault();
        this.startDrag(e.clientX, e.clientY);
    };

    private handleTouchStart = (e: TouchEvent): void => {
        if (e.touches.length > 1) return;

        const touch = e.touches[0];
        e.preventDefault();
        this.startDrag(touch.clientX, touch.clientY);
    };

    private startDrag(clientX: number, clientY: number): void {
        if (!this.noteElement || !this.currentNote || !this.canvasElement) return;

        // 付箋の現在位置を取得
        const noteRect = this.noteElement.getBoundingClientRect();
        const canvasRect = this.canvasElement.getBoundingClientRect();
        
        // マウス位置と付箋左上角の相対位置を計算
        this.offsetX = clientX - noteRect.left;
        this.offsetY = clientY - noteRect.top;
        
        this.isDragging = true;
        this.startX = clientX;
        this.startY = clientY;
        this.initialX = this.currentNote.position.x;
        this.initialY = this.currentNote.position.y;

        // ドラッグ中のスタイル
        this.noteElement.classList.add('dragging');
        this.noteElement.style.zIndex = '1000';

        // ドキュメントレベルでイベントリスナーを追加
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd);
    }

    private handleMouseMove = (e: MouseEvent): void => {
        if (!this.isDragging) return;
        e.preventDefault();
        this.updatePosition(e.clientX, e.clientY);
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (!this.isDragging || e.touches.length > 1) return;

        const touch = e.touches[0];
        e.preventDefault();
        this.updatePosition(touch.clientX, touch.clientY);
    };

    private updatePosition(clientX: number, clientY: number): void {
        if (!this.noteElement || !this.currentNote || !this.canvasElement) return;

        // キャンバスの座標系に変換
        const canvasRect = this.canvasElement.getBoundingClientRect();
        const canvasX = clientX - canvasRect.left;
        const canvasY = clientY - canvasRect.top;
        
        // オフセットを考慮した新しい位置を計算
        const newX = canvasX - this.offsetX;
        const newY = canvasY - this.offsetY;

        // 境界チェック
        const maxX = this.canvasElement.offsetWidth - this.noteElement.offsetWidth;
        const maxY = this.canvasElement.offsetHeight - this.noteElement.offsetHeight;
        
        const boundedX = Math.max(0, Math.min(maxX, newX));
        const boundedY = Math.max(0, Math.min(maxY, newY));

        // 位置の更新
        this.noteElement.style.left = `${boundedX}px`;
        this.noteElement.style.top = `${boundedY}px`;
    }

    private handleMouseUp = (): void => {
        this.finalizeDrag();
    };

    private handleTouchEnd = (): void => {
        this.finalizeDrag();
    };

    private async finalizeDrag(): Promise<void> {
        if (!this.isDragging || !this.noteElement || !this.currentNote) return;

        this.isDragging = false;

        // スタイルのリセット
        this.noteElement.classList.remove('dragging');
        this.noteElement.style.zIndex = this.currentNote.position.zIndex.toString();

        // イベントリスナーの削除
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);

        // ドラッグ終了時刻を記録
        const now = Date.now();
        if (this.onDragEnd) {
            this.onDragEnd(now);
        }

        // 位置の保存
        const newX = parseInt(this.noteElement.style.left);
        const newY = parseInt(this.noteElement.style.top);

        if (newX !== this.currentNote.position.x || newY !== this.currentNote.position.y) {
            await this.dataManager.updateNote(this.currentNote.id, {
                position: {
                    ...this.currentNote.position,
                    x: newX,
                    y: newY
                }
            });
        }
    }

    cleanup(): void {
        // イベントリスナーの削除
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
    }
}