# Obsidian設定システム統合設計

## 🎛️ Obsidianネイティブ設定システムとの統合

### 設定タブの実装
```typescript
// src/settings/postodo-settings-tab.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import { PostodoPlugin } from '../core/plugin';
import { PostodoSettings } from '../types/config-types';

export class PostodoSettingsTab extends PluginSettingTab {
    plugin: PostodoPlugin;

    constructor(app: App, plugin: PostodoPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Postodo Settings' });

        // 基本設定セクション
        this.createBasicSettings(containerEl);
        
        // レンダリング設定セクション  
        this.createRenderingSettings(containerEl);
        
        // ストレージ設定セクション
        this.createStorageSettings(containerEl);
        
        // 拡張機能設定セクション
        this.createExtensionSettings(containerEl);
        
        // 高度な設定セクション
        this.createAdvancedSettings(containerEl);
    }

    private createBasicSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Basic Settings' });

        // 付箋フォルダーの設定
        new Setting(containerEl)
            .setName('Notes folder')
            .setDesc('Folder where Postodo notes will be stored')
            .addText(text => text
                .setPlaceholder('Postodo')
                .setValue(this.plugin.settings.postodoFolder)
                .onChange(async (value) => {
                    this.plugin.settings.postodoFolder = value;
                    await this.plugin.saveSettings();
                }));

        // 自動保存の設定
        new Setting(containerEl)
            .setName('Auto save')
            .setDesc('Automatically save notes when modified')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.core.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.core.autoSave = value;
                    await this.plugin.saveSettings();
                    // 設定変更をアプリケーションに通知
                    this.plugin.configProvider.set('core.autoSave', value);
                }));

        // 保存間隔の設定
        new Setting(containerEl)
            .setName('Save interval (ms)')
            .setDesc('How often to save notes automatically')
            .addSlider(slider => slider
                .setLimits(100, 5000, 100)
                .setValue(this.plugin.settings.core.saveInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.core.saveInterval = value;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('core.saveInterval', value);
                }));
    }

    private createRenderingSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Rendering Settings' });

        // レンダリングエンジンの選択
        new Setting(containerEl)
            .setName('Rendering engine')
            .setDesc('Choose how notes are rendered')
            .addDropdown(dropdown => dropdown
                .addOption('dom', 'DOM (Default)')
                .addOption('canvas', 'Canvas 2D (Performance)')
                .addOption('svg', 'SVG (Scalable)')
                .setValue(this.plugin.settings.rendering.engine)
                .onChange(async (value) => {
                    this.plugin.settings.rendering.engine = value as RenderingEngine;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('rendering.engine', value);
                    // レンダラーの再初期化
                    await this.plugin.reinitializeRenderer();
                }));

        // 仮想化の設定
        new Setting(containerEl)
            .setName('Enable virtualization')
            .setDesc('Improve performance with many notes')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rendering.virtualization)
                .onChange(async (value) => {
                    this.plugin.settings.rendering.virtualization = value;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('rendering.virtualization', value);
                }));

        // 最大レンダリング数
        new Setting(containerEl)
            .setName('Max rendered notes')
            .setDesc('Maximum number of notes to render at once')
            .addSlider(slider => slider
                .setLimits(20, 500, 10)
                .setValue(this.plugin.settings.rendering.maxRenderedNotes)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.rendering.maxRenderedNotes = value;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('rendering.maxRenderedNotes', value);
                }));

        // アニメーションエンジンの選択
        new Setting(containerEl)
            .setName('Animation engine')
            .setDesc('Choose animation system')
            .addDropdown(dropdown => dropdown
                .addOption('css', 'CSS Animations')
                .addOption('web-animations', 'Web Animations API')
                .addOption('custom', 'Custom Engine')
                .setValue(this.plugin.settings.rendering.animationEngine)
                .onChange(async (value) => {
                    this.plugin.settings.rendering.animationEngine = value as AnimationEngine;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('rendering.animationEngine', value);
                }));
    }

    private createStorageSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Storage Settings' });

        // 同期戦略の選択
        new Setting(containerEl)
            .setName('Sync strategy')
            .setDesc('How notes are synchronized')
            .addDropdown(dropdown => dropdown
                .addOption('real-time', 'Real-time')
                .addOption('manual', 'Manual')
                .addOption('periodic', 'Periodic')
                .setValue(this.plugin.settings.storage.syncStrategy)
                .onChange(async (value) => {
                    this.plugin.settings.storage.syncStrategy = value as SyncStrategy;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('storage.syncStrategy', value);
                }));

        // 競合解決の設定
        new Setting(containerEl)
            .setName('Conflict resolution')
            .setDesc('How to handle editing conflicts')
            .addDropdown(dropdown => dropdown
                .addOption('auto-merge', 'Auto merge')
                .addOption('user-choice', 'Ask user')
                .addOption('last-write-wins', 'Last write wins')
                .setValue(this.plugin.settings.storage.conflictResolution)
                .onChange(async (value) => {
                    this.plugin.settings.storage.conflictResolution = value as ConflictResolution;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('storage.conflictResolution', value);
                }));
    }

    private createExtensionSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Extensions' });

        // 拡張機能の自動読み込み
        new Setting(containerEl)
            .setName('Auto-load extensions')
            .setDesc('Automatically load available extensions')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.extensions.autoload)
                .onChange(async (value) => {
                    this.plugin.settings.extensions.autoload = value;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('extensions.autoload', value);
                }));

        // 実験的機能の許可
        new Setting(containerEl)
            .setName('Allow experimental features')
            .setDesc('Enable experimental and beta extensions')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.extensions.allowExperimental)
                .onChange(async (value) => {
                    this.plugin.settings.extensions.allowExperimental = value;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('extensions.allowExperimental', value);
                }));

        // 有効な拡張機能のリスト
        this.createExtensionList(containerEl);
    }

    private createExtensionList(containerEl: HTMLElement): void {
        const extensionListEl = containerEl.createDiv('postodo-extension-list');
        
        // 利用可能な拡張機能を取得
        const availableExtensions = this.plugin.extensionRegistry.getAvailableExtensions();
        const enabledExtensions = new Set(this.plugin.settings.extensions.enabled);

        availableExtensions.forEach(extension => {
            const extensionEl = extensionListEl.createDiv('postodo-extension-item');
            
            // 拡張機能情報
            const infoEl = extensionEl.createDiv('extension-info');
            infoEl.createEl('h4', { text: extension.name });
            infoEl.createEl('p', { text: extension.description });
            infoEl.createEl('span', { 
                text: `v${extension.version}`,
                cls: 'extension-version'
            });

            // 有効/無効トグル
            const toggleEl = extensionEl.createDiv('extension-toggle');
            new Setting(toggleEl)
                .addToggle(toggle => toggle
                    .setValue(enabledExtensions.has(extension.id))
                    .onChange(async (value) => {
                        if (value) {
                            this.plugin.settings.extensions.enabled.push(extension.id);
                            await this.plugin.extensionRegistry.activateExtension(extension.id);
                        } else {
                            const index = this.plugin.settings.extensions.enabled.indexOf(extension.id);
                            if (index > -1) {
                                this.plugin.settings.extensions.enabled.splice(index, 1);
                            }
                            await this.plugin.extensionRegistry.deactivateExtension(extension.id);
                        }
                        await this.plugin.saveSettings();
                    }));

            // 設定ボタン（拡張機能が設定を持つ場合）
            if (extension.hasSettings) {
                const settingsBtn = toggleEl.createEl('button', { 
                    text: 'Settings',
                    cls: 'mod-cta'
                });
                settingsBtn.onclick = () => {
                    this.openExtensionSettings(extension.id);
                };
            }
        });
    }

    private createAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Advanced Settings' });

        // デバッグモード
        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable debug logging and development tools')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.core.enableDebugMode)
                .onChange(async (value) => {
                    this.plugin.settings.core.enableDebugMode = value;
                    await this.plugin.saveSettings();
                    this.plugin.configProvider.set('core.enableDebugMode', value);
                    
                    if (value) {
                        this.plugin.debugManager.enableDebugMode();
                    } else {
                        this.plugin.debugManager.disableDebugMode();
                    }
                }));

        // 最大ノート数
        new Setting(containerEl)
            .setName('Max notes')
            .setDesc('Maximum number of notes allowed')
            .addText(text => text
                .setValue(this.plugin.settings.core.maxNotes.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        this.plugin.settings.core.maxNotes = numValue;
                        await this.plugin.saveSettings();
                        this.plugin.configProvider.set('core.maxNotes', numValue);
                    }
                }));

        // データクリア
        new Setting(containerEl)
            .setName('Clear all data')
            .setDesc('Delete all notes and reset settings')
            .addButton(button => button
                .setButtonText('Clear Data')
                .setWarning()
                .onClick(async () => {
                    const confirmed = await this.confirmDataClear();
                    if (confirmed) {
                        await this.plugin.clearAllData();
                    }
                }));
    }

    private async confirmDataClear(): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ConfirmationModal(
                this.app,
                'Clear All Data',
                'This will permanently delete all Postodo notes and reset all settings. This action cannot be undone.',
                resolve
            );
            modal.open();
        });
    }

    private openExtensionSettings(extensionId: string): void {
        // 拡張機能固有の設定画面を開く
        const extension = this.plugin.extensionRegistry.getExtension(extensionId);
        if (extension && extension.openSettings) {
            extension.openSettings();
        }
    }
}

// 確認ダイアログ
class ConfirmationModal extends Modal {
    constructor(
        app: App,
        private title: string,
        private message: string,
        private callback: (confirmed: boolean) => void
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });

        const buttonContainer = contentEl.createDiv('modal-button-container');
        
        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.onclick = () => {
            this.callback(false);
            this.close();
        };

        const confirmBtn = buttonContainer.createEl('button', { 
            text: 'Confirm',
            cls: 'mod-warning'
        });
        confirmBtn.onclick = () => {
            this.callback(true);
            this.close();
        };
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
```

