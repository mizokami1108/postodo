// 基本的な型定義
export interface Position {
    x: number;
    y: number;
    zIndex: number;
}

export interface Dimensions {
    width: number;
    height: number;
}

export interface StickyNote {
    readonly id: string;
    readonly filePath: string;
    title: string;
    content: string;
    position: Position;
    dimensions: Dimensions;
    appearance: Appearance;
    metadata: NoteMetadata;
    completed: boolean;
}

export interface Appearance {
    color: NoteColor;
    size: NoteSize;
    rotation: number;
}

export interface TaskInfo {
    dueDate?: string;
    scheduledDate?: string;
    startDate?: string;
    recurrence?: string;
    priority?: 'highest' | 'high' | 'low';
    lineNumber?: number;
}

export interface NoteMetadata {
    created: string;
    modified: string;
    tags: string[];
    links: string[];
    attachments: string[];
    taskInfo?: TaskInfo;
}

export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple';
export type NoteSize = 'small' | 'medium' | 'large';

export interface CreateNoteOptions {
    title?: string;
    content: string;
    position?: Position;
    dimensions?: Dimensions;
    appearance?: Partial<Appearance>;
    completed?: boolean;
}

export interface UpdateNoteOptions {
    title?: string;
    content?: string;
    position?: Position;
    dimensions?: Dimensions;
    appearance?: Partial<Appearance>;
    completed?: boolean;
}

// イベント型
export interface PostodoEvents {
    'note-created': { note: StickyNote };
    'note-updated': { note: StickyNote; changes: UpdateNoteOptions };
    'note-deleted': { id: string };
    'canvas-zoom-changed': { zoom: number };
    'theme-changed': { themeId: string };
}

// 結果型
export type Result<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };

// サービストークン
export const SERVICE_TOKENS = {
    // Core Services
    EVENT_BUS: 'EventBus',
    LOGGER: 'Logger',
    CONFIG: 'Config',
    
    // Storage Services
    STORAGE_ADAPTER: 'StorageAdapter',
    SYNC_STRATEGY: 'SyncStrategy',
    CONFLICT_RESOLVER: 'ConflictResolver',
    
    // Data Services
    DATA_MANAGER: 'DataManager',
    NOTE_REPOSITORY: 'NoteRepository',
    
    // UI Services
    THEME_PROVIDER: 'ThemeProvider',
    LAYOUT_MANAGER: 'LayoutManager'
} as const;

export type ServiceToken = typeof SERVICE_TOKENS[keyof typeof SERVICE_TOKENS];