import { ItemView, WorkspaceLeaf } from 'obsidian';
import { DIContainer } from '../core/container';
import { DataManager } from '../implementations/data/data-manager';
import { StickyNote } from '../types/core-types';
import { SERVICE_TOKENS } from '../types/core-types';
import { SimpleDragHandler } from './simple-drag-handler';
import { FeedbackSystem } from './feedback-system';
import { NoteValidator } from '../utils/validators';
import { ErrorHandler, PostodoError } from '../utils/error-handler';
import { IEventBus } from '../core/event-bus';

export class PostodoView extends ItemView {
    private dataManager: DataManager;
    private canvasEl!: HTMLElement;
    private inputEl!: HTMLInputElement;
    private notes: StickyNote[] = [];
    private dragHandlers = new Map<string, SimpleDragHandler>();
    private feedbackSystem!: FeedbackSystem;
    private errorHandler: ErrorHandler;
    private lastDragEndTime = 0;

    constructor(leaf: WorkspaceLeaf, private container: DIContainer) {
        super(leaf);
        this.dataManager = container.resolve<DataManager>(SERVICE_TOKENS.DATA_MANAGER);
        this.errorHandler = ErrorHandler.getInstance(container.resolve(SERVICE_TOKENS.EVENT_BUS));
        this.setupEventListeners();
    }

    getViewType(): string {
        return 'postodo-view';
    }

    getDisplayText(): string {
        return 'Postodo';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        container.empty();
        
        // UIの構築
        this.buildUI(container);
        
        // フィードバックシステムの初期化
        this.feedbackSystem = new FeedbackSystem(this.canvasEl);
        
        // キャンバスの高さを動的に調整
        this.adjustCanvasHeight();
        
        // ウィンドウリサイズ時の高さ調整
        window.addEventListener('resize', this.adjustCanvasHeight.bind(this));
        
        // 既存の付箋を読み込み
        await this.loadNotes();
    }

    async onClose(): Promise<void> {
        // ドラッグハンドラーのクリーンアップ
        this.dragHandlers.forEach(handler => handler.cleanup());
        this.dragHandlers.clear();
        
        // フィードバックシステムのクリーンアップ
        if (this.feedbackSystem) {
            this.feedbackSystem.cleanup();
        }
        
        // ウィンドウリサイズイベントの削除
        window.removeEventListener('resize', this.adjustCanvasHeight.bind(this));
    }

    private buildUI(container: Element): void {
        // メインコンテナ
        const mainContainer = container.createEl('div', { cls: 'postodo-main-container' });
        
        // コントロールパネル
        const controlsEl = mainContainer.createEl('div', { cls: 'postodo-controls' });
        
        // 入力フィールド
        this.inputEl = controlsEl.createEl('input', {
            type: 'text',
            placeholder: 'Enter note content...',
            cls: 'postodo-input'
        });

        // 追加ボタン
        const addBtn = controlsEl.createEl('button', {
            text: 'Add Note',
            cls: 'postodo-add-btn'
        });

        // クリアボタン
        const clearBtn = controlsEl.createEl('button', {
            text: 'Clear All',
            cls: 'postodo-clear-btn'
        });

        // キャンバス
        this.canvasEl = mainContainer.createEl('div', { cls: 'postodo-canvas' });

        // イベントリスナーの設定
        this.setupUIEventListeners(addBtn, clearBtn);
    }

