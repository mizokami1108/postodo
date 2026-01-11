import { App, PluginSettingTab, Setting, Modal, Plugin } from 'obsidian';
import { PostodoPlugin } from '../core/plugin';
import { PostodoSettings, NamingStrategyType, DisplayFilterType, LanguageType, NoteColorType, NoteSizeType } from '../types/config-types';
import { getTranslations, Translations, Language } from '../i18n/translations';

export class PostodoSettingsTab extends PluginSettingTab {
    postodoPlugin: PostodoPlugin;
    private t: Translations;

    constructor(app: App, plugin: Plugin, postodoPlugin: PostodoPlugin) {
        super(app, plugin);
        this.postodoPlugin = postodoPlugin;
        this.t = getTranslations(this.postodoPlugin.getSettings().language as Language || 'ja');
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // 翻訳を更新
        this.t = getTranslations(this.postodoPlugin.getSettings().language as Language || 'ja');

        containerEl.createEl('h2', { text: this.t.settings.title });

        // 1. 言語設定（最上部）
        this.createLanguageSettings(containerEl);
        
        // 2. 付箋のデフォルト（色・サイズ）
        this.createNoteDefaultsSettings(containerEl);
        
        // 3. 表示フィルター
        this.createDisplayFilterSettings(containerEl);
        
        // 4. 基本設定（フォルダ、自動保存）
        this.createBasicSettings(containerEl);
        
        // 5. 命名規則
        this.createNamingSettings(containerEl);
        
        // 6. 外観（グリッド）
        this.createUISettings(containerEl);
        
        // 7. 詳細設定（描画、同期、デバッグ等）
        this.createRenderingSettings(containerEl);
        this.createStorageSettings(containerEl);
        this.createAdvancedSettings(containerEl);
    }

    private createLanguageSettings(containerEl: HTMLElement): void {
        const settings = this.postodoPlugin.getSettings();

        new Setting(containerEl)
            .setName(this.t.settings.language.name)
            .setDesc(this.t.settings.language.desc)
            .addDropdown(dropdown => dropdown
                .addOption('en', 'English')
                .addOption('ja', '日本語')
                .setValue(settings.language || 'ja')
                .onChange(async (value) => {
                    settings.language = value as LanguageType;
                    await this.postodoPlugin.saveSettings();
                    // 設定画面を再描画して言語を反映
                    this.display();
                }));
    }

