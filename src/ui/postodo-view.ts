import { ItemView, WorkspaceLeaf, Menu, Platform } from 'obsidian';
import { DIContainer } from '../core/container';
import { DataManager } from '../implementations/data/data-manager';
import { StickyNote, NoteColor, NoteSize } from '../types/core-types';
import { SERVICE_TOKENS } from '../types/core-types';
import { SimpleDragHandler } from './simple-drag-handler';
import { FeedbackSystem } from './feedback-system';
import { NoteValidator } from '../utils/validators';
import { ErrorHandler, PostodoError } from '../utils/error-handler';
import { IEventBus } from '../core/event-bus';
import { PostodoNoteDetector } from '../utils/postodo-note-detector';
import { DisplayFilter } from '../implementations/ui/display-filter';
import { DisplayFilterType } from '../interfaces/ui/i-display-filter';
import { ConfigProvider } from '../providers/config-provider';
import { getTranslations, Language, Translations } from '../i18n/translations';

export class PostodoView extends ItemView {
    private dataManager: DataManager;
    private canvasEl!: HTMLElement;
    private inputEl!: HTMLInputElement;
    private filterSelectEl!: HTMLSelectElement;
    private notes: StickyNote[] = [];
    private dragHandlers = new Map<string, SimpleDragHandler>();
    private feedbackSystem!: FeedbackSystem;
    private errorHandler: ErrorHandler;
    private lastDragEndTime = 0;
    private displayFilter: DisplayFilter;
    private filterUnsubscribe?: () => void;

    constructor(leaf: WorkspaceLeaf, private container: DIContainer) {
        super(leaf);
        this.dataManager = container.resolve<DataManager>(SERVICE_TOKENS.DATA_MANAGER);
        this.errorHandler = ErrorHandler.getInstance(container.resolve(SERVICE_TOKENS.EVENT_BUS));
        
        // 設定からデフォルト表示フィルターを取得
        const configProvider = container.resolve<ConfigProvider>(SERVICE_TOKENS.CONFIG);
        const defaultFilter = configProvider.get<DisplayFilterType>('defaultDisplayFilter') || 'incomplete';
        
        // DisplayFilterの初期化（設定のデフォルトフィルターを使用）
        this.displayFilter = new DisplayFilter(defaultFilter);
        
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
        
        // DisplayFilterのクリーンアップ
        if (this.filterUnsubscribe) {
            this.filterUnsubscribe();
        }
        this.displayFilter.cleanup();
        
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

        // フィルターコントロール
        const filterContainer = controlsEl.createEl('div', { cls: 'postodo-filter-container' });
        const filterLabel = filterContainer.createEl('label', {
            text: 'フィルター: ',
            cls: 'postodo-filter-label'
        });
        
        this.filterSelectEl = filterContainer.createEl('select', {
            cls: 'postodo-filter-select'
        });
        
        // フィルターオプションを追加
        const filterOptions: { value: DisplayFilterType; label: string }[] = [
            { value: 'incomplete', label: '未完了のみ' },
            { value: 'complete', label: '完了のみ' },
            { value: 'all', label: 'すべて' }
        ];
        
        filterOptions.forEach(option => {
            const optionEl = this.filterSelectEl.createEl('option', {
                value: option.value,
                text: option.label
            });
            if (option.value === this.displayFilter.currentFilter) {
                optionEl.selected = true;
            }
        });

        // キャンバス
        this.canvasEl = mainContainer.createEl('div', { cls: 'postodo-canvas' });

        // イベントリスナーの設定
        this.setupUIEventListeners(addBtn);
    }

