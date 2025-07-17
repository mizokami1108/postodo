import { App, PluginSettingTab, Setting, Modal, Plugin } from 'obsidian';
import { PostodoPlugin } from '../core/plugin';
import { PostodoSettings } from '../types/config-types';

export class PostodoSettingsTab extends PluginSettingTab {
    postodoPlugin: PostodoPlugin;

    constructor(app: App, plugin: Plugin, postodoPlugin: PostodoPlugin) {
        super(app, plugin);
        this.postodoPlugin = postodoPlugin;
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
        
        // UI設定セクション
        this.createUISettings(containerEl);
        
        // 高度な設定セクション
        this.createAdvancedSettings(containerEl);
    }

    private createBasicSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Basic Settings' });

        const settings = this.postodoPlugin.getSettings();

        // 付箋フォルダーの設定
        new Setting(containerEl)
            .setName('Notes folder')
            .setDesc('Folder where Postodo notes will be stored')
            .addText(text => text
                .setPlaceholder('Postodo')
                .setValue(settings.postodoFolder)
                .onChange(async (value) => {
                    settings.postodoFolder = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 自動保存の設定
        new Setting(containerEl)
            .setName('Auto save')
            .setDesc('Automatically save notes when modified')
            .addToggle(toggle => toggle
                .setValue(settings.core.autoSave)
                .onChange(async (value) => {
                    settings.core.autoSave = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 保存間隔の設定
        new Setting(containerEl)
            .setName('Save interval (ms)')
            .setDesc('How often to save notes automatically')
            .addSlider(slider => slider
                .setLimits(100, 5000, 100)
                .setValue(settings.core.saveInterval)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    settings.core.saveInterval = value;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createRenderingSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Rendering Settings' });

        const settings = this.postodoPlugin.getSettings();

        // 仮想化の設定
        new Setting(containerEl)
            .setName('Enable virtualization')
            .setDesc('Improve performance with many notes')
            .addToggle(toggle => toggle
                .setValue(settings.rendering.virtualization)
                .onChange(async (value) => {
                    settings.rendering.virtualization = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 最大レンダリング数
        new Setting(containerEl)
            .setName('Max rendered notes')
            .setDesc('Maximum number of notes to render at once')
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
        containerEl.createEl('h3', { text: 'Storage Settings' });

        const settings = this.postodoPlugin.getSettings();

        // 同期戦略の選択
        new Setting(containerEl)
            .setName('Sync strategy')
            .setDesc('How notes are synchronized')
            .addDropdown(dropdown => dropdown
                .addOption('real-time', 'Real-time')
                .addOption('manual', 'Manual')
                .addOption('periodic', 'Periodic')
                .setValue(settings.storage.syncStrategy)
                .onChange(async (value) => {
                    settings.storage.syncStrategy = value as any;
                    await this.postodoPlugin.saveSettings();
                }));

        // 競合解決の設定
        new Setting(containerEl)
            .setName('Conflict resolution')
            .setDesc('How to handle editing conflicts')
            .addDropdown(dropdown => dropdown
                .addOption('auto-merge', 'Auto merge')
                .addOption('user-choice', 'Ask user')
                .addOption('last-write-wins', 'Last write wins')
                .setValue(settings.storage.conflictResolution)
                .onChange(async (value) => {
                    settings.storage.conflictResolution = value as any;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createUISettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'UI Settings' });

        const settings = this.postodoPlugin.getSettings();

        // グリッド表示
        new Setting(containerEl)
            .setName('Show grid')
            .setDesc('Display grid lines on canvas')
            .addToggle(toggle => toggle
                .setValue(settings.ui.showGrid)
                .onChange(async (value) => {
                    settings.ui.showGrid = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // グリッドスナップ
        new Setting(containerEl)
            .setName('Snap to grid')
            .setDesc('Snap notes to grid when moving')
            .addToggle(toggle => toggle
                .setValue(settings.ui.snapToGrid)
                .onChange(async (value) => {
                    settings.ui.snapToGrid = value;
                    await this.postodoPlugin.saveSettings();
                }));
    }

    private createAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Advanced Settings' });

        const settings = this.postodoPlugin.getSettings();

        // デバッグモード
        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable debug logging and development tools')
            .addToggle(toggle => toggle
                .setValue(settings.core.enableDebugMode)
                .onChange(async (value) => {
                    settings.core.enableDebugMode = value;
                    await this.postodoPlugin.saveSettings();
                }));

        // 最大ノート数
        new Setting(containerEl)
            .setName('Max notes')
            .setDesc('Maximum number of notes allowed')
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
            .setName('Clear all data')
            .setDesc('Delete all notes and reset settings')
            .addButton(button => button
                .setButtonText('Clear Data')
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
                'Clear All Data',
                'This will permanently delete all Postodo notes. This action cannot be undone.',
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