    private createBasicSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.basic.title });

        const settings = this.postodoPlugin.getSettings();

        // 付箋フォルダーの設定
        new Setting(containerEl)
            .setName(this.t.settings.basic.notesFolder.name)
            .setDesc(this.t.settings.basic.notesFolder.desc)
            .addText(text => text
                .setPlaceholder('Postodo')
                .setValue(settings.postodoFolder)
                .onChange(async (value) => {
                    settings.postodoFolder = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 自動保存の設定
        new Setting(containerEl)
            .setName(this.t.settings.basic.autoSave.name)
            .setDesc(this.t.settings.basic.autoSave.desc)
            .addToggle(toggle => toggle
                .setValue(settings.core.autoSave)
                .onChange(async (value) => {
                    settings.core.autoSave = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 保存間隔の設定
        new Setting(containerEl)
            .setName(this.t.settings.basic.saveInterval.name)
            .setDesc(this.t.settings.basic.saveInterval.desc)
            .addSlider(slider => slider
                .setLimits(100, 5000, 100)
                .setValue(settings.core.saveInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.core.saveInterval = value;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createNamingSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.naming.title });

        const settings = this.postodoPlugin.getSettings();

        // 命名戦略の選択
        new Setting(containerEl)
            .setName(this.t.settings.naming.strategy.name)
            .setDesc(this.t.settings.naming.strategy.desc)
            .addDropdown(dropdown => dropdown
                .addOption('timestamp', this.t.settings.naming.strategy.options.timestamp)
                .addOption('sequential', this.t.settings.naming.strategy.options.sequential)
                .addOption('custom', this.t.settings.naming.strategy.options.custom)
                .setValue(settings.namingStrategy)
                .onChange(async (value) => {
                    settings.namingStrategy = value as NamingStrategyType;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createDisplayFilterSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.displayFilter.title });

        const settings = this.postodoPlugin.getSettings();

        // デフォルト表示フィルターの選択
        new Setting(containerEl)
            .setName(this.t.settings.displayFilter.default.name)
            .setDesc(this.t.settings.displayFilter.default.desc)
            .addDropdown(dropdown => dropdown
                .addOption('incomplete', this.t.settings.displayFilter.default.options.incomplete)
                .addOption('complete', this.t.settings.displayFilter.default.options.complete)
                .addOption('all', this.t.settings.displayFilter.default.options.all)
                .setValue(settings.defaultDisplayFilter)
                .onChange(async (value) => {
                    settings.defaultDisplayFilter = value as DisplayFilterType;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createRenderingSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.rendering.title });

        const settings = this.postodoPlugin.getSettings();

        // 仮想化の設定
        new Setting(containerEl)
            .setName(this.t.settings.rendering.virtualization.name)
            .setDesc(this.t.settings.rendering.virtualization.desc)
            .addToggle(toggle => toggle
                .setValue(settings.rendering.virtualization)
                .onChange(async (value) => {
                    settings.rendering.virtualization = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 最大レンダリング数
        new Setting(containerEl)
            .setName(this.t.settings.rendering.maxRenderedNotes.name)
            .setDesc(this.t.settings.rendering.maxRenderedNotes.desc)
            .addSlider(slider => slider
                .setLimits(20, 500, 10)
                .setValue(settings.rendering.maxRenderedNotes)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.rendering.maxRenderedNotes = value;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createStorageSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.storage.title });

        const settings = this.postodoPlugin.getSettings();

        // 同期戦略の選択
        new Setting(containerEl)
            .setName(this.t.settings.storage.syncStrategy.name)
            .setDesc(this.t.settings.storage.syncStrategy.desc)
            .addDropdown(dropdown => dropdown
                .addOption('real-time', this.t.settings.storage.syncStrategy.options.realTime)
                .addOption('manual', this.t.settings.storage.syncStrategy.options.manual)
                .addOption('periodic', this.t.settings.storage.syncStrategy.options.periodic)
                .setValue(settings.storage.syncStrategy)
                .onChange(async (value) => {
                    settings.storage.syncStrategy = value as any;
                    await this.postodoPlugin.saveSettings();
                }));

        // 競合解決の設定
        new Setting(containerEl)
            .setName(this.t.settings.storage.conflictResolution.name)
            .setDesc(this.t.settings.storage.conflictResolution.desc)
            .addDropdown(dropdown => dropdown
                .addOption('auto-merge', this.t.settings.storage.conflictResolution.options.autoMerge)
                .addOption('user-choice', this.t.settings.storage.conflictResolution.options.userChoice)
                .addOption('last-write-wins', this.t.settings.storage.conflictResolution.options.lastWriteWins)
                .setValue(settings.storage.conflictResolution)
                .onChange(async (value) => {
                    settings.storage.conflictResolution = value as any;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createUISettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.ui.title });

        const settings = this.postodoPlugin.getSettings();

        // グリッド表示
        new Setting(containerEl)
            .setName(this.t.settings.ui.showGrid.name)
            .setDesc(this.t.settings.ui.showGrid.desc)
            .addToggle(toggle => toggle
                .setValue(settings.ui.showGrid)
                .onChange(async (value) => {
                    settings.ui.showGrid = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // グリッドスナップ
        new Setting(containerEl)
            .setName(this.t.settings.ui.snapToGrid.name)
            .setDesc(this.t.settings.ui.snapToGrid.desc)
            .addToggle(toggle => toggle
                .setValue(settings.ui.snapToGrid)
                .onChange(async (value) => {
                    settings.ui.snapToGrid = value;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createNoteDefaultsSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.noteDefaults.title });

        const settings = this.postodoPlugin.getSettings();

        // デフォルトの色
        new Setting(containerEl)
            .setName(this.t.settings.noteDefaults.color.name)
            .setDesc(this.t.settings.noteDefaults.color.desc)
            .addDropdown(dropdown => dropdown
                .addOption('yellow', this.t.common.colors.yellow)
                .addOption('pink', this.t.common.colors.pink)
                .addOption('blue', this.t.common.colors.blue)
                .addOption('green', this.t.common.colors.green)
                .addOption('orange', this.t.common.colors.orange)
                .addOption('purple', this.t.common.colors.purple)
                .setValue(settings.noteDefaults?.color || 'yellow')
                .onChange(async (value) => {
                    if (!settings.noteDefaults) {
                        settings.noteDefaults = { color: 'yellow', size: 'medium' };
                    }
                    settings.noteDefaults.color = value as NoteColorType;
                    await this.postodoPlugin.saveSettings();
                }));

        // デフォルトのサイズ
        new Setting(containerEl)
            .setName(this.t.settings.noteDefaults.size.name)
            .setDesc(this.t.settings.noteDefaults.size.desc)
            .addDropdown(dropdown => dropdown
                .addOption('small', this.t.common.sizes.small)
                .addOption('medium', this.t.common.sizes.medium)
                .addOption('large', this.t.common.sizes.large)
                .setValue(settings.noteDefaults?.size || 'medium')
                .onChange(async (value) => {
                    if (!settings.noteDefaults) {
                        settings.noteDefaults = { color: 'yellow', size: 'medium' };
                    }
                    settings.noteDefaults.size = value as NoteSizeType;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: this.t.settings.advanced.title });

        const settings = this.postodoPlugin.getSettings();

        // デバッグモード
        new Setting(containerEl)
            .setName(this.t.settings.advanced.debugMode.name)
            .setDesc(this.t.settings.advanced.debugMode.desc)
            .addToggle(toggle => toggle
                .setValue(settings.core.enableDebugMode)
                .onChange(async (value) => {
                    settings.core.enableDebugMode = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 最大ノート数
        new Setting(containerEl)
            .setName(this.t.settings.advanced.maxNotes.name)
            .setDesc(this.t.settings.advanced.maxNotes.desc)
            .addText(text => text
                .setValue(settings.core.maxNotes.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                        settings.core.maxNotes = numValue;
                        await this.postodoPlugin.saveSettings();
                    }
                }));

        // データクリア
        new Setting(containerEl)
            .setName(this.t.settings.advanced.clearData.name)
            .setDesc(this.t.settings.advanced.clearData.desc)
            .addButton(button => button
                .setButtonText(this.t.settings.advanced.clearData.button)
                .setWarning()
                .onClick(async () => {
                    const confirmed = await this.confirmDataClear();
                    if (confirmed) {
                        await this.clearAllData();
                    }
                }));
    }

    private async confirmDataClear(): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ConfirmationModal(
                this.app,
                this.t.settings.advanced.clearData.confirmTitle,
                this.t.settings.advanced.clearData.confirmMessage,
                this.t.settings.advanced.clearData.cancel,
                this.t.settings.advanced.clearData.confirm,
                resolve
            );
            modal.open();
        });
    }

    private async clearAllData(): Promise<void> {
        const dataManager = this.postodoPlugin.getContainer().resolve('DataManager') as any;
        const result = await dataManager.getAllNotes();
        
        if (result.success) {
            for (const note of result.data) {
                await dataManager.deleteNote(note.id);
            }
        }
    }
}

// 確認ダイアログ
class ConfirmationModal extends Modal {
    constructor(
        app: App,
        private title: string,
        private message: string,
        private cancelText: string,
        private confirmText: string,
        private callback: (confirmed: boolean) => void
    ) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: this.title });
        contentEl.createEl('p', { text: this.message });

        const buttonContainer = contentEl.createDiv('modal-button-container');
        
        const cancelBtn = buttonContainer.createEl('button', { text: this.cancelText });
        cancelBtn.onclick = () => {
            this.callback(false);
            this.close();
        };

        const confirmBtn = buttonContainer.createEl('button', { 
            text: this.confirmText,
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