    private setupUIEventListeners(addBtn: HTMLButtonElement): void {
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

        // キャンバスクリック（ドラッグ直後のクリックは無視）
        this.canvasEl.addEventListener('click', (e) => {
            if (e.target === this.canvasEl && Date.now() - this.lastDragEndTime > 100) {
                this.createNoteAtPosition(e.offsetX, e.offsetY);
            }
        });

        // フィルター変更
        this.filterSelectEl.addEventListener('change', () => {
            const newFilter = this.filterSelectEl.value as DisplayFilterType;
            this.displayFilter.setFilter(newFilter);
        });

        // フィルター変更時の再描画
        this.filterUnsubscribe = this.displayFilter.onFilterChanged(() => {
            this.renderAllNotes();
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
            console.log(`[DEBUG] PostodoView: Note updated event for ${note.id}, completed: ${note.completed}`);
            
            // 編集中の場合は外部変更を無視
            if (this.dataManager.isNoteBeingEdited(note.id)) {
                console.log(`[DEBUG] PostodoView: Note ${note.id} is being edited, ignoring external update`);
                return;
            }
            
            // ローカルの状態を更新
            const noteIndex = this.notes.findIndex(n => n.id === note.id);
            if (noteIndex !== -1) {
                this.notes[noteIndex] = note;
            } else {
                this.notes.push(note);
            }
            
            // DisplayFilterを使用して表示を更新
            const shouldShow = this.displayFilter.shouldDisplay(note);
            const existingElement = this.canvasEl.querySelector(`[data-note-id="${note.id}"]`);
            
            if (shouldShow) {
                if (existingElement) {
                    // 既に表示されている場合は更新
                    console.log(`[DEBUG] PostodoView: Updating existing note ${note.id}`);
                    this.updateNoteElement(note);
                } else {
                    // 表示されていない場合は新しく描画
                    console.log(`[DEBUG] PostodoView: Rendering note ${note.id}`);
                    this.renderNote(note);
                }
            } else {
                // フィルターにより非表示にする
                if (existingElement) {
                    console.log(`[DEBUG] PostodoView: Hiding note ${note.id} due to filter`);
                    this.hideNoteElement(note.id);
                }
            }
        });

        this.dataManager.onNoteDeleted((id) => {
            console.log(`[DEBUG] PostodoView: Note deleted event for ${id}`);
            this.notes = this.notes.filter(n => n.id !== id);
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

        // デフォルト表示フィルター設定変更の監視
        eventBus.on('default-display-filter-changed', (event: any) => {
            if (event?.filter) {
                this.handleDefaultDisplayFilterChange(event.filter);
            }
        });

        // 命名戦略設定変更の監視
        eventBus.on('naming-strategy-changed', (event: any) => {
            if (event?.strategy) {
                this.handleNamingStrategyChange(event.strategy);
            }
        });
    }

    private async loadNotes(): Promise<void> {
        console.log('[DEBUG] PostodoView: Loading notes...');
        const result = await this.dataManager.getAllNotes();
        if (result.success) {
            console.log(`[DEBUG] PostodoView: Loaded ${result.data.length} notes`);
            this.notes = result.data;
            this.renderAllNotes();
        } else {
            console.error('[DEBUG] PostodoView: Failed to load notes:', result.error);
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
            // 付箋をキャンバスに描画（強制描画）
            this.renderNote(result.data, true);
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
            // 付箋をキャンバスに描画（強制描画）
            this.renderNote(result.data, true);
            // アニメーションのみ実行
            this.feedbackSystem?.showNoteCreated(result.data);
            // 通知を一度だけ表示
            this.feedbackSystem?.showSuccess('付箋を作成しました');
        } else {
            this.handleError(result.error, 'createNoteAtPosition');
        }
    }

    private async toggleNoteCompletion(noteId: string): Promise<void> {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const newCompleted = !note.completed;
        
        const result = await this.dataManager.updateNote(noteId, { completed: newCompleted });
        
        if (result.success) {
            // ローカルの状態を更新
            const noteIndex = this.notes.findIndex(n => n.id === noteId);
            if (noteIndex !== -1) {
                this.notes[noteIndex] = { ...this.notes[noteIndex], completed: newCompleted };
                
                // DisplayFilterを使用して表示を更新
                const shouldShow = this.displayFilter.shouldDisplay(this.notes[noteIndex]);
                const existingElement = this.canvasEl.querySelector(`[data-note-id="${noteId}"]`);
                
                if (shouldShow) {
                    if (existingElement) {
                        // 既に表示されている場合は更新
                        this.updateNoteElement(this.notes[noteIndex]);
                    } else {
                        // 表示されていない場合は新しく描画
                        this.renderNote(this.notes[noteIndex]);
                    }
                } else {
                    // フィルターにより非表示にする
                    if (existingElement) {
                        this.hideNoteElement(noteId);
                    }
                }
            }
            
            // 通知を表示
            const statusText = newCompleted ? '完了' : '未完了';
            this.feedbackSystem?.showSuccess(`付箋を${statusText}にしました`);
        } else {
            this.handleError(result.error, 'toggleNoteCompletion');
        }
    }


    private renderAllNotes(): void {
        console.log(`[DEBUG] PostodoView: Rendering ${this.notes.length} notes with filter: ${this.displayFilter.currentFilter}`);
        this.canvasEl.empty();
        
        // 全てのドラッグハンドラーをクリーンアップ
        this.dragHandlers.forEach(handler => handler.cleanup());
        this.dragHandlers.clear();
        
        // DisplayFilterを使用して表示する付箋をフィルタリング
        const notesToShow = this.notes.filter(note => this.displayFilter.shouldDisplay(note));
        console.log(`[DEBUG] PostodoView: Showing ${notesToShow.length} notes after filtering`);
        
        notesToShow.forEach(note => {
            this.renderNote(note);
        });
    }

    private renderNote(note: StickyNote, forceRender: boolean = false): void {
        const existingEl = this.canvasEl.querySelector(`[data-note-id="${note.id}"]`);
        
        if (existingEl && !forceRender) {
            // 強制描画でない場合は更新のみ
            console.log(`[DEBUG] Note ${note.id} already rendered, updating instead`);
            this.updateNoteElement(note);
            return;
        } else if (existingEl && forceRender) {
            // 強制描画の場合は既存要素を削除してから新規作成
            console.log(`[DEBUG] Force rendering note ${note.id}, removing existing element`);
            this.removeNoteElement(note.id);
        }

        // 必要なプロパティのバリデーション
        if (!note.position || typeof note.position.x !== 'number' || typeof note.position.y !== 'number') {
            console.error('Cannot render note with invalid position:', note.position, 'for note:', note.id);
            return;
        }
        if (!note.dimensions || typeof note.dimensions.width !== 'number' || typeof note.dimensions.height !== 'number') {
            console.error('Cannot render note with invalid dimensions:', note.dimensions, 'for note:', note.id);
            return;
        }
        if (!note.appearance || !note.appearance.color) {
            console.error('Cannot render note with invalid appearance:', note.appearance, 'for note:', note.id);
            return;
        }

        const isTaskNote = PostodoNoteDetector.isTaskNote(note);
        const noteEl = this.canvasEl.createEl('div', {
            cls: `sticky-note ${note.completed ? 'completed' : 'pending'} ${isTaskNote ? 'task-note' : 'regular-note'}`,
            attr: {
                'data-note-id': note.id
            }
        });

        // ツールチップにファイル名を設定
        const filename = note.filePath.split('/').pop() || note.filePath;
        noteEl.title = this.t('tooltip.filename').replace('{filename}', filename);

        // スタイリング
        noteEl.style.position = 'absolute';
        noteEl.style.left = `${note.position.x}px`;
        noteEl.style.top = `${note.position.y}px`;
        noteEl.style.width = `${note.dimensions.width}px`;
        noteEl.style.height = `${note.dimensions.height}px`;
        noteEl.style.backgroundColor = this.getColorValue(note.appearance.color);
        noteEl.style.zIndex = note.position.zIndex.toString();

        // タスクノートの場合は特別なスタイル
        if (isTaskNote) {
            noteEl.style.border = '2px solid #4CAF50';
            noteEl.style.borderRadius = '8px';
        }

        // 完了状態の場合は透明度を下げる
        if (note.completed) {
            noteEl.style.opacity = '0.6';
        }

        // タスクヘッダー（タスクノートの場合のみ）
        if (isTaskNote) {
            this.createTaskHeader(noteEl, note);
        }

        // コンテンツ（タイトル欄は削除）
        const contentEl = noteEl.createEl('div', {
            cls: isTaskNote ? 'task-content' : 'note-content'
        });
        
        // タスクノートの場合はフォーマット済みコンテンツを使用
        const displayContent = isTaskNote ? PostodoNoteDetector.formatTaskContent(note) : note.content;
        contentEl.textContent = displayContent;

        // 完了状態の場合は取り消し線を追加
        if (note.completed) {
            contentEl.style.textDecoration = 'line-through';
        }

        // チェックボックス
        const checkboxEl = noteEl.createEl('input', {
            type: 'checkbox',
            cls: isTaskNote ? 'task-checkbox' : 'note-checkbox'
        });
        checkboxEl.checked = note.completed;
        const t = this.getTranslations();
        checkboxEl.title = note.completed ? t.actionBar.complete : t.actionBar.incomplete;

        // アクションバー（チェックボックスのみ - 削除ボタンは右クリックメニューに移動）
        const actionsEl = noteEl.createEl('div', { cls: 'note-actions' });
        actionsEl.appendChild(checkboxEl);

        // イベントリスナー
        this.setupNoteEventListeners(noteEl, note, contentEl, checkboxEl);
    }

    private createTaskHeader(noteEl: HTMLElement, note: StickyNote): void {
        const taskInfo = note.metadata.taskInfo;
        if (!taskInfo) return;

        const headerEl = noteEl.createEl('div', { cls: 'task-header' });
        
        // 優先度インジケーター
        if (taskInfo.priority) {
            const priorityEl = headerEl.createEl('span', { cls: `task-priority priority-${taskInfo.priority}` });
            const priorityEmoji = {
                'highest': '⏫',
                'high': '🔼',
                'low': '🔽'
            }[taskInfo.priority];
            priorityEl.textContent = priorityEmoji;
            priorityEl.title = `優先度: ${taskInfo.priority}`;
        }

        // 期日インジケーター
        if (taskInfo.dueDate) {
            const dueDateEl = headerEl.createEl('span', { cls: 'task-due-date' });
            dueDateEl.textContent = `📅 ${taskInfo.dueDate}`;
            dueDateEl.title = `期日: ${taskInfo.dueDate}`;
            
            // 期日が近い場合は警告色
            const dueDate = new Date(taskInfo.dueDate);
            const today = new Date();
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 0) {
                dueDateEl.classList.add('overdue');
            } else if (diffDays <= 3) {
                dueDateEl.classList.add('due-soon');
            }
        }

        // 繰り返しインジケーター
        if (taskInfo.recurrence) {
            const recurrenceEl = headerEl.createEl('span', { cls: 'task-recurrence' });
            recurrenceEl.textContent = `🔁 ${taskInfo.recurrence}`;
            recurrenceEl.title = `繰り返し: ${taskInfo.recurrence}`;
        }
    }

    private setupNoteEventListeners(
        noteEl: HTMLElement,
        note: StickyNote,
        contentEl: HTMLElement,
        checkboxEl: HTMLInputElement
    ): void {
        // 既存のドラッグハンドラーをクリーンアップ
        const existingHandler = this.dragHandlers.get(note.id);
        if (existingHandler) {
            existingHandler.cleanup();
        }

        // シンプルドラッグハンドラーの設定
        const dragHandler = new SimpleDragHandler(this.dataManager);
        dragHandler.setupDragHandlers(noteEl, note, this.canvasEl, (timestamp) => {
            this.lastDragEndTime = timestamp;
        });
        this.dragHandlers.set(note.id, dragHandler);

        // 右クリックコンテキストメニュー
        noteEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentNote = this.notes.find(n => n.id === note.id);
            if (currentNote) {
                this.showContextMenu(currentNote, e);
            }
        });

