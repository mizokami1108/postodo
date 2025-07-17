# Postodo 開発者ガイド

## 📋 目次
1. [コーディング規約](#コーディング規約)
2. [開発環境セットアップ](#開発環境セットアップ)
3. [アーキテクチャ概要](#アーキテクチャ概要)
4. [拡張機能開発](#拡張機能開発)
5. [カスタムテーマ作成](#カスタムテーマ作成)
6. [カスタムレンダラー実装](#カスタムレンダラー実装)
7. [外部システム連携](#外部システム連携)
8. [テスト戦略](#テスト戦略)
9. [ベストプラクティス](#ベストプラクティス)
10. [トラブルシューティング](#トラブルシューティング)

---

## 📝 コーディング規約

### TypeScript規約

#### 命名規則
```typescript
// ✅ 良い例
// インターフェース: I + PascalCase
interface INoteRepository {
    findById(id: string): Promise<StickyNote | null>;
}

// クラス: PascalCase
class PostodoDataManager implements IDataManager {
    private noteRepository: INoteRepository;
}

// メソッド・変数: camelCase
const noteManager = new PostodoDataManager();
const currentNote = await noteManager.findNoteById('note-123');

// 定数: SCREAMING_SNAKE_CASE
const MAX_NOTES_PER_CANVAS = 1000;
const DEFAULT_ANIMATION_DURATION = 300;

// ファイル名: kebab-case
// ✅ good: note-repository.ts, animation-engine.ts
// ❌ bad: NoteRepository.ts, animationEngine.ts

// サービストークン: SCREAMING_SNAKE_CASE with namespace
const SERVICE_TOKENS = {
    STORAGE_NOTE_REPOSITORY: 'Storage.NoteRepository',
    RENDERING_CANVAS: 'Rendering.Canvas',
    INPUT_GESTURE_RECOGNIZER: 'Input.GestureRecognizer'
} as const;
```

#### 型定義
```typescript
// ✅ 良い例: 明示的な型定義
interface CreateNoteOptions {
    readonly content: string;
    readonly position?: Position;
    readonly size?: NoteSize;
    readonly color?: NoteColor;
}

// ✅ 良い例: Readonly properties for immutable data
interface StickyNote {
    readonly id: string;
    readonly filePath: string;
    readonly position: Position;
    readonly dimensions: Dimensions;
    readonly appearance: Appearance;
    readonly metadata: NoteMetadata;
    content: string; // mutable
}

// ✅ 良い例: Union types for controlled values
type NoteSize = 'small' | 'medium' | 'large';
type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';
type RenderingEngine = 'dom' | 'canvas' | 'svg';

// ✅ 良い例: Generic constraints
interface Repository<T extends { id: string }> {
    findById(id: string): Promise<T | null>;
    save(entity: T): Promise<void>;
    delete(id: string): Promise<void>;
}

// ❌ 悪い例: any の使用
// function processData(data: any): any { ... }

// ✅ 良い例: 適切なジェネリクス
function processData<T extends Record<string, unknown>>(data: T): T {
    return { ...data };
}
```

#### エラーハンドリング
```typescript
// ✅ 良い例: カスタムエラークラス
class PostodoError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'PostodoError';
    }
}

class NoteNotFoundError extends PostodoError {
    constructor(noteId: string) {
        super(`Note not found: ${noteId}`, 'NOTE_NOT_FOUND', { noteId });
    }
}

// ✅ 良い例: Result pattern
type Result<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };

async function findNote(id: string): Promise<Result<StickyNote, NoteNotFoundError>> {
    try {
        const note = await this.repository.findById(id);
        if (!note) {
            return { success: false, error: new NoteNotFoundError(id) };
        }
        return { success: true, data: note };
    } catch (error) {
        return { success: false, error: error as NoteNotFoundError };
    }
}
```

#### 非同期処理
```typescript
// ✅ 良い例: async/await の一貫した使用
class NoteService {
    async createNote(options: CreateNoteOptions): Promise<StickyNote> {
        const note = this.buildNote(options);
        await this.repository.save(note);
        await this.eventBus.emit('note-created', { note });
        return note;
    }

    // ✅ 良い例: Promise.all での並列処理
    async saveMultipleNotes(notes: StickyNote[]): Promise<void> {
        const savePromises = notes.map(note => this.repository.save(note));
        await Promise.all(savePromises);
    }

    // ✅ 良い例: AbortController でのキャンセレーション
    async loadNotesWithCancellation(signal: AbortSignal): Promise<StickyNote[]> {
        if (signal.aborted) {
            throw new Error('Operation was cancelled');
        }

        const notes = await this.repository.findAll();
        
        if (signal.aborted) {
            throw new Error('Operation was cancelled');
        }

        return notes;
    }
}
```

### CSS/SCSS規約

#### 命名規則（BEM）
```scss
// ✅ 良い例: BEM命名規則
.postodo-canvas {
  position: relative;
  overflow: hidden;

  &__grid {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;

    &--visible {
      opacity: 1;
    }

    &--hidden {
      opacity: 0;
    }
  }

  &__note {
    position: absolute;
    cursor: move;
    transition: transform 0.3s ease;

    &--dragging {
      transform: scale(1.1);
      z-index: 1000;
    }

    &--small {
      width: 150px;
      height: 150px;
    }

    &--medium {
      width: 200px;
      height: 180px;
    }

    &--large {
      width: 250px;
      height: 220px;
    }
  }
}

// ✅ 良い例: CSS カスタムプロパティの活用
.postodo-note {
  background: var(--note-bg-color, #ffeb3b);
  border-radius: var(--note-border-radius, 4px);
  box-shadow: var(--note-shadow, 0 4px 8px rgba(0,0,0,0.1));
  font-family: var(--note-font-family, 'Kalam', cursive);
  
  // テーマ対応
  &.theme-dark {
    --note-bg-color: #3a3a3a;
    --note-text-color: #ffffff;
  }
}
```

#### レスポンシブデザイン
```scss
// ✅ 良い例: モバイルファーストアプローチ
.postodo-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;

  // タブレット以上
  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
  }

  // デスクトップ
  @media (min-width: 1024px) {
    padding: 1.5rem;
    gap: 1rem;
  }

  &__input {
    flex: 1;
    min-height: 44px; // タッチターゲット最小サイズ
    
    @media (max-width: 767px) {
      margin-bottom: 0.5rem;
    }
  }
}
```

---

## 🛠️ 開発環境セットアップ

### 初期セットアップ
```bash
# 1. リポジトリのクローン
git clone https://github.com/your-org/postodo.git
cd postodo

# 2. 依存関係のインストール
npm install

# 3. 開発用Obsidianボルトの準備
npm run setup-dev-vault

# 4. 開発モード開始
npm run dev

# 5. テスト実行
npm test

# 6. Lintチェック
npm run lint
```

### package.json設定例
```json
{
  "name": "postodo",
  "version": "1.0.0",
  "scripts": {
    "dev": "rollup --config rollup.config.js -w",
    "build": "rollup --config rollup.config.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "setup-dev-vault": "node scripts/setup-dev-vault.js"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.45.0",
    "jest": "^29.6.0",
    "rollup": "^3.26.0",
    "typescript": "^5.1.0"
  }
}
```

### ESLint設定
```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended'
  ],
  rules: {
    // 命名規則
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I']
      },
      {
        selector: 'class',
        format: ['PascalCase']
      },
      {
        selector: 'method',
        format: ['camelCase']
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE']
      }
    ],
    
    // TypeScript特有のルール
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    
    // 一般的なベストプラクティス
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'curly': 'error'
  }
};
```

---

## 🏗️ アーキテクチャ概要

### 依存性注入の基本
```typescript
// 1. サービストークンの定義
export const TOKENS = {
    NOTE_REPOSITORY: 'NoteRepository',
    ANIMATION_ENGINE: 'AnimationEngine',
    THEME_PROVIDER: 'ThemeProvider'
} as const;

// 2. インターフェース定義
interface INoteRepository {
    save(note: StickyNote): Promise<void>;
    findById(id: string): Promise<StickyNote | null>;
}

// 3. 実装クラス
class ObsidianNoteRepository implements INoteRepository {
    constructor(private vault: Vault) {}
    
    async save(note: StickyNote): Promise<void> {
        // 実装
    }
}

// 4. DIコンテナへの登録
container.register(TOKENS.NOTE_REPOSITORY, ObsidianNoteRepository, {
    dependencies: ['Vault'],
    singleton: true
});

// 5. 依存性の注入
class NoteService {
    constructor(
        @inject(TOKENS.NOTE_REPOSITORY) private repository: INoteRepository
    ) {}
}
```

### イベントシステムの使用
```typescript
// イベントの定義
interface PostodoEvents {
    'note-created': { note: StickyNote };
    'note-updated': { note: StickyNote; changes: Partial<StickyNote> };
    'note-deleted': { id: string };
    'canvas-zoom-changed': { zoom: number };
    'theme-changed': { themeId: string };
}

// イベントの発火
class NoteService {
    constructor(private eventBus: IEventBus) {}
    
    async createNote(options: CreateNoteOptions): Promise<StickyNote> {
        const note = this.buildNote(options);
        await this.repository.save(note);
        
        // イベント発火
        this.eventBus.emit('note-created', { note });
        
        return note;
    }
}

// イベントの監視
class NotificationService {
    constructor(eventBus: IEventBus) {
        eventBus.on('note-created', this.handleNoteCreated.bind(this));
        eventBus.on('note-deleted', this.handleNoteDeleted.bind(this));
    }
    
    private handleNoteCreated({ note }: { note: StickyNote }): void {
        this.showNotification(`New note created: ${note.content.slice(0, 50)}`);
    }
}
```

---

## 🔌 拡張機能開発

### 基本的な拡張の作成
```typescript
// src/extensions/example-extension/example-extension.ts
export class ExampleExtension implements IExtension {
    readonly id = 'example-extension';
    readonly name = 'Example Extension';
    readonly version = '1.0.0';
    readonly description = 'An example extension for Postodo';
    readonly dependencies: string[] = [];
    
    private context?: ExtensionContext;
    private unsubscribers: (() => void)[] = [];

    async initialize(context: ExtensionContext): Promise<void> {
        this.context = context;
        
        // カスタムサービスの登録
        context.registerService('ExampleService', ExampleService);
        
        // 設定の初期化
        const config = context.config;
        config.set('enabled', true);
        config.set('customOption', 'default-value');
    }

    async activate(): Promise<void> {
        if (!this.context) return;
        
        // イベントリスナーの登録
        const unsubscribe1 = this.context.eventBus.on('note-created', this.handleNoteCreated.bind(this));
        this.unsubscribers.push(unsubscribe1);
        
        // カスタムコマンドの追加
        this.registerCommands();
        
        // UIの拡張
        this.extendUI();
        
        this.context.logger.info(`${this.name} activated`);
    }

    async deactivate(): Promise<void> {
        // イベントリスナーのクリーンアップ
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
        
        this.context?.logger.info(`${this.name} deactivated`);
    }

    async dispose(): Promise<void> {
        await this.deactivate();
        this.context = undefined;
    }

    private handleNoteCreated(event: { note: StickyNote }): void {
        // カスタム処理
        console.log('Extension received note-created event:', event.note.id);
    }

    private registerCommands(): void {
        // Obsidianコマンドの登録例
        this.context?.registerCommand({
            id: 'example-command',
            name: 'Example Command',
            callback: () => {
                // カスタムコマンドの実装
            }
        });
    }

    private extendUI(): void {
        // UI拡張の実装
    }
}

// カスタムサービスの実装
class ExampleService {
    constructor(private logger: ILogger) {}
    
    doSomething(): void {
        this.logger.info('ExampleService is doing something');
    }
}
```

### 拡張の登録
```typescript
// src/extensions/example-extension/index.ts
export { ExampleExtension } from './example-extension';

// main.ts または拡張ローダー
const extensionRegistry = container.resolve<ExtensionRegistry>('ExtensionRegistry');

// 拡張の登録
await extensionRegistry.registerExtension(new ExampleExtension());

// 拡張の有効化
await extensionRegistry.activateExtension('example-extension');
```

---

## 🎨 カスタムテーマ作成

### テーマ拡張の基本構造
```typescript
// src/extensions/themes/my-theme/my-theme.ts
export class MyCustomTheme extends BaseTheme {
    readonly id = 'my-custom-theme';
    readonly name = 'My Custom Theme';
    readonly version = '1.0.0';
    readonly description = 'A beautiful custom theme for Postodo';

    protected defineThemeVariables(): void {
        this.variables = {
            // 付箋の色
            'note-bg-yellow': '#fff9c4',
            'note-bg-pink': '#fce4ec',
            'note-bg-blue': '#e3f2fd',
            'note-bg-green': '#e8f5e8',
            'note-bg-orange': '#fff3e0',
            'note-bg-purple': '#f3e5f5',
            
            // 付箋のスタイル
            'note-shadow': '0 8px 16px rgba(0,0,0,0.15)',
            'note-border-radius': '8px',
            'note-border': '2px solid rgba(0,0,0,0.1)',
            'note-font-family': '"Segoe UI", system-ui, sans-serif',
            'note-font-size': '14px',
            'note-line-height': '1.5',
            'note-padding': '16px',
            
            // キャンバス
            'canvas-bg': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'canvas-grid-color': 'rgba(255,255,255,0.1)',
            'canvas-grid-size': '20px',
            
            // UI要素
            'ui-primary-color': '#667eea',
            'ui-secondary-color': '#764ba2',
            'ui-accent-color': '#f093fb',
            'ui-background': 'rgba(255,255,255,0.95)',
            'ui-text-color': '#333333',
            'ui-border-radius': '6px'
        };
    }

    protected setupCustomProperties(): void {
        this.customProperties = {
            // アニメーション
            '--note-hover-transform': 'translateY(-4px) scale(1.02)',
            '--note-drag-transform': 'scale(1.1) rotate(2deg)',
            '--note-transition': 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            
            // グリッドパターン
            '--canvas-grid-pattern': `
                radial-gradient(circle, var(--canvas-grid-color) 1px, transparent 1px)
            `,
            
            // グラデーション
            '--note-gradient-overlay': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%)'
        };
    }

    protected registerTheme(): void {
        // テーマ固有のCSS注入
        this.injectThemeCSS();
        
        // カスタムフォントの読み込み
        this.loadCustomFonts();
    }

    protected unregisterTheme(): void {
        this.removeThemeCSS();
    }

    private injectThemeCSS(): void {
        const css = `
            .theme-${this.id} .postodo-note {
                background: linear-gradient(135deg, var(--note-bg-color) 0%, var(--note-bg-color) 100%);
                border: var(--note-border);
                position: relative;
                overflow: hidden;
            }
            
            .theme-${this.id} .postodo-note::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--note-gradient-overlay);
                pointer-events: none;
            }
            
            .theme-${this.id} .postodo-canvas {
                background: var(--canvas-bg);
                background-image: var(--canvas-grid-pattern);
                background-size: var(--canvas-grid-size) var(--canvas-grid-size);
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = `theme-${this.id}`;
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    private removeThemeCSS(): void {
        const styleEl = document.getElementById(`theme-${this.id}`);
        if (styleEl) {
            styleEl.remove();
        }
    }

    private loadCustomFonts(): void {
        // Google Fontsの読み込み例
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    }
}
```

### ダークモード対応
```typescript
export class DarkModeTheme extends BaseTheme {
    readonly id = 'dark-mode';
    readonly name = 'Dark Mode';
    readonly version = '1.0.0';
    readonly description = 'Dark theme for Postodo';

    protected defineThemeVariables(): void {
        this.variables = {
            // ダークモード対応の色
            'note-bg-yellow': '#b8860b',
            'note-bg-pink': '#c24181',
            'note-bg-blue': '#4682b4',
            'note-bg-green': '#6b8e23',
            'note-bg-orange': '#cd853f',
            'note-bg-purple': '#9370db',
            
            'note-text-color': '#ffffff',
            'note-shadow': '0 4px 12px rgba(0,0,0,0.4)',
            
            'canvas-bg': '#1a1a1a',
            'canvas-grid-color': 'rgba(255,255,255,0.1)',
            
            'ui-background': '#2d2d2d',
            'ui-text-color': '#ffffff',
            'ui-border-color': '#404040'
        };
    }

    // Obsidianのダークモード検出
    applyTheme(themeId: string, target: HTMLElement): void {
        super.applyTheme(themeId, target);
        
        // Obsidianのテーマ変更を監視
        const observer = new MutationObserver(() => {
            if (document.body.classList.contains('theme-dark')) {
                target.classList.add('postodo-dark-mode');
            } else {
                target.classList.remove('postodo-dark-mode');
            }
        });
        
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
}
```

---

## 🖼️ カスタムレンダラー実装

### レンダラーインターフェース
```typescript
// src/interfaces/rendering/i-renderer.ts
export interface IRenderer {
    initialize(container: HTMLElement): Promise<void>;
    render(notes: StickyNote[]): Promise<void>;
    updateNote(note: StickyNote): Promise<void>;
    removeNote(noteId: string): Promise<void>;
    clear(): Promise<void>;
    dispose(): Promise<void>;
    
    // イベント
    on(event: RendererEvent, callback: RendererEventCallback): void;
    off(event: RendererEvent, callback: RendererEventCallback): void;
}

type RendererEvent = 'note-click' | 'note-drag-start' | 'note-drag-end' | 'canvas-click';
type RendererEventCallback = (event: RendererEventData) => void;
```

### Canvas2Dレンダラーの実装例
```typescript
// src/implementations/rendering/canvas-renderer.ts
export class Canvas2DRenderer implements IRenderer {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private notes = new Map<string, StickyNote>();
    private eventListeners = new Map<RendererEvent, RendererEventCallback[]>();
    private animationFrameId?: number;

    async initialize(container: HTMLElement): Promise<void> {
        // Canvas要素の作成
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d')!;
        
        // 高DPI対応
        this.setupHighDPI();
        
        // イベントハンドラーの設定
        this.setupEventHandlers();
        
        // レンダリングループの開始
        this.startRenderLoop();
    }

    async render(notes: StickyNote[]): Promise<void> {
        // ノートマップの更新
        this.notes.clear();
        notes.forEach(note => this.notes.set(note.id, note));
        
        // 次のフレームで再描画
        this.requestRedraw();
    }

    async updateNote(note: StickyNote): Promise<void> {
        this.notes.set(note.id, note);
        this.requestRedraw();
    }

    async removeNote(noteId: string): Promise<void> {
        this.notes.delete(noteId);
        this.requestRedraw();
    }

    async clear(): Promise<void> {
        this.notes.clear();
        this.clearCanvas();
    }

    async dispose(): Promise<void> {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.canvas.remove();
    }

    private setupHighDPI(): void {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
    }

    private startRenderLoop(): void {
        const render = () => {
            this.clearCanvas();
            this.drawGrid();
            this.drawNotes();
            
            this.animationFrameId = requestAnimationFrame(render);
        };
        
        render();
    }

    private clearCanvas(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    private drawGrid(): void {
        const gridSize = 20;
        this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        this.ctx.lineWidth = 1;
        
        // 縦線
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 横線
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    private drawNotes(): void {
        Array.from(this.notes.values()).forEach(note => {
            this.drawNote(note);
        });
    }

    private drawNote(note: StickyNote): void {
        const { x, y } = note.position;
        const { width, height } = note.dimensions;
        
        this.ctx.save();
        
        // 回転
        this.ctx.translate(x + width / 2, y + height / 2);
        this.ctx.rotate(note.appearance.rotation * Math.PI / 180);
        this.ctx.translate(-width / 2, -height / 2);
        
        // 影
        this.ctx.shadowColor = 'rgba(0,0,0,0.2)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 4;
        
        // 背景
        this.ctx.fillStyle = this.getNoteBackgroundColor(note.appearance.color);
        this.ctx.fillRect(0, 0, width, height);
        
        // 境界線
        this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0, 0, width, height);
        
        // テキスト
        this.drawNoteText(note, width, height);
        
        this.ctx.restore();
    }

    private drawNoteText(note: StickyNote, width: number, height: number): void {
        const padding = 12;
        const lineHeight = 20;
        
        this.ctx.fillStyle = '#333333';
        this.ctx.font = '14px Kalam, cursive';
        this.ctx.textBaseline = 'top';
        
        // テキストの分割と描画
        const lines = this.wrapText(note.content, width - padding * 2);
        lines.forEach((line, index) => {
            const y = padding + index * lineHeight;
            if (y + lineHeight <= height - padding) {
                this.ctx.fillText(line, padding, y);
            }
        });
    }

    private wrapText(text: string, maxWidth: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = this.ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    private getNoteBackgroundColor(color: NoteColor): string {
        const colorMap = {
            yellow: '#ffeb3b',
            pink: '#f8bbd9',
            blue: '#90caf9',
            green: '#a5d6a7',
            orange: '#ffcc80',
            purple: '#ce93d8'
        };
        
        return colorMap[color] || colorMap.yellow;
    }

    private setupEventHandlers(): void {
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    }

    private handleCanvasClick(event: MouseEvent): void {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // クリックされた付箋を検出
        const clickedNote = this.findNoteAtPosition(x, y);
        
        if (clickedNote) {
            this.emit('note-click', { note: clickedNote, position: { x, y } });
        } else {
            this.emit('canvas-click', { position: { x, y } });
        }
    }

    private findNoteAtPosition(x: number, y: number): StickyNote | null {
        // Z-indexの順序で検索（上から下へ）
        const sortedNotes = Array.from(this.notes.values())
            .sort((a, b) => b.position.zIndex - a.position.zIndex);
        
        for (const note of sortedNotes) {
            if (this.isPointInNote(x, y, note)) {
                return note;
            }
        }
        
        return null;
    }

    private isPointInNote(x: number, y: number, note: StickyNote): boolean {
        const { x: noteX, y: noteY } = note.position;
        const { width, height } = note.dimensions;
        
        return x >= noteX && x <= noteX + width && 
               y >= noteY && y <= noteY + height;
    }

    private requestRedraw(): void {
        // 次のフレームで再描画をリクエスト
        // 実装済みのrenderLoop内で自動的に再描画される
    }

    // イベント管理
    on(event: RendererEvent, callback: RendererEventCallback): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event)!.push(callback);
    }

    off(event: RendererEvent, callback: RendererEventCallback): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private emit(event: RendererEvent, data: any): void {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(callback => callback(data));
    }
}
```

---

## 🔗 外部システム連携

### カレンダー連携の例
```typescript
// src/extensions/integrations/calendar-sync/calendar-integration.ts
export class CalendarIntegration implements IExtension {
    readonly id = 'calendar-integration';
    readonly name = 'Calendar Integration';
    readonly version = '1.0.0';
    readonly description = 'Sync notes with calendar events';
    readonly dependencies = ['DateProcessor', 'CalendarAPI'];

    private context?: ExtensionContext;
    private calendarAPI?: ICalendarAPI;

    async initialize(context: ExtensionContext): Promise<void> {
        this.context = context;
        this.calendarAPI = context.container.resolve<ICalendarAPI>('CalendarAPI');
    }

    async activate(): Promise<void> {
        if (!this.context) return;

        // 付箋作成時のカレンダー連携
        this.context.eventBus.on('note-created', this.handleNoteCreated.bind(this));
        
        // 定期的なカレンダーイベント同期
        this.startPeriodicSync();
        
        // カスタムコマンドの追加
        this.registerCalendarCommands();
    }

    private async handleNoteCreated(event: { note: StickyNote }): Promise<void> {
        const { note } = event;
        
        // 日付パターンの検出
        const dateMatches = this.extractDatesFromText(note.content);
        
        if (dateMatches.length > 0) {
            // カレンダーイベントとして登録するか確認
            const shouldCreateEvent = await this.confirmEventCreation(note, dateMatches);
            
            if (shouldCreateEvent) {
                await this.createCalendarEvent(note, dateMatches[0]);
            }
        }
    }

    private extractDatesFromText(text: string): Date[] {
        const datePatterns = [
            /\d{4}-\d{2}-\d{2}/g, // YYYY-MM-DD
            /\d{1,2}\/\d{1,2}\/\d{4}/g, // MM/DD/YYYY
            /(今日|明日|来週|来月)/g // 相対日付
        ];
        
        const dates: Date[] = [];
        
        datePatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const date = this.parseDate(match);
                    if (date) {
                        dates.push(date);
                    }
                });
            }
        });
        
        return dates;
    }

    private async createCalendarEvent(note: StickyNote, date: Date): Promise<void> {
        try {
            const event: CalendarEvent = {
                title: note.content.slice(0, 50),
                description: note.content,
                start: date,
                end: new Date(date.getTime() + 60 * 60 * 1000), // 1時間後
                source: 'postodo',
                sourceId: note.id
            };
            
            await this.calendarAPI!.createEvent(event);
            
            // 付箋にカレンダーリンクを追加
            await this.addCalendarLinkToNote(note, event.id);
            
        } catch (error) {
            this.context?.logger.error('Failed to create calendar event:', error);
        }
    }

    private registerCalendarCommands(): void {
        this.context?.registerCommand({
            id: 'sync-with-calendar',
            name: 'Sync Notes with Calendar',
            callback: this.syncWithCalendar.bind(this)
        });
        
        this.context?.registerCommand({
            id: 'create-calendar-event',
            name: 'Create Calendar Event from Note',
            callback: this.createEventFromCurrentNote.bind(this)
        });
    }
}

interface ICalendarAPI {
    createEvent(event: CalendarEvent): Promise<string>;
    updateEvent(id: string, event: Partial<CalendarEvent>): Promise<void>;
    deleteEvent(id: string): Promise<void>;
    getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
}

interface CalendarEvent {
    id?: string;
    title: string;
    description?: string;
    start: Date;
    end: Date;
    source?: string;
    sourceId?: string;
}
```

---

## 🧪 テスト戦略

### ユニットテストの例
```typescript
// tests/unit/note-service.test.ts
describe('NoteService', () => {
    let noteService: NoteService;
    let mockRepository: jest.Mocked<INoteRepository>;
    let mockEventBus: jest.Mocked<IEventBus>;

    beforeEach(() => {
        mockRepository = {
            save: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            delete: jest.fn()
        };

        mockEventBus = {
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn()
        };

        noteService = new NoteService(mockRepository, mockEventBus);
    });

    describe('createNote', () => {
        it('should create and save a new note', async () => {
            // Arrange
            const options: CreateNoteOptions = {
                content: 'Test note',
                position: { x: 100, y: 200 },
                color: 'yellow'
            };

            // Act
            const result = await noteService.createNote(options);

            // Assert
            expect(result).toBeDefined();
            expect(result.content).toBe('Test note');
            expect(result.position.x).toBe(100);
            expect(result.position.y).toBe(200);
            expect(mockRepository.save).toHaveBeenCalledWith(result);
            expect(mockEventBus.emit).toHaveBeenCalledWith('note-created', { note: result });
        });

        it('should generate unique IDs for notes', async () => {
            // Arrange
            const options: CreateNoteOptions = { content: 'Test' };

            // Act
            const note1 = await noteService.createNote(options);
            const note2 = await noteService.createNote(options);

            // Assert
            expect(note1.id).not.toBe(note2.id);
        });

        it('should handle repository errors', async () => {
            // Arrange
            const options: CreateNoteOptions = { content: 'Test' };
            mockRepository.save.mockRejectedValue(new Error('Storage error'));

            // Act & Assert
            await expect(noteService.createNote(options)).rejects.toThrow('Storage error');
        });
    });
});
```

### 統合テストの例
```typescript
// tests/integration/note-lifecycle.test.ts
describe('Note Lifecycle Integration', () => {
    let container: DIContainer;
    let noteService: NoteService;
    let storageAdapter: IStorageAdapter;

    beforeEach(async () => {
        // テスト用のDIコンテナをセットアップ
        container = new DIContainer();
        
        // モックサービスの登録
        container.register('StorageAdapter', MockStorageAdapter);
        container.register('EventBus', EventBus, { singleton: true });
        container.register('NoteRepository', NoteRepository, { 
            dependencies: ['StorageAdapter'],
            singleton: true
        });
        container.register('NoteService', NoteService, {
            dependencies: ['NoteRepository', 'EventBus']
        });

        noteService = container.resolve<NoteService>('NoteService');
        storageAdapter = container.resolve<IStorageAdapter>('StorageAdapter');
    });

    it('should complete full note lifecycle', async () => {
        // 1. ノート作成
        const note = await noteService.createNote({
            content: 'Integration test note'
        });

        // 2. ストレージに保存されていることを確認
        const storedNote = await storageAdapter.read(note.filePath);
        expect(storedNote).toBeDefined();

        // 3. ノート更新
        await noteService.updateNote(note.id, {
            content: 'Updated content',
            position: { x: 300, y: 400, zIndex: 2 }
        });

        // 4. 更新がストレージに反映されることを確認
        const updatedNote = await noteService.findById(note.id);
        expect(updatedNote?.content).toBe('Updated content');
        expect(updatedNote?.position.x).toBe(300);

        // 5. ノート削除
        await noteService.deleteNote(note.id);

        // 6. ストレージから削除されていることを確認
        const deletedNote = await noteService.findById(note.id);
        expect(deletedNote).toBeNull();
    });
});
```

### E2Eテストの例
```typescript
// tests/e2e/note-creation.test.ts
describe('Note Creation E2E', () => {
    let obsidianApp: MockObsidianApp;
    let postodoPlugin: PostodoPlugin;

    beforeEach(async () => {
        obsidianApp = new MockObsidianApp();
        postodoPlugin = new PostodoPlugin(obsidianApp, {});
        await postodoPlugin.onload();
    });

    afterEach(async () => {
        await postodoPlugin.onunload();
    });

    it('should create note through UI interaction', async () => {
        // 1. Postodoビューを開く
        const workspace = obsidianApp.workspace;
        const leaf = workspace.getLeaf(false);
        await leaf.setViewState({ type: 'postodo-view' });

        const view = leaf.view as PostodoView;
        
        // 2. 入力フィールドにテキストを入力
        const inputElement = view.containerEl.querySelector('.todo-input') as HTMLInputElement;
        inputElement.value = 'E2E test note';
        
        // 3. 追加ボタンをクリック
        const addButton = view.containerEl.querySelector('.add-btn') as HTMLButtonElement;
        addButton.click();

        // 4. UIに付箋が表示されることを確認
        await waitFor(() => {
            const noteElements = view.containerEl.querySelectorAll('.sticky-note');
            expect(noteElements.length).toBe(1);
            expect(noteElements[0].textContent).toContain('E2E test note');
        });

        // 5. ファイルシステムにファイルが作成されることを確認
        const vault = obsidianApp.vault;
        const postodoFiles = vault.getFiles().filter(f => f.path.startsWith('Postodo/'));
        expect(postodoFiles.length).toBe(1);
        
        const fileContent = await vault.read(postodoFiles[0]);
        expect(fileContent).toContain('E2E test note');
    });
});
```

---

## 📋 ベストプラクティス

### パフォーマンス最適化
```typescript
// 1. 遅延読み込み
class LazyNoteLoader {
    private loadedNotes = new Set<string>();
    
    async loadNoteOnDemand(noteId: string): Promise<StickyNote | null> {
        if (this.loadedNotes.has(noteId)) {
            return this.noteCache.get(noteId);
        }
        
        const note = await this.repository.findById(noteId);
        if (note) {
            this.loadedNotes.add(noteId);
            this.noteCache.set(noteId, note);
        }
        
        return note;
    }
}

// 2. メモ化
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
    const cache = new Map();
    return ((...args: any[]) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    }) as T;
};

const memoizedParseDate = memoize((dateString: string) => {
    return new Date(dateString);
});

// 3. デバウンス
const debounce = <T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

// 使用例
const debouncedSave = debounce(this.saveNote.bind(this), 500);
```

### エラーハンドリング
```typescript
// 1. エラー境界の実装
class ErrorBoundary {
    private errorHandlers = new Map<string, ErrorHandler>();
    
    registerHandler(errorType: string, handler: ErrorHandler): void {
        this.errorHandlers.set(errorType, handler);
    }
    
    async handleError(error: Error, context?: any): Promise<void> {
        const errorType = error.constructor.name;
        const handler = this.errorHandlers.get(errorType) || this.defaultHandler;
        
        try {
            await handler(error, context);
        } catch (handlerError) {
            console.error('Error in error handler:', handlerError);
            this.defaultHandler(error, context);
        }
    }
    
    private defaultHandler: ErrorHandler = (error, context) => {
        console.error('Unhandled error:', error, context);
        // ユーザーへの通知
        this.notificationService.showError('An unexpected error occurred');
    };
}

// 2. Graceful degradation
class GracefulService {
    async performOperation(): Promise<Result<Data, Error>> {
        try {
            const result = await this.riskOperation();
            return { success: true, data: result };
        } catch (error) {
            // フォールバック処理
            const fallbackResult = await this.fallbackOperation();
            return { success: true, data: fallbackResult };
        }
    }
    
    private async fallbackOperation(): Promise<Data> {
        // より安全な代替手段
        return this.getCachedData() || this.getDefaultData();
    }
}
```

### セキュリティ考慮事項
```typescript
// 1. 入力検証
class InputValidator {
    static validateNoteContent(content: string): ValidationResult {
        // 長さチェック
        if (content.length > 10000) {
            return { valid: false, error: 'Content too long' };
        }
        
        // 危険なスクリプトのチェック
        if (this.containsScript(content)) {
            return { valid: false, error: 'Script content not allowed' };
        }
        
        return { valid: true };
    }
    
    private static containsScript(content: string): boolean {
        const scriptPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i
        ];
        
        return scriptPatterns.some(pattern => pattern.test(content));
    }
}

// 2. サニタイズ
class ContentSanitizer {
    static sanitizeHTML(html: string): string {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    static sanitizeFileName(fileName: string): string {
        return fileName.replace(/[<>:"/\\|?*]/g, '_');
    }
}
```

---

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. DIコンテナ関連の問題
```typescript
// 問題: 循環依存
// ❌ 悪い例
class ServiceA {
    constructor(private serviceB: ServiceB) {}
}

class ServiceB {
    constructor(private serviceA: ServiceA) {}
}

// ✅ 解決方法: インターフェースの使用
interface IServiceA {
    doSomething(): void;
}

class ServiceA implements IServiceA {
    doSomething(): void { /* implementation */ }
}

class ServiceB {
    constructor(private serviceA: IServiceA) {}
}

// または、ファクトリーパターンの使用
class ServiceFactory {
    createServiceA(): ServiceA {
        return new ServiceA(() => this.createServiceB());
    }
}
```

#### 2. パフォーマンス問題
```typescript
// 問題: 大量の付箋で性能劣化
// ✅ 解決方法: 仮想化の実装
class PerformanceOptimizer {
    private static readonly MAX_RENDERED_NOTES = 100;
    
    optimizeNoteRendering(notes: StickyNote[], viewport: Viewport): StickyNote[] {
        // 表示領域内の付箋のみをフィルタリング
        const visibleNotes = notes.filter(note => 
            this.isNoteInViewport(note, viewport)
        );
        
        // 最大表示数に制限
        return visibleNotes.slice(0, PerformanceOptimizer.MAX_RENDERED_NOTES);
    }
    
    private isNoteInViewport(note: StickyNote, viewport: Viewport): boolean {
        // 境界判定ロジック
        return true; // 実装は省略
    }
}
```

#### 3. メモリリーク
```typescript
// 問題: イベントリスナーのクリーンアップ不足
// ✅ 解決方法: 適切なクリーンアップ
class ComponentWithCleanup {
    private unsubscribers: (() => void)[] = [];
    
    initialize(): void {
        const unsubscribe1 = this.eventBus.on('event1', this.handler1);
        const unsubscribe2 = this.eventBus.on('event2', this.handler2);
        
        this.unsubscribers.push(unsubscribe1, unsubscribe2);
    }
    
    dispose(): void {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
    }
}
```

#### 4. 型安全性の問題
```typescript
// 問題: ランタイムでの型エラー
// ✅ 解決方法: ランタイム型チェック
function isValidNote(obj: any): obj is StickyNote {
    return obj &&
           typeof obj.id === 'string' &&
           typeof obj.content === 'string' &&
           obj.position &&
           typeof obj.position.x === 'number' &&
           typeof obj.position.y === 'number';
}

// 使用例
function processNote(data: unknown): void {
    if (!isValidNote(data)) {
        throw new Error('Invalid note data');
    }
    
    // ここでdataはStickyNote型として扱える
    console.log(data.content);
}
```

### デバッグ設定
```typescript
// デバッグモードの実装
class DebugManager {
    private static instance: DebugManager;
    private debugMode = false;
    
    static getInstance(): DebugManager {
        if (!DebugManager.instance) {
            DebugManager.instance = new DebugManager();
        }
        return DebugManager.instance;
    }
    
    enableDebugMode(): void {
        this.debugMode = true;
        console.log('Debug mode enabled');
        
        // グローバルデバッグ関数の追加
        (window as any).postodoDebug = {
            container: this.container,
            eventBus: this.eventBus,
            dumpState: () => this.dumpApplicationState(),
            clearCache: () => this.clearAllCaches()
        };
    }
    
    log(message: string, data?: any): void {
        if (this.debugMode) {
            console.log(`[Postodo Debug] ${message}`, data);
        }
    }
    
    private dumpApplicationState(): void {
        console.log('Application State:', {
            noteCount: this.dataManager.getAllNotes().length,
            activeExtensions: this.extensionRegistry.getActiveExtensions(),
            currentTheme: this.themeProvider.getCurrentTheme(),
            performance: this.performanceMonitor.getMetrics()
        });
    }
}
```

---

## 📚 参考リソース

### 推奨読み物
- [Obsidian Plugin Developer Guide](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Dependency Injection Patterns](https://martinfowler.com/articles/injection.html)

### コミュニティ
- [Obsidian Discord](https://discord.gg/obsidianmd)
- [Postodo GitHub Discussions](https://github.com/your-org/postodo/discussions)
- [Developer Forum](https://forum.obsidian.md/c/developers/)

### コントリビューション
プロジェクトへの貢献を歓迎します！詳細は[CONTRIBUTING.md](CONTRIBUTING.md)をご覧ください。

---

このガイドがPostodo拡張開発の出発点となることを願っています。疎結合アーキテクチャの恩恵を活かし、素晴らしい拡張機能を作成してください！