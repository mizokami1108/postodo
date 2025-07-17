# Postodo 疎結合アーキテクチャ設計

## 🏗️ アーキテクチャ原則

### 設計原則
- **Single Responsibility Principle (SRP)**: 各クラスは単一の責任を持つ
- **Dependency Inversion Principle (DIP)**: 抽象に依存し、具象に依存しない
- **Interface Segregation Principle (ISP)**: 使用しないインターフェースに依存しない
- **Plugin Architecture**: コア機能と拡張機能の明確な分離
- **Event-driven Architecture**: 疎結合なコンポーネント間通信

---

## 📁 新しいディレクトリ構成

```
postodo/
├── main.ts                           # プラグインエントリーポイント
├── manifest.json                     # プラグインマニフェスト
├── styles.css                        # デフォルトスタイル
├── src/
│   ├── core/                         # 🔵 コア機能（変更不可）
│   │   ├── plugin.ts                 # メインプラグインクラス
│   │   ├── container.ts              # DIコンテナ
│   │   ├── event-bus.ts              # イベントバス
│   │   └── lifecycle.ts              # ライフサイクル管理
│   │
│   ├── interfaces/                   # 🔷 抽象化レイヤー（契約定義）
│   │   ├── storage/                  
│   │   │   ├── i-storage-adapter.ts
│   │   │   ├── i-sync-strategy.ts
│   │   │   └── i-conflict-resolver.ts
│   │   ├── rendering/
│   │   │   ├── i-renderer.ts
│   │   │   ├── i-canvas.ts
│   │   │   ├── i-note-component.ts
│   │   │   └── i-animation-engine.ts
│   │   ├── input/
│   │   │   ├── i-input-handler.ts
│   │   │   ├── i-gesture-recognizer.ts
│   │   │   └── i-interaction-manager.ts
│   │   ├── data/
│   │   │   ├── i-data-manager.ts
│   │   │   ├── i-note-repository.ts
│   │   │   ├── i-search-engine.ts
│   │   │   └── i-indexer.ts
│   │   └── extensions/
│   │       ├── i-extension.ts
│   │       ├── i-theme-provider.ts
│   │       └── i-command-provider.ts
│   │
│   ├── implementations/              # 🟢 具体実装（交換可能）
│   │   ├── storage/
│   │   │   ├── obsidian-storage.ts   # Obsidian Vault API実装
│   │   │   ├── memory-storage.ts     # メモリ内ストレージ
│   │   │   ├── real-time-sync.ts     # リアルタイム同期戦略
│   │   │   └── merge-conflict-resolver.ts
│   │   ├── rendering/
│   │   │   ├── dom-renderer.ts       # DOM based renderer
│   │   │   ├── canvas-renderer.ts    # Canvas 2D renderer
│   │   │   ├── svg-renderer.ts       # SVG renderer
│   │   │   ├── css-animation-engine.ts
│   │   │   └── web-animation-engine.ts
│   │   ├── input/
│   │   │   ├── mouse-handler.ts
│   │   │   ├── touch-handler.ts
│   │   │   ├── keyboard-handler.ts
│   │   │   └── gesture-recognizer.ts
│   │   ├── data/
│   │   │   ├── note-repository.ts
│   │   │   ├── spatial-indexer.ts
│   │   │   ├── text-search-engine.ts
│   │   │   └── memory-data-manager.ts
│   │   └── ui/
│   │       ├── default-theme.ts
│   │       ├── mobile-theme.ts
│   │       └── dark-theme.ts
│   │
│   ├── providers/                    # 🟡 サービス提供層
│   │   ├── dependency-provider.ts    # DI設定
│   │   ├── factory-provider.ts       # ファクトリ集約
│   │   ├── config-provider.ts        # 設定管理
│   │   └── registry-provider.ts      # 拡張登録
│   │
│   ├── adapters/                     # 🟠 外部連携アダプター
│   │   ├── obsidian-adapter.ts       # Obsidian API適合
│   │   ├── mobile-adapter.ts         # モバイル環境適合
│   │   └── web-adapter.ts            # Web環境適合
│   │
│   ├── extensions/                   # 🟣 拡張機能
│   │   ├── themes/                   # テーマ拡張
│   │   │   ├── classic-theme/
│   │   │   ├── minimal-theme/
│   │   │   └── custom-theme/
│   │   ├── animations/               # アニメーション拡張
│   │   │   ├── bounce-animations/
│   │   │   ├── fade-animations/
│   │   │   └── physics-animations/
│   │   ├── input-methods/            # 入力方法拡張
│   │   │   ├── voice-input/
│   │   │   ├── markdown-input/
│   │   │   └── emoji-picker/
│   │   └── integrations/             # 外部連携拡張
│   │       ├── calendar-sync/
│   │       ├── task-manager-sync/
│   │       └── ai-assistant/
│   │
│   ├── types/                        # 🔸 型定義
│   │   ├── core-types.ts
│   │   ├── note-types.ts
│   │   ├── ui-types.ts
│   │   ├── extension-types.ts
│   │   └── config-types.ts
│   │
│   ├── utils/                        # 🔹 ユーティリティ
│   │   ├── logger.ts
│   │   ├── validator.ts
│   │   ├── performance-monitor.ts
│   │   └── error-handler.ts
│   │
│   └── config/                       # ⚙️ 設定
│       ├── default-config.ts
│       ├── development-config.ts
│       └── production-config.ts
│
├── extensions/                       # 📦 外部拡張パッケージ
│   ├── community-themes/
│   ├── third-party-integrations/
│   └── experimental-features/
│
├── tests/                           # 🧪 テスト
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── docs/                           # 📖 ドキュメント
    ├── api/
    ├── extensions/
    └── examples/
```

