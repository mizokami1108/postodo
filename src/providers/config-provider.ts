import { DeepPartial, PostodoConfig, ConfigWatcher, ExtensionConfig } from '../types/config-types';
import { DEFAULT_SETTINGS } from '../types/config-types';

export class ConfigProvider {
    private config: DeepPartial<PostodoConfig>;
    private watchers = new Map<string, ConfigWatcher[]>();

    constructor(initialConfig?: DeepPartial<PostodoConfig>) {
        this.config = this.mergeConfigs([
            DEFAULT_SETTINGS,
            initialConfig || {}
        ]);
    }

    get<T>(path: string): T {
        return this.getValueByPath(this.config, path);
    }

    set<T>(path: string, value: T): void {
        this.setValueByPath(this.config, path, value);
        this.notifyWatchers(path, value);
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

    updateFromSettings(settings: any): void {
        this.config = this.mergeConfigs([this.config, settings]);
        this.notifyAllWatchers();
    }

    private getValueByPath(obj: any, path: string): any {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    private setValueByPath(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    private notifyWatchers(path: string, value: any): void {
        const watchers = this.watchers.get(path) || [];
        watchers.forEach(callback => {
            try {
                callback(value, path);
            } catch (error) {
                console.error(`Error in config watcher for ${path}:`, error);
            }
        });
    }

    private notifyAllWatchers(): void {
        for (const [path, watchers] of this.watchers) {
            const value = this.get(path);
            watchers.forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error(`Error in config watcher for ${path}:`, error);
                }
            });
        }
    }

    private mergeConfigs(configs: any[]): any {
        return configs.reduce((merged, config) => {
            return this.deepMerge(merged, config);
        }, {});
    }

    private deepMerge(target: any, source: any): any {
        if (source === null || source === undefined) {
            return target;
        }

        if (typeof source !== 'object' || Array.isArray(source)) {
            return source;
        }

        const result = { ...target };

        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }

        return result;
    }
}