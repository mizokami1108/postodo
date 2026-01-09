import { App, Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { DIContainer } from './container';
import { EventBus, IEventBus } from './event-bus';
import { ConfigProvider } from '../providers/config-provider';
import { ObsidianStorageAdapter } from '../implementations/storage/obsidian-storage';
import { NoteRepository } from '../implementations/data/note-repository';
import { DataManager } from '../implementations/data/data-manager';
import { PostodoView } from '../ui/postodo-view';
import { PostodoSettingsTab } from '../settings/postodo-settings-tab';
import { PostodoSettings, DEFAULT_SETTINGS } from '../types/config-types';
import { SERVICE_TOKENS } from '../types/core-types';
import { IStorageAdapter } from '../interfaces/storage/i-storage-adapter';
import { ErrorHandler } from '../utils/error-handler';

export class PostodoPlugin {
    private container!: DIContainer;
    private settings!: PostodoSettings;
    private configProvider!: ConfigProvider;
    private errorHandler!: ErrorHandler;

    constructor(
        private app: App,
        private plugin: Plugin
    ) {}

    async onload(): Promise<void> {
        // 設定の読み込み
        await this.loadSettings();

        // DIコンテナの初期化
        this.initializeDIContainer();

        // ビューの登録
        this.registerView();

        // 設定タブの追加
        this.plugin.addSettingTab(new PostodoSettingsTab(this.app, this.plugin, this));

        // コマンドの登録
        this.registerCommands();

        // リボンアイコンの追加
        this.addRibbonIcon();

        console.log('Postodo plugin loaded successfully');
    }

    async onunload(): Promise<void> {
        // クリーンアップ処理
        if (this.container) {
            this.container.clear();
        }
        
        console.log('Postodo plugin unloaded');
    }

    private async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.plugin.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.plugin.saveData(this.settings);
        
        // 設定変更をシステム全体に通知
        if (this.configProvider) {
            this.configProvider.updateFromSettings(this.settings);
        }
    }

    private initializeDIContainer(): void {
        this.container = new DIContainer();

        // コアサービスの登録
        this.container.register(SERVICE_TOKENS.EVENT_BUS, EventBus, { singleton: true });
        
        // イベントバスを取得して設定プロバイダーに渡す
        const eventBus = this.container.resolve<IEventBus>(SERVICE_TOKENS.EVENT_BUS);
        this.configProvider = new ConfigProvider(this.settings, eventBus);
        
        // ConfigProviderをファクトリーとして登録
        this.container.registerFactory(SERVICE_TOKENS.CONFIG, () => this.configProvider);

        // エラーハンドラーの初期化
        this.errorHandler = ErrorHandler.getInstance(eventBus);
        
        // エラーハンドラーのグローバル設定
        this.setupGlobalErrorHandling();

        // ストレージサービスの登録
        this.container.registerFactory(SERVICE_TOKENS.STORAGE_ADAPTER, () => {
            return new ObsidianStorageAdapter(this.app.vault);
        });

        // データサービスの登録
        this.container.registerFactory(SERVICE_TOKENS.NOTE_REPOSITORY, () => {
            const storageAdapter = this.container.resolve<IStorageAdapter>(SERVICE_TOKENS.STORAGE_ADAPTER);
            const eventBus = this.container.resolve<IEventBus>(SERVICE_TOKENS.EVENT_BUS);
            const configProvider = this.container.resolve(SERVICE_TOKENS.CONFIG);
            return new NoteRepository(storageAdapter, eventBus, this.app.vault, configProvider);
        });

        this.container.register(SERVICE_TOKENS.DATA_MANAGER, DataManager, {
            dependencies: [SERVICE_TOKENS.NOTE_REPOSITORY, SERVICE_TOKENS.EVENT_BUS, SERVICE_TOKENS.CONFIG],
            singleton: true
        });
    }

    private registerView(): void {
        this.plugin.registerView(
            'postodo-view',
            (leaf: WorkspaceLeaf) => new PostodoView(leaf, this.container)
        );
    }

    private registerCommands(): void {
        // Postodoビューを開くコマンド
        this.plugin.addCommand({
            id: 'open-postodo-view',
            name: 'Open Postodo View',
            callback: () => {
                this.activateView();
            }
        });

        // 新しい付箋を作成するコマンド
        this.plugin.addCommand({
            id: 'create-note',
            name: 'Create New Note',
            callback: async () => {
                await this.createQuickNote();
            }
        });

        // 全ての付箋を表示するコマンド
        this.plugin.addCommand({
            id: 'show-all-notes',
            name: 'Show All Notes',
            callback: async () => {
                await this.showAllNotes();
            }
        });
    }

    private addRibbonIcon(): void {
        this.plugin.addRibbonIcon('sticky-note', 'Postodo', (evt: MouseEvent) => {
            this.activateView();
        });
    }

    private async activateView(): Promise<void> {
        const { workspace } = this.app;
        
        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType('postodo-view');
        
        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: 'postodo-view', active: true });
            }
        }
        
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    private async createQuickNote(): Promise<void> {
        try {
            const dataManager = this.container.resolve<DataManager>(SERVICE_TOKENS.DATA_MANAGER);
            
            const result = await dataManager.createNote({
                content: 'New note',
                position: { x: Math.random() * 400, y: Math.random() * 300, zIndex: 1 }
            });
            
            if (result.success) {
                // ビューを開いて新しい付箋を表示
                await this.activateView();
            } else {
                this.errorHandler.handleError(result.error!, {
                    component: 'PostodoPlugin',
                    action: 'createQuickNote'
                });
            }
        } catch (error) {
            this.errorHandler.handleError(error as Error, {
                component: 'PostodoPlugin',
                action: 'createQuickNote'
            });
        }
    }

    private async showAllNotes(): Promise<void> {
        try {
            const dataManager = this.container.resolve<DataManager>(SERVICE_TOKENS.DATA_MANAGER);
            const result = await dataManager.getAllNotes();
            
            if (result.success) {
                console.log('All notes:', result.data);
                // ビューを開いて全ての付箋を表示
                await this.activateView();
            } else {
                this.errorHandler.handleError(result.error!, {
                    component: 'PostodoPlugin',
                    action: 'showAllNotes'
                });
            }
        } catch (error) {
            this.errorHandler.handleError(error as Error, {
                component: 'PostodoPlugin',
                action: 'showAllNotes'
            });
        }
    }

    // 外部から設定にアクセスできるようにする
    getSettings(): PostodoSettings {
        return this.settings;
    }

    getContainer(): DIContainer {
        return this.container;
    }

    private setupGlobalErrorHandling(): void {
        // グローバルエラーハンドラーの設定
        this.errorHandler.onError((errorDetails) => {
            // 重要なエラーは通知として表示
            if (errorDetails.severity === 'high' || errorDetails.severity === 'critical') {
                new Notice(errorDetails.userMessage, 5000);
            }
        });

        // 未処理のPromiseエラーをキャッチ
        window.addEventListener('unhandledrejection', (event) => {
            this.errorHandler.handleError(event.reason, {
                component: 'Global',
                action: 'unhandledRejection'
            });
        });
    }
}