---

## 🔗 依存性注入（DI）システム

### DIコンテナ実装
```typescript
// src/core/container.ts
export class DIContainer {
    private services = new Map<string, ServiceDefinition>();
    private instances = new Map<string, any>();
    private singletons = new Set<string>();

    register<T>(
        token: string, 
        implementation: new (...args: any[]) => T,
        options: ServiceOptions = {}
    ): void {
        this.services.set(token, {
            implementation,
            dependencies: options.dependencies || [],
            singleton: options.singleton || false,
            factory: options.factory
        });

        if (options.singleton) {
            this.singletons.add(token);
        }
    }

    registerFactory<T>(
        token: string,
        factory: (...args: any[]) => T,
        dependencies: string[] = []
    ): void {
        this.services.set(token, {
            factory,
            dependencies,
            singleton: false
        });
    }

    resolve<T>(token: string): T {
        // シングルトンの場合、既存インスタンスを返す
        if (this.singletons.has(token) && this.instances.has(token)) {
            return this.instances.get(token);
        }

        const service = this.services.get(token);
        if (!service) {
            throw new Error(`Service not registered: ${token}`);
        }

        // 依存関係を解決
        const dependencies = service.dependencies.map(dep => this.resolve(dep));

        let instance: T;
        if (service.factory) {
            instance = service.factory(...dependencies);
        } else {
            instance = new service.implementation!(...dependencies);
        }

        // シングルトンの場合、インスタンスを保存
        if (this.singletons.has(token)) {
            this.instances.set(token, instance);
        }

        return instance;
    }

    configure(configuration: ContainerConfiguration): void {
        configuration.services.forEach(config => {
            this.register(config.token, config.implementation, config.options);
        });

        configuration.factories?.forEach(config => {
            this.registerFactory(config.token, config.factory, config.dependencies);
        });
    }
}

interface ServiceDefinition {
    implementation?: new (...args: any[]) => any;
    factory?: (...args: any[]) => any;
    dependencies: string[];
    singleton: boolean;
}

interface ServiceOptions {
    dependencies?: string[];
    singleton?: boolean;
    factory?: (...args: any[]) => any;
}
```

### サービストークン定義
```typescript
// src/types/service-tokens.ts
export const SERVICE_TOKENS = {
    // Core Services
    EVENT_BUS: 'EventBus',
    LOGGER: 'Logger',
    CONFIG: 'Config',
    
    // Storage Services
    STORAGE_ADAPTER: 'StorageAdapter',
    SYNC_STRATEGY: 'SyncStrategy',
    CONFLICT_RESOLVER: 'ConflictResolver',
    
    // Rendering Services
    RENDERER: 'Renderer',
    CANVAS: 'Canvas',
    ANIMATION_ENGINE: 'AnimationEngine',
    
    // Input Services
    INPUT_HANDLER: 'InputHandler',
    GESTURE_RECOGNIZER: 'GestureRecognizer',
    
    // Data Services
    DATA_MANAGER: 'DataManager',
    NOTE_REPOSITORY: 'NoteRepository',
    SEARCH_ENGINE: 'SearchEngine',
    INDEXER: 'Indexer',
    
    // UI Services
    THEME_PROVIDER: 'ThemeProvider',
    LAYOUT_MANAGER: 'LayoutManager'
} as const;

export type ServiceToken = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];
```