### メインプラグインクラスでの統合
```typescript
// src/core/plugin.ts
export class PostodoPlugin extends Plugin {
    settings!: PostodoSettings;
    configProvider!: ConfigProvider;
    extensionRegistry!: ExtensionRegistry;
    // ... その他のサービス

    async onload() {
        // 設定の読み込み
        await this.loadSettings();
        
        // 設定タブの追加
        this.addSettingTab(new PostodoSettingsTab(this.app, this));
        
        // DIコンテナの初期化
        this.initializeDIContainer();
        
        // 設定変更の監視とDIシステムへの反映
        this.setupSettingsSync();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // 設定変更をシステム全体に通知
        this.configProvider.notifySettingsChanged(this.settings);
    }

    private setupSettingsSync(): void {
        // Obsidian設定 → DIシステム への同期
        this.configProvider.syncFromObsidianSettings(this.settings);
        
        // DIシステム → Obsidian設定 への同期
        this.configProvider.onConfigChange((path: string, value: any) => {
            this.updateObsidianSetting(path, value);
        });
    }

    private updateObsidianSetting(path: string, value: any): void {
        const pathParts = path.split('.');
        let current: any = this.settings;
        
        // ネストされた設定の更新
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) {
                current[pathParts[i]] = {};
            }
            current = current[pathParts[i]];
        }
        
        current[pathParts[pathParts.length - 1]] = value;
        this.saveSettings();
    }
}
```

