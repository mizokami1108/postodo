import { Plugin } from 'obsidian';
import { PostodoPlugin } from './src/core/plugin';

// Obsidianプラグインのエントリーポイント
export default class PostodoMainPlugin extends Plugin {
    private postodoPlugin!: PostodoPlugin;

    async onload() {
        console.log('PostodoMainPlugin: Starting onload');
        try {
            // PostodoPluginの初期化と委譲
            this.postodoPlugin = new PostodoPlugin(this.app, this);
            await this.postodoPlugin.onload();
            console.log('PostodoMainPlugin: onload completed successfully');
        } catch (error) {
            console.error('PostodoMainPlugin: Error during onload:', error);
        }
    }

    async onunload() {
        console.log('PostodoMainPlugin: Starting onunload');
        try {
            if (this.postodoPlugin) {
                await this.postodoPlugin.onunload();
            }
            console.log('PostodoMainPlugin: onunload completed successfully');
        } catch (error) {
            console.error('PostodoMainPlugin: Error during onunload:', error);
        }
    }
}