import { ItemView, WorkspaceLeaf } from 'obsidian';
import { DIContainer } from '../core/container';
import { DataManager } from '../implementations/data/data-manager';
import { StickyNote } from '../types/core-types';
import { SERVICE_TOKENS } from '../types/core-types';

export class PostodoView extends ItemView {
    private dataManager: DataManager;
    private canvasEl!: HTMLElement;
    private inputEl!: HTMLInputElement;
    private notes: StickyNote[] = [];

    constructor(leaf: WorkspaceLeaf, private container: DIContainer) {
        super(leaf);
        this.dataManager = container.resolve<DataManager>(SERVICE_TOKENS.DATA_MANAGER);
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
        
        // 既存の付箋を読み込み
        await this.loadNotes();
    }

    async onClose(): Promise<void> {
        // クリーンアップ処理
    }

    private buildUI(container: Element): void {
        // コントロールパネル
        const controlsEl = container.createEl('div', { cls: 'postodo-controls' });
        
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
        this.canvasEl = container.createEl('div', { cls: 'postodo-canvas' });

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

        // キャンバスクリック
        this.canvasEl.addEventListener('click', (e) => {
            if (e.target === this.canvasEl) {
                this.createNoteAtPosition(e.offsetX, e.offsetY);
            }
        });
    }

    private setupEventListeners(): void {
        // データマネージャーからのイベントを監視
        this.dataManager.onNoteCreated((note) => {
            this.renderNote(note);
        });

        this.dataManager.onNoteUpdated((note) => {
            this.updateNoteElement(note);
        });

        this.dataManager.onNoteDeleted((id) => {
            this.removeNoteElement(id);
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
        if (!content) return;

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
        }
    }

    private async createNoteAtPosition(x: number, y: number): Promise<void> {
        const result = await this.dataManager.createNote({
            content: 'New note',
            position: { x, y, zIndex: 1 }
        });

        if (result.success) {
            this.notes.push(result.data);
        }
    }

    private async clearAllNotes(): Promise<void> {
        for (const note of this.notes) {
            await this.dataManager.deleteNote(note.id);
        }
        this.notes = [];
        this.canvasEl.empty();
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
        // ドラッグ機能
        let isDragging = false;
        let startX: number, startY: number;
        let initialX: number, initialY: number;

        noteEl.addEventListener('mousedown', (e) => {
            if (e.target === deleteBtn) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = note.position.x;
            initialY = note.position.y;
            
            noteEl.style.cursor = 'grabbing';
            noteEl.style.zIndex = '1000';
        });

        document.addEventListener('mousemove', async (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newX = initialX + deltaX;
            const newY = initialY + deltaY;
            
            noteEl.style.left = `${newX}px`;
            noteEl.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', async () => {
            if (!isDragging) return;
            
            isDragging = false;
            noteEl.style.cursor = 'grab';
            noteEl.style.zIndex = note.position.zIndex.toString();
            
            // 位置を保存
            const newX = parseInt(noteEl.style.left);
            const newY = parseInt(noteEl.style.top);
            
            await this.dataManager.updateNote(note.id, {
                position: { ...note.position, x: newX, y: newY }
            });
        });

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
            if (newContent !== note.content) {
                await this.dataManager.updateNote(note.id, { content: newContent });
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
        await this.dataManager.deleteNote(noteId);
        this.notes = this.notes.filter(note => note.id !== noteId);
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
}