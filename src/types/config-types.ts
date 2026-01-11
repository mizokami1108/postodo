// 設定システムの型定義
export interface PostodoConfig {
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
    noteDefaults: {
        color: NoteColorType;
        size: NoteSizeType;
    };
}

export interface PostodoSettings extends PostodoConfig {
    // Obsidianネイティブ設定
    postodoFolder: string;
    canvasFileName: string;
    // 命名戦略設定
    namingStrategy: NamingStrategyType;
    // 表示フィルター設定
    defaultDisplayFilter: DisplayFilterType;
    // 言語設定
    language: LanguageType;
}

export type LanguageType = 'en' | 'ja';

export type RenderingEngine = 'dom' | 'canvas' | 'svg';
export type AnimationEngine = 'css' | 'web-animations' | 'custom';
export type StorageAdapter = 'obsidian-vault' | 'memory' | 'custom';
export type SyncStrategy = 'real-time' | 'manual' | 'periodic';
export type ConflictResolution = 'auto-merge' | 'user-choice' | 'last-write-wins';
export type NamingStrategyType = 'timestamp' | 'sequential' | 'custom';
export type DisplayFilterType = 'incomplete' | 'complete' | 'all';
export type NoteColorType = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';
export type NoteSizeType = 'small' | 'medium' | 'large';

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ConfigWatcher = (value: any, path: string) => void;

export interface ExtensionConfig {
    get<T>(key: string): T;
    set<T>(key: string, value: T): void;
    watch(key: string, callback: ConfigWatcher): () => void;
}

// デフォルト設定
export const DEFAULT_SETTINGS: PostodoSettings = {
    postodoFolder: 'Postodo',
    canvasFileName: 'postodo-canvas.md',
    namingStrategy: 'timestamp',
    defaultDisplayFilter: 'incomplete',
    language: 'ja',
    core: {
        maxNotes: 1000,
        autoSave: true,
        saveInterval: 500,
        enableDebugMode: false
    },
    rendering: {
        engine: 'dom',
        virtualization: true,
        maxRenderedNotes: 100,
        animationEngine: 'css'
    },
    storage: {
        adapter: 'obsidian-vault',
        syncStrategy: 'real-time',
        conflictResolution: 'auto-merge'
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
    },
    noteDefaults: {
        color: 'yellow',
        size: 'medium'
    }
};