---

## 🔌 プラグインアーキテクチャ

### 拡張ポイント定義
```typescript
// src/interfaces/extensions/i-extension.ts
export interface IExtension {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly dependencies: string[];

    initialize(context: ExtensionContext): Promise<void>;
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    dispose(): Promise<void>;
}

export interface ExtensionContext {
    container: DIContainer;
    eventBus: IEventBus;
    logger: ILogger;
    config: ExtensionConfig;
    registerService<T>(token: string, implementation: new (...args: any[]) => T): void;
    registerFactory<T>(token: string, factory: (...args: any[]) => T): void;
}

// src/interfaces/extensions/i-theme-provider.ts
export interface IThemeProvider extends IExtension {
    getThemes(): ThemeDefinition[];
    applyTheme(themeId: string, target: HTMLElement): void;
    removeTheme(themeId: string, target: HTMLElement): void;
    getThemeVariables(themeId: string): Record<string, string>;
}

// src/interfaces/extensions/i-animation-engine.ts
export interface IAnimationEngine {
    animate(element: HTMLElement, animation: AnimationDefinition): Promise<void>;
    createTimeline(): IAnimationTimeline;
    registerAnimation(name: string, animation: AnimationFactory): void;
    getAvailableAnimations(): string[];
}
```

### 拡張登録システム
```typescript
// src/providers/registry-provider.ts
export class ExtensionRegistry {
    private extensions = new Map<string, IExtension>();
    private extensionContexts = new Map<string, ExtensionContext>();

    constructor(private container: DIContainer, private eventBus: IEventBus) {}

    async registerExtension(extension: IExtension): Promise<void> {
        if (this.extensions.has(extension.id)) {
            throw new Error(`Extension already registered: ${extension.id}`);
        }

        // 依存関係の検証
        await this.validateDependencies(extension);

        // 拡張コンテキストの作成
        const context = this.createExtensionContext(extension);
        this.extensionContexts.set(extension.id, context);

        // 拡張の初期化
        await extension.initialize(context);

        this.extensions.set(extension.id, extension);
        this.eventBus.emit('extension-registered', { extension });
    }

    async activateExtension(extensionId: string): Promise<void> {
        const extension = this.extensions.get(extensionId);
        if (!extension) {
            throw new Error(`Extension not found: ${extensionId}`);
        }

        await extension.activate();
        this.eventBus.emit('extension-activated', { extension });
    }

    async deactivateExtension(extensionId: string): Promise<void> {
        const extension = this.extensions.get(extensionId);
        if (!extension) return;

        await extension.deactivate();
        this.eventBus.emit('extension-deactivated', { extension });
    }

    private createExtensionContext(extension: IExtension): ExtensionContext {
        return {
            container: this.container,
            eventBus: this.eventBus,
            logger: this.container.resolve<ILogger>(SERVICE_TOKENS.LOGGER),
            config: this.createExtensionConfig(extension),
            registerService: <T>(token: string, impl: new (...args: any[]) => T) => {
                this.container.register(token, impl);
            },
            registerFactory: <T>(token: string, factory: (...args: any[]) => T) => {
                this.container.registerFactory(token, factory);
            }
        };
    }
}
```

---

## 🎛️ 設定システム