        // モバイル長押し対応
        this.setupLongPressHandler(noteEl, note);

        // 編集機能（ダブルクリック）
        contentEl.addEventListener('dblclick', () => {
            console.log(`[DEBUG] PostodoView: Double-click edit triggered for note ${note.id}`);
            const currentNote = this.notes.find(n => n.id === note.id);
            if (!currentNote) {
                console.log(`[DEBUG] PostodoView: Note ${note.id} not found in local notes`);
                return;
            }
            
            this.editNote(currentNote, contentEl);
        });

        // 完了状態切り替え機能
        checkboxEl.addEventListener('change', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await this.toggleNoteCompletion(note.id);
        });
    }

    // モバイル長押しハンドラー
    private setupLongPressHandler(noteEl: HTMLElement, note: StickyNote): void {
        let longPressTimer: number | null = null;
        let touchMoved = false;

        noteEl.addEventListener('touchstart', (e) => {
            touchMoved = false;
            longPressTimer = window.setTimeout(() => {
                if (!touchMoved) {
                    const currentNote = this.notes.find(n => n.id === note.id);
                    if (currentNote) {
                        this.showContextMenu(currentNote, e);
                    }
                }
            }, 500);
        }, { passive: true });

        noteEl.addEventListener('touchmove', () => {
            touchMoved = true;
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }, { passive: true });

        noteEl.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }, { passive: true });
    }

    // コンテキストメニューの表示
    private showContextMenu(note: StickyNote, event: MouseEvent | TouchEvent): void {
        const menu = new Menu();
        const t = this.getTranslations();

        // ノートを開く
        menu.addItem((item) => {
            item.setTitle(t.contextMenu.openNote)
                .setIcon('file-text')
                .onClick(async () => {
                    await this.openNoteFile(note);
                });
        });

        // 編集
        menu.addItem((item) => {
            item.setTitle(t.contextMenu.edit)
                .setIcon('pencil')
                .onClick(() => {
                    const noteEl = this.canvasEl.querySelector(`[data-note-id="${note.id}"]`);
                    const contentEl = noteEl?.querySelector('.note-content, .task-content') as HTMLElement;
                    if (contentEl) {
                        this.editNote(note, contentEl);
                    }
                });
        });

        menu.addSeparator();

        // 色を変更（サブメニュー）
        menu.addItem((item) => {
            item.setTitle(t.contextMenu.changeColor)
                .setIcon('palette');
            
            const submenu = (item as any).setSubmenu();
            const colors: { key: keyof typeof t.contextMenu.colors; value: NoteColor }[] = [
                { key: 'yellow', value: 'yellow' },
                { key: 'pink', value: 'pink' },
                { key: 'blue', value: 'blue' },
                { key: 'green', value: 'green' },
                { key: 'orange', value: 'orange' },
                { key: 'purple', value: 'purple' },
            ];
            
            colors.forEach(({ key, value }) => {
                submenu.addItem((subItem: any) => {
                    subItem.setTitle(t.contextMenu.colors[key])
                        .onClick(async () => {
                            await this.changeNoteColor(note.id, value);
                        });
                });
            });
        });

        // サイズ変更（サブメニュー）
        menu.addItem((item) => {
            item.setTitle(t.contextMenu.changeSize)
                .setIcon('maximize');
            
            const submenu = (item as any).setSubmenu();
            const sizes: { key: keyof typeof t.contextMenu.sizes; value: NoteSize }[] = [
                { key: 'small', value: 'small' },
                { key: 'medium', value: 'medium' },
                { key: 'large', value: 'large' },
            ];
            
            sizes.forEach(({ key, value }) => {
                submenu.addItem((subItem: any) => {
                    subItem.setTitle(t.contextMenu.sizes[key])
                        .onClick(async () => {
                            await this.changeNoteSize(note.id, value);
                        });
                });
            });
        });

        menu.addSeparator();

        // 完了/未完了
        menu.addItem((item) => {
            const title = note.completed ? t.contextMenu.markIncomplete : t.contextMenu.markComplete;
            item.setTitle(title)
                .setIcon(note.completed ? 'circle' : 'check-circle')
                .onClick(async () => {
                    await this.toggleNoteCompletion(note.id);
                });
        });

        menu.addSeparator();

        // ファイル名をコピー
        menu.addItem((item) => {
            item.setTitle(t.contextMenu.copyFilename)
                .setIcon('copy')
                .onClick(async () => {
                    await this.copyFilename(note);
                });
        });

        // 削除
        menu.addItem((item) => {
            item.setTitle(t.contextMenu.delete)
                .setIcon('trash')
                .onClick(async () => {
                    await this.deleteNote(note.id);
                });
        });

        // メニューを表示
        if (event instanceof MouseEvent) {
            menu.showAtMouseEvent(event);
        } else {
            // タッチイベントの場合
            const touch = event.touches[0] || event.changedTouches[0];
            menu.showAtPosition({ x: touch.clientX, y: touch.clientY });
        }
    }

    // ノートファイルを開く
    private async openNoteFile(note: StickyNote): Promise<void> {
        try {
            const file = this.app.vault.getAbstractFileByPath(note.filePath);
            if (file) {
                await this.app.workspace.openLinkText(note.filePath, '', false);
            } else {
                this.feedbackSystem?.showError('ファイルが見つかりません');
            }
        } catch (error) {
            console.error('Failed to open note file:', error);
            this.feedbackSystem?.showError('ファイルを開けませんでした');
        }
    }

    // 色を変更
    private async changeNoteColor(noteId: string, color: NoteColor): Promise<void> {
        const result = await this.dataManager.updateNote(noteId, {
            appearance: { color }
        });
        
        if (result.success) {
            const noteIndex = this.notes.findIndex(n => n.id === noteId);
            if (noteIndex !== -1) {
                this.notes[noteIndex] = result.data;
                this.updateNoteElement(result.data);
            }
            this.feedbackSystem?.showSuccess('色を変更しました');
        } else {
            this.handleError(result.error, 'changeNoteColor');
        }
    }

    // サイズを変更
    private async changeNoteSize(noteId: string, size: NoteSize): Promise<void> {
        const sizeMap = {
            small: { width: 150, height: 150 },
            medium: { width: 200, height: 180 },
            large: { width: 250, height: 220 }
        };
        
        const dimensions = sizeMap[size];
        const result = await this.dataManager.updateNote(noteId, {
            dimensions,
            appearance: { size }
        });
        
        if (result.success) {
            const noteIndex = this.notes.findIndex(n => n.id === noteId);
            if (noteIndex !== -1) {
                this.notes[noteIndex] = result.data;
                this.updateNoteElement(result.data);
            }
            this.feedbackSystem?.showSuccess('サイズを変更しました');
        } else {
            this.handleError(result.error, 'changeNoteSize');
        }
    }

    // ファイル名をコピー
    private async copyFilename(note: StickyNote): Promise<void> {
        try {
            const filename = note.filePath.split('/').pop() || note.filePath;
            await navigator.clipboard.writeText(filename);
            this.feedbackSystem?.showSuccess('ファイル名をコピーしました');
        } catch (error) {
            console.error('Failed to copy filename:', error);
            this.feedbackSystem?.showError('コピーに失敗しました');
        }
    }

    // 翻訳を取得
    private getTranslations(): Translations {
        return getTranslations(this.getLanguage());
    }

    // 翻訳キーを取得（テンプレート用）
    private t(key: string): string {
        const translations = this.getTranslations();
        const keys = key.split('.');
        let value: any = translations;
        for (const k of keys) {
            value = value?.[k];
        }
        return value || key;
    }

    // 言語を取得
    private getLanguage(): Language {
        const locale = window.localStorage.getItem('language') || 'en';
        return locale.startsWith('ja') ? 'ja' : 'en';
    }


    private editNote(note: StickyNote, contentEl: HTMLElement): void {
        console.log(`[DEBUG] PostodoView: Starting edit for note ${note.id}, content: "${note.content}"`);
        // 編集状態を設定
        this.dataManager.setNoteEditing(note.id, true);
        
        const input = document.createElement('textarea');
        input.value = note.content;
        input.style.width = '100%';
        input.style.height = '100%';
        input.style.border = '2px solid #4a90d9';
        input.style.borderRadius = '4px';
        input.style.background = 'rgba(255, 255, 255, 0.9)';
        input.style.color = '#333';
        input.style.resize = 'none';
        input.style.padding = '4px';
        input.style.fontSize = '14px';
        input.style.fontFamily = 'inherit';
        input.style.outline = 'none';
        
        contentEl.replaceWith(input);
        input.focus();
        
        const saveEdit = async () => {
            const newContent = input.value.trim();
            console.log(`[DEBUG] PostodoView: Saving edit for note ${note.id}: "${note.content}" -> "${newContent}"`);
            
            // バリデーション
            const validation = NoteValidator.validateContent(newContent);
            if (!validation.valid) {
                this.feedbackSystem?.showError(validation.error!);
                return;
            }
            
            // UI更新を先に実行
            const newContentEl = document.createElement('div');
            newContentEl.className = 'note-content';
            newContentEl.textContent = newContent;
            input.replaceWith(newContentEl);
            
            // 新しい要素にイベントリスナーを再設定
            newContentEl.addEventListener('dblclick', () => {
                this.editNote({ ...note, content: newContent }, newContentEl);
            });
            
            // ローカル状態を先に更新
            const noteIndex = this.notes.findIndex(n => n.id === note.id);
            if (noteIndex !== -1) {
                this.notes[noteIndex] = { ...this.notes[noteIndex], content: newContent };
            }
            
            // 内容が変わった場合のみデータ保存
            if (newContent !== note.content) {
                try {
                    const result = await this.dataManager.updateNote(note.id, { content: newContent });
                    if (!result.success) {
                        this.handleError(result.error, 'updateNote');
                        // 保存失敗時は元に戻す
                        newContentEl.textContent = note.content;
                        if (noteIndex !== -1) {
                            this.notes[noteIndex] = { ...this.notes[noteIndex], content: note.content };
                        }
                    }
                } catch (error) {
                    console.error('Save edit error:', error);
                    this.handleError(error as Error, 'saveEdit');
                }
            }
            
            // 最後に編集状態を解除
            this.dataManager.setNoteEditing(note.id, false);
        };
        
        const cancelEdit = () => {
            // 編集状態を解除
            this.dataManager.setNoteEditing(note.id, false);
            
            const newContentEl = document.createElement('div');
            newContentEl.className = 'note-content';
            newContentEl.textContent = note.content;
            input.replaceWith(newContentEl);
            
            // 新しい要素にイベントリスナーを再設定
            newContentEl.addEventListener('dblclick', () => {
                this.editNote(note, newContentEl);
            });
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                saveEdit();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });
    }


    private updateNoteElement(note: StickyNote): void {
        const noteEl = this.canvasEl.querySelector(`[data-note-id="${note.id}"]`) as HTMLElement;
        if (!noteEl) return;

        // 位置とサイズのバリデーション
        if (!note.position || typeof note.position.x !== 'number' || typeof note.position.y !== 'number') {
            console.error('Invalid note position:', note.position, 'for note:', note.id);
            return;
        }

        // 位置の更新
        noteEl.style.left = `${note.position.x}px`;
        noteEl.style.top = `${note.position.y}px`;

        // サイズの更新
        if (note.dimensions) {
            noteEl.style.width = `${note.dimensions.width}px`;
            noteEl.style.height = `${note.dimensions.height}px`;
        }

        // 色の更新
        if (note.appearance?.color) {
            noteEl.style.backgroundColor = this.getColorValue(note.appearance.color);
        }

        // ツールチップの更新
        const filename = note.filePath.split('/').pop() || note.filePath;
        noteEl.title = this.t('tooltip.filename').replace('{filename}', filename);

        const isTaskNote = PostodoNoteDetector.isTaskNote(note);
        
        // コンテンツの更新
        const contentEl = noteEl.querySelector('.note-content, .task-content') as HTMLElement;
        if (contentEl) {
            const displayContent = isTaskNote ? PostodoNoteDetector.formatTaskContent(note) : note.content;
            contentEl.textContent = displayContent;
        }

        // 完了状態に応じてスタイルを更新
        noteEl.className = `sticky-note ${note.completed ? 'completed' : 'pending'} ${isTaskNote ? 'task-note' : 'regular-note'}`;
        
        if (note.completed) {
            noteEl.style.opacity = '0.6';
            if (contentEl) {
                contentEl.style.textDecoration = 'line-through';
            }
        } else {
            noteEl.style.opacity = '1';
            if (contentEl) {
                contentEl.style.textDecoration = 'none';
            }
        }

        // チェックボックスの更新
        const checkboxEl = noteEl.querySelector('.note-checkbox, .task-checkbox') as HTMLInputElement;
        if (checkboxEl) {
            checkboxEl.checked = note.completed;
            const t = this.getTranslations();
            checkboxEl.title = note.completed ? t.actionBar.complete : t.actionBar.incomplete;
        }

        // タスクヘッダーの更新（タスクノートの場合）
        if (isTaskNote) {
            const headerEl = noteEl.querySelector('.task-header');
            if (headerEl) {
                headerEl.remove();
            }
            this.createTaskHeader(noteEl, note);
        }

        // イベントリスナーは初回レンダリング時のみ設定、更新時は再設定しない
        console.log(`[DEBUG] PostodoView: Updated note element ${note.id} without resetting event listeners`);
    }

    private removeNoteElement(noteId: string): void {
        const noteEl = this.canvasEl.querySelector(`[data-note-id="${noteId}"]`);
        if (noteEl) {
            noteEl.remove();
        }
    }

    private hideNoteElement(noteId: string): void {
        const noteEl = this.canvasEl.querySelector(`[data-note-id="${noteId}"]`) as HTMLElement;
        if (noteEl) {
            // フェードアウトアニメーション
            noteEl.style.transition = 'opacity 0.3s ease';
            noteEl.style.opacity = '0';
            
            setTimeout(() => {
                noteEl.remove();
                
                // ドラッグハンドラーのクリーンアップ
                const dragHandler = this.dragHandlers.get(noteId);
                if (dragHandler) {
                    dragHandler.cleanup();
                    this.dragHandlers.delete(noteId);
                }
            }, 300);
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

    private async deleteNote(noteId: string): Promise<void> {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const result = await this.dataManager.deleteNote(noteId);
        
        if (result.success) {
            // ローカルの状態を更新
            this.notes = this.notes.filter(n => n.id !== noteId);
            
            // UI要素を削除
            this.removeNoteElement(noteId);
            
            // 通知を表示
            this.feedbackSystem?.showSuccess('付箋を削除しました');
        } else {
            this.handleError(result.error, 'deleteNote');
        }
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
        // 通知
        this.feedbackSystem?.showWarning('付箋が外部で変更されました');
        
        // ノートリストの更新
        const noteIndex = this.notes.findIndex(note => note.id === noteId);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = newNote;
        }
        
        // DisplayFilterを使用して表示を更新
        const shouldShow = this.displayFilter.shouldDisplay(newNote);
        const existingElement = this.canvasEl.querySelector(`[data-note-id="${noteId}"]`);
        
        if (shouldShow) {
            if (existingElement) {
                // 既に表示されている場合は更新
                this.updateNoteElement(newNote);
            } else {
                // 表示されていない場合は新しく描画
                this.renderNote(newNote);
            }
        } else {
            // フィルターにより非表示にする
            if (existingElement) {
                this.hideNoteElement(noteId);
            }
        }
    }

    private handleDefaultDisplayFilterChange(filter: DisplayFilterType): void {
        // デフォルト表示フィルターの変更に応じた処理
        console.log(`[DEBUG] PostodoView: Default display filter changed to ${filter}`);
        
        // 現在のフィルターを新しいデフォルトに更新
        this.displayFilter.setFilter(filter);
        
        // フィルターセレクトボックスの値を更新
        if (this.filterSelectEl) {
            this.filterSelectEl.value = filter;
        }
        
        // 通知を表示
        const filterLabels: Record<DisplayFilterType, string> = {
            'incomplete': '未完了のみ',
            'complete': '完了のみ',
            'all': 'すべて'
        };
        this.feedbackSystem?.showInfo(`デフォルトフィルターが「${filterLabels[filter]}」に変更されました`);
        
        // 付箋の表示を更新（setFilterで自動的にonFilterChangedが呼ばれるため、renderAllNotesは不要）
    }

    private handleNamingStrategyChange(strategy: string): void {
        // 命名戦略の変更に応じた処理
        console.log(`[DEBUG] PostodoView: Naming strategy changed to ${strategy}`);
        
        // 通知を表示
        const strategyLabels: Record<string, string> = {
            'timestamp': 'タイムスタンプ形式',
            'sequential': '連番形式',
            'custom': 'カスタム形式'
        };
        this.feedbackSystem?.showInfo(`命名戦略が「${strategyLabels[strategy] || strategy}」に変更されました`);
        
        // 命名戦略の変更は新規作成時に適用されるため、既存の付箋には影響しない
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