### 設定の型定義更新
```typescript
// src/types/config-types.ts
export interface PostodoSettings {
    // Obsidianネイティブ設定
    postodoFolder: string;
    canvasFileName: string;
    
    // アプリケーション設定（DIシステムと連携）
    core: {
        maxNotes: number;
        autoSave: boolean;
        saveInterval: number;
        enableDebugMode: boolean;
    };
    
    rendering: {
        engine: RenderingEngine;
        virtualization: boolean;
        maxRenderedNotes: number;
        animationEngine: AnimationEngine;
    };
    
    storage: {
        adapter: StorageAdapter;
        syncStrategy: SyncStrategy;
        conflictResolution: ConflictResolution;
    };
    
    input: {
        enableTouch: boolean;
        enableMouse: boolean;
        enableKeyboard: boolean;
        gestureRecognition: boolean;
    };
    
    ui: {
        theme: string;
        layout: string;
        showGrid: boolean;
        snapToGrid: boolean;
    };
    
    extensions: {
        enabled: string[];
        autoload: boolean;
        allowExperimental: boolean;
    };
}

export type RenderingEngine = 'dom' | 'canvas' | 'svg';
export type AnimationEngine = 'css' | 'web-animations' | 'custom';
export type StorageAdapter = 'obsidian-vault' | 'memory' | 'custom';
export type SyncStrategy = 'real-time' | 'manual' | 'periodic';
export type ConflictResolution = 'auto-merge' | 'user-choice' | 'last-write-wins';
```

この実装により、Obsidianの設定システムと疎結合DIシステムが完全に統合されます！