### 階層化設定管理
```typescript
// src/providers/config-provider.ts
export class ConfigProvider {
    private config: DeepPartial<PostodoConfig>;
    private watchers = new Map<string, ConfigWatcher[]>();

    constructor() {
        this.config = this.mergeConfigs([
            DefaultConfig,
            this.loadUserConfig(),
            this.loadExtensionConfigs()
        ]);
    }

    get<T>(path: string): T {
        return this.getValueByPath(this.config, path);
    }

    set<T>(path: string, value: T): void {
        this.setValueByPath(this.config, path, value);
        this.notifyWatchers(path, value);
        this.saveUserConfig();
    }

    watch(path: string, callback: ConfigWatcher): () => void {
        if (!this.watchers.has(path)) {
            this.watchers.set(path, []);
        }
        this.watchers.get(path)!.push(callback);

        // アンサブスクライブ関数を返す
        return () => {
            const watchers = this.watchers.get(path) || [];
            const index = watchers.indexOf(callback);
            if (index > -1) {
                watchers.splice(index, 1);
            }
        };
    }

    createExtensionConfig(extensionId: string): ExtensionConfig {
        return {
            get: <T>(key: string) => this.get(`extensions.${extensionId}.${key}`),
            set: <T>(key: string, value: T) => this.set(`extensions.${extensionId}.${key}`, value),
            watch: (key: string, callback: ConfigWatcher) => 
                this.watch(`extensions.${extensionId}.${key}`, callback)
        };
    }

    private mergeConfigs(configs: any[]): any {
        return configs.reduce((merged, config) => {
            return this.deepMerge(merged, config);
        }, {});
    }
}

// src/config/default-config.ts
export const DefaultConfig: PostodoConfig = {
    core: {
        maxNotes: 1000,
        autoSave: true,
        saveInterval: 500,
        enableDebugMode: false
    },
    rendering: {
        engine: 'dom', // 'dom' | 'canvas' | 'svg'
        virtualization: true,
        maxRenderedNotes: 100,
        animationEngine: 'css' // 'css' | 'web-animations' | 'custom'
    },
    storage: {
        adapter: 'obsidian-vault', // 'obsidian-vault' | 'memory' | 'custom'
        syncStrategy: 'real-time', // 'real-time' | 'manual' | 'periodic'
        conflictResolution: 'auto-merge' // 'auto-merge' | 'user-choice' | 'last-write-wins'
    },
    input: {
        enableTouch: true,
        enableMouse: true,
        enableKeyboard: true,
        gestureRecognition: true
    },
    ui: {
        theme: 'default',
        layout: 'canvas',
        showGrid: true,
        snapToGrid: false
    },
    extensions: {
        enabled: [],
        autoload: true,
        allowExperimental: false
    }
};
```

---

## 🎨 テーマシステム

### プラガブルテーマアーキテクチャ
```typescript
// src/extensions/themes/base-theme.ts
export abstract class BaseTheme implements IThemeProvider {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly version: string;
    abstract readonly description: string;
    readonly dependencies: string[] = [];

    protected variables: Record<string, string> = {};
    protected customProperties: Record<string, string> = {};

    async initialize(context: ExtensionContext): Promise<void> {
        this.defineThemeVariables();
        this.setupCustomProperties();
    }

    async activate(): Promise<void> {
        this.registerTheme();
    }

    async deactivate(): Promise<void> {
        this.unregisterTheme();
    }

    async dispose(): Promise<void> {
        // クリーンアップ処理
    }

    getThemes(): ThemeDefinition[] {
        return [{
            id: this.id,
            name: this.name,
            description: this.description,
            variables: this.variables,
            customProperties: this.customProperties
        }];
    }

    applyTheme(themeId: string, target: HTMLElement): void {
        if (themeId !== this.id) return;

        // CSS変数の適用
        Object.entries(this.variables).forEach(([key, value]) => {
            target.style.setProperty(`--${key}`, value);
        });

        // カスタムクラスの適用
        target.classList.add(`theme-${this.id}`);
    }

    removeTheme(themeId: string, target: HTMLElement): void {
        if (themeId !== this.id) return;

        // CSS変数のクリア
        Object.keys(this.variables).forEach(key => {
            target.style.removeProperty(`--${key}`);
        });

        // カスタムクラスの削除
        target.classList.remove(`theme-${this.id}`);
    }

    getThemeVariables(themeId: string): Record<string, string> {
        return themeId === this.id ? { ...this.variables } : {};
    }

    protected abstract defineThemeVariables(): void;
    protected abstract setupCustomProperties(): void;
    protected abstract registerTheme(): void;
    protected abstract unregisterTheme(): void;
}

// src/extensions/themes/classic-theme/classic-theme.ts
export class ClassicTheme extends BaseTheme {
    readonly id = 'classic';
    readonly name = 'Classic Theme';
    readonly version = '1.0.0';
    readonly description = 'Traditional sticky notes appearance';

    protected defineThemeVariables(): void {
        this.variables = {
            'note-bg-yellow': '#ffeb3b',
            'note-bg-pink': '#f8bbd9',
            'note-bg-blue': '#90caf9',
            'note-bg-green': '#a5d6a7',
            'note-bg-orange': '#ffcc80',
            'note-bg-purple': '#ce93d8',
            'note-shadow': '0 4px 8px rgba(0,0,0,0.1)',
            'note-border-radius': '4px',
            'note-font-family': 'Kalam, cursive',
            'note-padding': '12px',
            'canvas-bg': '#ffffff',
            'canvas-grid-color': '#e0e0e0'
        };
    }

    protected setupCustomProperties(): void {
        this.customProperties = {
            '--note-hover-transform': 'scale(1.02) rotate(0deg)',
            '--note-drag-transform': 'scale(1.1)',
            '--note-transition': 'transform 0.3s ease, box-shadow 0.3s ease'
        };
    }

    protected registerTheme(): void {
        // テーマ固有の登録処理
    }

    protected unregisterTheme(): void {
        // テーマ固有の登録解除処理
    }
}
```