    private setupUIEventListeners(addBtn: HTMLButtonElement, clearBtn: HTMLButtonElement): void {
        // 追加ボタン
        addBtn.addEventListener('click', async () => {
            await this.createNote();
        });

        // Enterキーでの追加
        this.inputEl.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await this.createNote();
            }
        });

        // クリアボタン
        clearBtn.addEventListener('click', async () => {
            await this.clearAllNotes();
        });

        // キャンバスクリック（ドラッグ直後のクリックは無視）
        this.canvasEl.addEventListener('click', (e) => {
            if (e.target === this.canvasEl && Date.now() - this.lastDragEndTime > 100) {
                this.createNoteAtPosition(e.offsetX, e.offsetY);
            }
        });
    }

    private setupEventListeners(): void {
        const eventBus = this.container.resolve<IEventBus>(SERVICE_TOKENS.EVENT_BUS);
        
        // データマネージャーからのイベントを監視（外部からの変更のみ）
        this.dataManager.onNoteCreated((note) => {
            // 外部からの作成の場合のみ処理（通常の作成は直接制御）
            if (!this.notes.some(n => n.id === note.id)) {
                this.renderNote(note);
                this.notes.push(note);
            }
        });

        this.dataManager.onNoteUpdated((note) => {
            this.updateNoteElement(note);
        });

        this.dataManager.onNoteDeleted((id) => {
            this.removeNoteElement(id);
        });

        // 設定変更のイベントを監視
        eventBus.on('max-notes-changed', (event: any) => {
            if (event?.maxNotes !== undefined) {
                this.handleMaxNotesChange(event.maxNotes);
            }
        });

        eventBus.on('max-rendered-notes-changed', (event: any) => {
            if (event?.maxRenderedNotes !== undefined) {
                this.handleMaxRenderedNotesChange(event.maxRenderedNotes);
            }
        });

        eventBus.on('save-interval-changed', (event: any) => {
            if (event?.saveInterval !== undefined) {
                this.handleSaveIntervalChange(event.saveInterval);
            }
        });

        // 同期状態の監視
        eventBus.on('note-sync-status', (event: any) => {
            if (event?.noteId && event?.status) {
                this.handleSyncStatusChange(event.noteId, event.status);
            }
        });

        // 外部変更の監視
        eventBus.on('note-externally-modified', (event: any) => {
            if (event?.noteId && event?.newNote) {
                this.handleExternalModification(event.noteId, event.newNote);
            }
        });
    }

    private async loadNotes(): Promise<void> {
        const result = await this.dataManager.getAllNotes();
        if (result.success) {
            this.notes = result.data;
            this.renderAllNotes();
        }
    }

    private async createNote(): Promise<void> {
        const content = this.inputEl.value.trim();
        if (!content) {
            this.feedbackSystem?.showWarning('付箋の内容を入力してください');
            return;
        }

        // UI側でも事前バリデーション
        const validation = NoteValidator.validateContent(content);
        if (!validation.valid) {
            this.feedbackSystem?.showError(validation.error!);
            return;
        }

        const result = await this.dataManager.createNote({
            content,
            position: {
                x: Math.random() * (this.canvasEl.offsetWidth - 200),
                y: Math.random() * (this.canvasEl.offsetHeight - 180),
                zIndex: 1
            }
        });

        if (result.success) {
            this.inputEl.value = '';
            this.notes.push(result.data);
            // アニメーションのみ実行
            this.feedbackSystem?.showNoteCreated(result.data);
            // 通知を一度だけ表示
            this.feedbackSystem?.showSuccess('付箋を作成しました');
        } else {
            this.handleError(result.error, 'createNote');
        }
    }

    private async createNoteAtPosition(x: number, y: number): Promise<void> {
        const result = await this.dataManager.createNote({
            content: 'New note',
            position: { x, y, zIndex: 1 }
        });

        if (result.success) {
            this.notes.push(result.data);
            // アニメーションのみ実行
            this.feedbackSystem?.showNoteCreated(result.data);
            // 通知を一度だけ表示
            this.feedbackSystem?.showSuccess('付箋を作成しました');
        } else {
            this.handleError(result.error, 'createNoteAtPosition');
        }
    }

    private async clearAllNotes(): Promise<void> {
        const noteCount = this.notes.length;
        
        for (const note of this.notes) {
            await this.dataManager.deleteNote(note.id);
        }
        
        this.notes = [];
        this.canvasEl.empty();
        
        // 一括削除の場合は一つの通知のみ
        if (noteCount > 0) {
            this.feedbackSystem?.showSuccess(`${noteCount}個の付箋を削除しました`);
        }
    }

    private renderAllNotes(): void {
        this.canvasEl.empty();
        this.notes.forEach(note => {
            this.renderNote(note);
        });
    }

    private renderNote(note: StickyNote): void {
        const noteEl = this.canvasEl.createEl('div', {
            cls: 'sticky-note',
            attr: {
                'data-note-id': note.id
            }
        });

        // スタイリング
        noteEl.style.position = 'absolute';
        noteEl.style.left = `${note.position.x}px`;
        noteEl.style.top = `${note.position.y}px`;
        noteEl.style.width = `${note.dimensions.width}px`;
        noteEl.style.height = `${note.dimensions.height}px`;
        noteEl.style.backgroundColor = this.getColorValue(note.appearance.color);
        noteEl.style.zIndex = note.position.zIndex.toString();

        // コンテンツ
        const contentEl = noteEl.createEl('div', {
            cls: 'note-content',
            text: note.content
        });

        // 削除ボタン
        const deleteBtn = noteEl.createEl('button', {
            cls: 'note-delete-btn',
            text: '×'
        });

        // イベントリスナー
        this.setupNoteEventListeners(noteEl, note, contentEl, deleteBtn);
    }

    private setupNoteEventListeners(
        noteEl: HTMLElement,
        note: StickyNote,
        contentEl: HTMLElement,
        deleteBtn: HTMLButtonElement
    ): void {
        // シンプルドラッグハンドラーの設定
        const dragHandler = new SimpleDragHandler(this.dataManager);
        dragHandler.setupDragHandlers(noteEl, note, this.canvasEl, (timestamp) => {
            this.lastDragEndTime = timestamp;
        });
        this.dragHandlers.set(note.id, dragHandler);

        // 編集機能
        contentEl.addEventListener('dblclick', () => {
            this.editNote(note, contentEl);
        });

        // 削除機能
        deleteBtn.addEventListener('click', async () => {
            await this.deleteNote(note.id);
        });
    }

    private editNote(note: StickyNote, contentEl: HTMLElement): void {
        const input = document.createElement('textarea');
        input.value = note.content;
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.resize = 'none';
        
        contentEl.replaceWith(input);
        input.focus();
        
        const saveEdit = async () => {
            const newContent = input.value.trim();
            
            // バリデーション
            const validation = NoteValidator.validateContent(newContent);
            if (!validation.valid) {
                this.feedbackSystem?.showError(validation.error!);
                return;
            }
            
            if (newContent !== note.content) {
                const result = await this.dataManager.updateNote(note.id, { content: newContent });
                if (!result.success) {
                    this.handleError(result.error, 'updateNote');
                    return;
                }
            }
            
            const newContentEl = document.createElement('div');
            newContentEl.className = 'note-content';
            newContentEl.textContent = newContent;
            input.replaceWith(newContentEl);
            
            // 新しい要素にイベントリスナーを再設定
            newContentEl.addEventListener('dblclick', () => {
                this.editNote({ ...note, content: newContent }, newContentEl);
            });
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                saveEdit();
            }
        });
    }

    private async deleteNote(noteId: string): Promise<void> {
        // ドラッグハンドラーのクリーンアップ
        const dragHandler = this.dragHandlers.get(noteId);
        if (dragHandler) {
            dragHandler.cleanup();
            this.dragHandlers.delete(noteId);
        }
        
        const result = await this.dataManager.deleteNote(noteId);
        if (result.success) {
            this.notes = this.notes.filter(note => note.id !== noteId);
            // アニメーションのみ実行
            this.feedbackSystem?.showNoteDeleted(noteId);
            // 通知を一度だけ表示
            this.feedbackSystem?.showSuccess('付箋を削除しました');
        } else {
            this.handleError(result.error, 'deleteNote');
        }
    }

    private updateNoteElement(note: StickyNote): void {
        const noteEl = this.canvasEl.querySelector(`[data-note-id="${note.id}"]`) as HTMLElement;
        if (!noteEl) return;

        // 位置の更新
        noteEl.style.left = `${note.position.x}px`;
        noteEl.style.top = `${note.position.y}px`;

        // コンテンツの更新
        const contentEl = noteEl.querySelector('.note-content') as HTMLElement;
        if (contentEl) {
            contentEl.textContent = note.content;
        }
    }

    private removeNoteElement(noteId: string): void {
        const noteEl = this.canvasEl.querySelector(`[data-note-id="${noteId}"]`);
        if (noteEl) {
            noteEl.remove();
        }
    }

    private getColorValue(color: string): string {
        const colorMap = {
            yellow: '#ffeb3b',
            pink: '#f8bbd9',
            blue: '#90caf9',
            green: '#a5d6a7',
            orange: '#ffcc80',
            purple: '#ce93d8'
        };
        
        return colorMap[color as keyof typeof colorMap] || colorMap.yellow;
    }

    private handleError(error: Error | undefined, action: string): void {
        if (!error) return;
        
        let userMessage = 'エラーが発生しました';
        if (error instanceof PostodoError) {
            userMessage = error.userMessage;
        }
        
        this.feedbackSystem?.showError(userMessage);
        
        // エラーの詳細ログ
        console.error(`PostodoView error in ${action}:`, error);
    }

    private handleMaxNotesChange(maxNotes: number): void {
        // 最大付箋数の変更に応じた処理
        if (this.notes.length > maxNotes) {
            this.feedbackSystem?.showWarning(`最大付箋数が${maxNotes}に変更されました`);
            // 古い付箋から削除することもできますが、ここでは警告のみ
        }
    }

    private handleMaxRenderedNotesChange(maxRenderedNotes: number): void {
        // 最大描画数の変更に応じた処理
        this.feedbackSystem?.showInfo(`最大描画数が${maxRenderedNotes}に変更されました`);
        // 描画の最適化を再実行
        this.optimizeRendering();
    }

    private handleSaveIntervalChange(saveInterval: number): void {
        // 保存間隔の変更に応じた処理
        this.feedbackSystem?.showInfo(`保存間隔が${saveInterval}msに変更されました`);
        // 自動保存タイマーの再設定（今後の実装）
    }

    private optimizeRendering(): void {
        // 描画の最適化処理
        // 現在は基本的な実装のみ
        const visibleNotes = this.notes.slice(0, 100); // 仮の最大値
        
        // 表示範囲外の付箋を非表示にする
        this.notes.forEach((note, index) => {
            const noteEl = this.canvasEl.querySelector(`[data-note-id="${note.id}"]`) as HTMLElement;
            if (noteEl) {
                if (index < 100) {
                    noteEl.style.display = 'block';
                } else {
                    noteEl.style.display = 'none';
                }
            }
        });
    }

    private handleSyncStatusChange(noteId: string, status: 'syncing' | 'synced' | 'error'): void {
        const noteEl = this.canvasEl.querySelector(`[data-note-id="${noteId}"]`) as HTMLElement;
        if (!noteEl) return;

        // 同期状態の視覚的表示
        noteEl.classList.remove('sync-status-syncing', 'sync-status-synced', 'sync-status-error');
        noteEl.classList.add(`sync-status-${status}`);

        // 同期状態インジケーターの更新
        this.updateSyncIndicator(noteEl, status);

        // フィードバックシステムによる通知
        this.feedbackSystem?.showSyncStatus(status);
    }

    private updateSyncIndicator(noteEl: HTMLElement, status: 'syncing' | 'synced' | 'error'): void {
        let indicator = noteEl.querySelector('.sync-indicator') as HTMLElement;
        if (!indicator) {
            indicator = noteEl.createEl('div', { cls: 'sync-indicator' });
            noteEl.appendChild(indicator);
        }

        indicator.className = `sync-indicator sync-indicator--${status}`;
        
        const symbols = {
            syncing: '🔄',
            synced: '✅',
            error: '❌'
        };
        
        indicator.textContent = symbols[status];
        indicator.title = `同期状態: ${status}`;
    }

    private handleExternalModification(noteId: string, newNote: StickyNote): void {
        // 外部からの変更を UI に反映
        this.updateNoteElement(newNote);
        
        // 通知
        this.feedbackSystem?.showWarning('付箋が外部で変更されました');
        
        // ノートリストの更新
        const noteIndex = this.notes.findIndex(note => note.id === noteId);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = newNote;
        }
    }

    private adjustCanvasHeight(): void {
        if (!this.canvasEl) return;
        
        // ウィンドウの高さを取得
        const windowHeight = window.innerHeight;
        
        // コントロールパネルの高さを考慮
        const controlsHeight = 60; // 概算値
        
        // 最小高さを設定（スクロール可能）
        const minHeight = Math.max(800, windowHeight - controlsHeight - 100);
        
        this.canvasEl.style.minHeight = `${minHeight}px`;
        this.canvasEl.style.height = 'auto';
    }
}