---

## 🔄 イベントドリブンアーキテクチャ

### 中央イベントバス
```typescript
// src/core/event-bus.ts
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

interface EventListener<T = any> {
    (data?: T, event?: string): void;
}

interface WildcardListener {
    pattern: string;
    listener: EventListener;
}
```

---

## 🏭 ファクトリーシステム

### サービスファクトリー
```typescript
// src/providers/factory-provider.ts
export class FactoryProvider {
    private factories = new Map<string, ServiceFactory>();

    constructor(private container: DIContainer) {
        this.registerDefaultFactories();
    }

    registerFactory<T>(type: string, factory: ServiceFactory<T>): void {
        this.factories.set(type, factory);
    }

    create<T>(type: string, options?: any): T {
        const factory = this.factories.get(type);
        if (!factory) {
            throw new Error(`Factory not found for type: ${type}`);
        }

        return factory.create(options, this.container);
    }

    private registerDefaultFactories(): void {
        // レンダラーファクトリー
        this.registerFactory('renderer', new RendererFactory());
        
        // ストレージアダプターファクトリー
        this.registerFactory('storage-adapter', new StorageAdapterFactory());
        
        // アニメーションエンジンファクトリー
        this.registerFactory('animation-engine', new AnimationEngineFactory());
        
        // 入力ハンドラーファクトリー
        this.registerFactory('input-handler', new InputHandlerFactory());
    }
}

// レンダラーファクトリーの例
class RendererFactory implements ServiceFactory<IRenderer> {
    create(options: RendererOptions, container: DIContainer): IRenderer {
        switch (options.type) {
            case 'dom':
                return new DOMRenderer(
                    container.resolve<ICanvas>(SERVICE_TOKENS.CANVAS),
                    container.resolve<IAnimationEngine>(SERVICE_TOKENS.ANIMATION_ENGINE)
                );
            case 'canvas':
                return new CanvasRenderer(
                    container.resolve<ICanvas>(SERVICE_TOKENS.CANVAS)
                );
            case 'svg':
                return new SVGRenderer(
                    container.resolve<ICanvas>(SERVICE_TOKENS.CANVAS)
                );
            default:
                throw new Error(`Unknown renderer type: ${options.type}`);
        }
    }
}

interface ServiceFactory<T = any> {
    create(options?: any, container?: DIContainer): T;
}
```

この疎結合アーキテクチャにより、以下のカスタマイズ性が実現されます：

## 🎛️ カスタマイズポイント

1. **レンダリングエンジンの交換** (DOM ↔ Canvas ↔ SVG)
2. **ストレージアダプターの交換** (Obsidian ↔ メモリ ↔ カスタム)
3. **アニメーションエンジンの交換** (CSS ↔ Web Animations ↔ Physics)
4. **テーマシステムの拡張** (プラガブルテーマ)
5. **入力方法の拡張** (マウス ↔ タッチ ↔ 音声 ↔ カスタム)
6. **外部連携の追加** (カレンダー ↔ タスク管理 ↔ AI)

次は具体的な実装例やカスタマイズガイドを作成しましょうか？