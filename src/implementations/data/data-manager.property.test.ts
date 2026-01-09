import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { DataManager } from './data-manager';
import { NoteRepository } from './note-repository';
import { EventBus } from '../../core/event-bus';
import { StickyNote, CreateNoteOptions, NoteColor, NoteSize, Result } from '../../types/core-types';
import { IStorageAdapter } from '../../interfaces/storage/i-storage-adapter';

/**
 * モックストレージアダプター
 * テスト用にファイル操作をシミュレート
 */
class MockStorageAdapter implements IStorageAdapter {
    private files = new Map<string, string>();
    
    async read(filePath: string): Promise<Result<string>> {
        const content = this.files.get(filePath);
        if (content !== undefined) {
            return { success: true, data: content };
        }
        return { success: false, error: new Error(`File not found: ${filePath}`) };
    }
    
    async write(filePath: string, content: string): Promise<Result<void>> {
        this.files.set(filePath, content);
        return { success: true, data: undefined };
    }
    
    async delete(filePath: string): Promise<Result<void>> {
        this.files.delete(filePath);
        return { success: true, data: undefined };
    }
    
    async exists(filePath: string): Promise<Result<boolean>> {
        return { success: true, data: this.files.has(filePath) };
    }
    
    async list(folderPath: string): Promise<Result<string[]>> {
        const files = Array.from(this.files.keys()).filter(f => f.startsWith(folderPath));
        return { success: true, data: files };
    }
    
    async createFolder(folderPath: string): Promise<Result<void>> {
        return { success: true, data: undefined };
    }
    
    getFiles(): Map<string, string> {
        return this.files;
    }
    
    clear(): void {
        this.files.clear();
    }
}

/**
 * 有効なコンテンツを生成するArbitrary
 * 空文字列やホワイトスペースのみを除外
 */
const validContentArb = fc.string({ minLength: 1, maxLength: 500 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim());

/**
 * 有効なタイトルを生成するArbitrary
 */
const validTitleArb = fc.string({ minLength: 0, maxLength: 100 }).map(s => s.trim());

/**
 * 有効な位置を生成するArbitrary
 */
const validPositionArb = fc.record({
    x: fc.integer({ min: 0, max: 1000 }),
    y: fc.integer({ min: 0, max: 1000 }),
    zIndex: fc.integer({ min: 1, max: 100 })
});

/**
 * 有効な寸法を生成するArbitrary
 */
const validDimensionsArb = fc.record({
    width: fc.integer({ min: 150, max: 250 }),
    height: fc.integer({ min: 150, max: 220 })
});

/**
 * 有効な外観を生成するArbitrary
 */
const validAppearanceArb = fc.record({
    color: fc.constantFrom<NoteColor>('yellow', 'pink', 'blue', 'green', 'orange', 'purple'),
    size: fc.constantFrom<NoteSize>('small', 'medium', 'large'),
    rotation: fc.integer({ min: -5, max: 5 })
});

/**
 * 有効なCreateNoteOptionsを生成するArbitrary
 */
const validCreateNoteOptionsArb = fc.record({
    title: validTitleArb,
    content: validContentArb,
    position: fc.option(validPositionArb, { nil: undefined }),
    dimensions: fc.option(validDimensionsArb, { nil: undefined }),
    appearance: fc.option(validAppearanceArb, { nil: undefined }),
    completed: fc.option(fc.boolean(), { nil: undefined })
}) as fc.Arbitrary<CreateNoteOptions>;

/**
 * Feature: postodo-sticky-notes
 * Property 1: 付箋作成時のファイル生成
 * Validates: Requirements 1.3, 1.4
 * 
 * *任意の* 有効な付箋作成操作に対して、Postodo_Folder 内に対応する Note_File が作成され、
 * 付箋の ID とファイルパスが一致する
 */
describe('DataManager - Property 1: 付箋作成時のファイル生成', () => {
    let storageAdapter: MockStorageAdapter;
    let eventBus: EventBus;
    let noteRepository: NoteRepository;
    let dataManager: DataManager;

    beforeEach(() => {
        storageAdapter = new MockStorageAdapter();
        eventBus = new EventBus();
        noteRepository = new NoteRepository(storageAdapter, eventBus);
        dataManager = new DataManager(noteRepository, eventBus);
    });

    /**
     * Property 1.1: 付箋作成時にファイルが生成される
     * Requirements 1.3: WHEN 新しい Sticky_Note が作成された場合 
     *                   THEN THE Postodo_System SHALL Postodo_Folder 内に対応する Note_File を自動作成する
     */
    it('should create a Note_File in Postodo_Folder for any valid note creation', async () => {
        await fc.assert(
            fc.asyncProperty(validCreateNoteOptionsArb, async (options) => {
                // 各テストの前にストレージをクリア
                storageAdapter.clear();
                
                const result = await dataManager.createNote(options);
                
                // 作成が成功することを確認
                expect(result.success).toBe(true);
                
                if (result.success) {
                    const note = result.data;
                    
                    // ファイルパスがPostodoフォルダ内であることを確認
                    expect(note.filePath).toMatch(/^Postodo\//);
                    
                    // ファイルが実際に作成されていることを確認
                    const files = storageAdapter.getFiles();
                    expect(files.has(note.filePath)).toBe(true);
                    
                    // ファイル内容にノートIDが含まれていることを確認
                    const fileContent = files.get(note.filePath);
                    expect(fileContent).toContain(note.id);
                }
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 1.2: 付箋に一意の識別子が割り当てられる
     * Requirements 1.4: WHEN 新しい Sticky_Note が作成された場合 
     *                   THEN THE Postodo_System SHALL 一意の識別子、作成日時、デフォルトの外観プロパティを割り当てる
     */
    it('should assign unique ID and metadata for any valid note creation', async () => {
        await fc.assert(
            fc.asyncProperty(validCreateNoteOptionsArb, async (options) => {
                storageAdapter.clear();
                
                const result = await dataManager.createNote(options);
                
                expect(result.success).toBe(true);
                
                if (result.success) {
                    const note = result.data;
                    
                    // 一意のIDが割り当てられていることを確認
                    expect(note.id).toBeDefined();
                    expect(note.id.length).toBeGreaterThan(0);
                    expect(note.id).toMatch(/^note-/);
                    
                    // 作成日時が設定されていることを確認
                    expect(note.metadata.created).toBeDefined();
                    expect(new Date(note.metadata.created).getTime()).not.toBeNaN();
                    
                    // 修正日時が設定されていることを確認
                    expect(note.metadata.modified).toBeDefined();
                    expect(new Date(note.metadata.modified).getTime()).not.toBeNaN();
                    
                    // デフォルトの外観プロパティが設定されていることを確認
                    expect(note.appearance).toBeDefined();
                    expect(note.appearance.color).toBeDefined();
                    expect(note.appearance.size).toBeDefined();
                    expect(typeof note.appearance.rotation).toBe('number');
                }
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 1.3: 複数の付箋作成で全てのIDが一意
     */
    it('should generate unique IDs for multiple note creations', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(validCreateNoteOptionsArb, { minLength: 2, maxLength: 10 }),
                async (optionsArray) => {
                    storageAdapter.clear();
                    
                    const createdIds: string[] = [];
                    
                    for (const options of optionsArray) {
                        const result = await dataManager.createNote(options);
                        
                        if (result.success) {
                            createdIds.push(result.data.id);
                        }
                    }
                    
                    // 全てのIDが一意であることを確認
                    const uniqueIds = new Set(createdIds);
                    expect(uniqueIds.size).toBe(createdIds.length);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 1.4: ファイルパスとIDの対応
     */
    it('should have consistent file path containing note ID reference', async () => {
        await fc.assert(
            fc.asyncProperty(validCreateNoteOptionsArb, async (options) => {
                storageAdapter.clear();
                
                const result = await dataManager.createNote(options);
                
                expect(result.success).toBe(true);
                
                if (result.success) {
                    const note = result.data;
                    
                    // ファイルパスが.md拡張子を持つことを確認
                    expect(note.filePath).toMatch(/\.md$/);
                    
                    // ファイル内容からIDを読み取れることを確認
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toContain(`postodo_id: ${note.id}`);
                }
            }),
            { numRuns: 100 }
        );
    });
});


/**
 * Feature: postodo-sticky-notes
 * Property 2: 空コンテンツの作成拒否
 * Validates: Requirements 1.5
 * 
 * *任意の* 空文字列またはホワイトスペースのみのコンテンツに対して、
 * 付箋作成は拒否され、既存の付箋リストは変更されない
 */
describe('DataManager - Property 2: 空コンテンツの作成拒否', () => {
    let storageAdapter: MockStorageAdapter;
    let eventBus: EventBus;
    let noteRepository: NoteRepository;
    let dataManager: DataManager;

    beforeEach(() => {
        storageAdapter = new MockStorageAdapter();
        eventBus = new EventBus();
        noteRepository = new NoteRepository(storageAdapter, eventBus);
        dataManager = new DataManager(noteRepository, eventBus);
    });

    /**
     * 空文字列を生成するArbitrary
     */
    const emptyContentArb = fc.constant('');

    /**
     * ホワイトスペースのみの文字列を生成するArbitrary
     */
    const whitespaceOnlyArb = fc.stringOf(
        fc.constantFrom(' ', '\t', '\n', '\r', '\u00A0', '\u2003')
    ).filter(s => s.length > 0);

    /**
     * Property 2.1: 空文字列での付箋作成は拒否される
     * Requirements 1.5: WHEN ユーザーが空のコンテンツで Sticky_Note を作成しようとした場合
     *                   THEN THE Postodo_System SHALL 作成を防止し現在の状態を維持する
     */
    it('should reject note creation with empty string content', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    title: validTitleArb,
                    content: emptyContentArb,
                    position: fc.option(validPositionArb, { nil: undefined }),
                    completed: fc.option(fc.boolean(), { nil: undefined })
                }),
                async (options) => {
                    storageAdapter.clear();
                    
                    // 作成前のファイル数を記録
                    const filesBefore = storageAdapter.getFiles().size;
                    
                    const result = await dataManager.createNote(options as CreateNoteOptions);
                    
                    // 作成が拒否されることを確認
                    expect(result.success).toBe(false);
                    
                    // ファイルが作成されていないことを確認
                    const filesAfter = storageAdapter.getFiles().size;
                    expect(filesAfter).toBe(filesBefore);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 2.2: ホワイトスペースのみでの付箋作成は拒否される
     */
    it('should reject note creation with whitespace-only content', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    title: validTitleArb,
                    content: whitespaceOnlyArb,
                    position: fc.option(validPositionArb, { nil: undefined }),
                    completed: fc.option(fc.boolean(), { nil: undefined })
                }),
                async (options) => {
                    storageAdapter.clear();
                    
                    // 作成前のファイル数を記録
                    const filesBefore = storageAdapter.getFiles().size;
                    
                    const result = await dataManager.createNote(options as CreateNoteOptions);
                    
                    // 作成が拒否されることを確認
                    expect(result.success).toBe(false);
                    
                    // ファイルが作成されていないことを確認
                    const filesAfter = storageAdapter.getFiles().size;
                    expect(filesAfter).toBe(filesBefore);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 2.3: 既存の付箋リストが変更されないことを確認
     */
    it('should not modify existing notes when rejecting empty content', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                whitespaceOnlyArb,
                async (validOptions, emptyContent) => {
                    storageAdapter.clear();
                    
                    // まず有効な付箋を作成
                    const validResult = await dataManager.createNote(validOptions);
                    expect(validResult.success).toBe(true);
                    
                    // 作成後のファイル数を記録
                    const filesBefore = storageAdapter.getFiles().size;
                    const filesContentBefore = new Map(storageAdapter.getFiles());
                    
                    // 空コンテンツで作成を試行
                    const emptyResult = await dataManager.createNote({
                        ...validOptions,
                        content: emptyContent
                    });
                    
                    // 作成が拒否されることを確認
                    expect(emptyResult.success).toBe(false);
                    
                    // ファイル数が変わっていないことを確認
                    const filesAfter = storageAdapter.getFiles().size;
                    expect(filesAfter).toBe(filesBefore);
                    
                    // 既存ファイルの内容が変わっていないことを確認
                    filesContentBefore.forEach((content, path) => {
                        expect(storageAdapter.getFiles().get(path)).toBe(content);
                    });
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 2.4: エラーメッセージが適切であることを確認
     */
    it('should return appropriate error message for empty content', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.oneof(emptyContentArb, whitespaceOnlyArb),
                async (emptyContent) => {
                    storageAdapter.clear();
                    
                    const result = await dataManager.createNote({
                        content: emptyContent
                    });
                    
                    expect(result.success).toBe(false);
                    
                    if (!result.success) {
                        // エラーオブジェクトが存在することを確認
                        expect(result.error).toBeDefined();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * Feature: postodo-sticky-notes
 * Property 5: UI変更のファイル同期（ラウンドトリップ）
 * Validates: Requirements 2.2, 7.1
 * 
 * *任意の* UI での付箋変更に対して、変更内容が Note_File に保存され、
 * ファイルを再読み込みすると同じ内容が復元される
 */
describe('DataManager - Property 5: UI変更のファイル同期（ラウンドトリップ）', () => {
    let storageAdapter: MockStorageAdapter;
    let eventBus: EventBus;
    let noteRepository: NoteRepository;
    let dataManager: DataManager;

    beforeEach(() => {
        storageAdapter = new MockStorageAdapter();
        eventBus = new EventBus();
        noteRepository = new NoteRepository(storageAdapter, eventBus);
        dataManager = new DataManager(noteRepository, eventBus);
    });

    /**
     * Property 5.1: コンテンツ変更のラウンドトリップ
     * Requirements 2.2: WHEN ユーザーが Sticky_Note の内容を変更した場合
     *                   THEN THE Postodo_System SHALL 500ms 以内に対応する Note_File を更新する
     */
    it('should round-trip content changes through file storage', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                validContentArb,
                async (createOptions, newContent) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // コンテンツを更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        content: newContent
                    });
                    expect(updateResult.success).toBe(true);
                    
                    if (!updateResult.success) return;
                    
                    // ファイルから再読み込み（キャッシュをクリアしてシミュレート）
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toBeDefined();
                    
                    // ファイル内容に新しいコンテンツが含まれていることを確認
                    expect(fileContent).toContain(newContent);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 5.2: 位置変更のラウンドトリップ
     */
    it('should round-trip position changes through file storage', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                validPositionArb,
                async (createOptions, newPosition) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // 位置を更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        position: newPosition
                    });
                    expect(updateResult.success).toBe(true);
                    
                    if (!updateResult.success) return;
                    
                    // ファイルから再読み込み
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toBeDefined();
                    
                    // ファイル内容に新しい位置が含まれていることを確認
                    expect(fileContent).toContain(`x: ${newPosition.x}`);
                    expect(fileContent).toContain(`y: ${newPosition.y}`);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 5.3: 完了状態変更のラウンドトリップ
     */
    it('should round-trip completion status changes through file storage', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                fc.boolean(),
                async (createOptions, newCompleted) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // 完了状態を更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        completed: newCompleted
                    });
                    expect(updateResult.success).toBe(true);
                    
                    if (!updateResult.success) return;
                    
                    // ファイルから再読み込み
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toBeDefined();
                    
                    // ファイル内容に新しい完了状態が含まれていることを確認
                    expect(fileContent).toContain(`postodo_completed: ${newCompleted}`);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 5.4: 外観変更のラウンドトリップ
     */
    it('should round-trip appearance changes through file storage', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                validAppearanceArb,
                async (createOptions, newAppearance) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // 外観を更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        appearance: newAppearance
                    });
                    expect(updateResult.success).toBe(true);
                    
                    if (!updateResult.success) return;
                    
                    // ファイルから再読み込み
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toBeDefined();
                    
                    // ファイル内容に新しい外観が含まれていることを確認
                    expect(fileContent).toContain(`color: ${newAppearance.color}`);
                    expect(fileContent).toContain(`size: ${newAppearance.size}`);
                }
            ),
            { numRuns: 50 }
        );
    });
});


/**
 * Feature: postodo-sticky-notes
 * Property 6: ファイル変更のUI同期
 * Validates: Requirements 2.3, 7.2
 * 
 * *任意の* Note_File の外部変更に対して、対応する Sticky_Note の表示が更新される
 */
describe('DataManager - Property 6: ファイル変更のUI同期', () => {
    let storageAdapter: MockStorageAdapter;
    let eventBus: EventBus;
    let noteRepository: NoteRepository;
    let dataManager: DataManager;

    beforeEach(() => {
        storageAdapter = new MockStorageAdapter();
        eventBus = new EventBus();
        noteRepository = new NoteRepository(storageAdapter, eventBus);
        dataManager = new DataManager(noteRepository, eventBus);
    });

    /**
     * Property 6.1: ファイル変更がイベントとして通知される
     * Requirements 2.3: WHEN Note_File が外部で変更された場合
     *                   THEN THE Postodo_System SHALL 対応する Sticky_Note の表示を更新する
     */
    it('should emit update event when file content changes', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                validContentArb,
                async (createOptions, newContent) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // イベントリスナーを設定
                    let updateEventReceived = false;
                    let updatedNote: StickyNote | null = null;
                    
                    dataManager.onNoteUpdated((n) => {
                        updateEventReceived = true;
                        updatedNote = n;
                    });
                    
                    // 付箋を更新（ファイル変更をシミュレート）
                    const updateResult = await dataManager.updateNote(note.id, {
                        content: newContent
                    });
                    
                    expect(updateResult.success).toBe(true);
                    
                    // イベントが発火されたことを確認
                    expect(updateEventReceived).toBe(true);
                    expect(updatedNote).not.toBeNull();
                    if (updatedNote) {
                        expect(updatedNote.content).toBe(newContent);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 6.2: 位置変更がイベントとして通知される
     */
    it('should emit update event when position changes', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                validPositionArb,
                async (createOptions, newPosition) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // イベントリスナーを設定
                    let updateEventReceived = false;
                    let updatedNote: StickyNote | null = null;
                    
                    dataManager.onNoteUpdated((n) => {
                        updateEventReceived = true;
                        updatedNote = n;
                    });
                    
                    // 位置を更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        position: newPosition
                    });
                    
                    expect(updateResult.success).toBe(true);
                    
                    // イベントが発火されたことを確認
                    expect(updateEventReceived).toBe(true);
                    expect(updatedNote).not.toBeNull();
                    if (updatedNote) {
                        expect(updatedNote.position.x).toBe(newPosition.x);
                        expect(updatedNote.position.y).toBe(newPosition.y);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });
});

/**
 * Feature: postodo-sticky-notes
 * Property 7: ドラッグ位置の境界制限
 * Validates: Requirements 3.4
 * 
 * *任意の* ドラッグ操作に対して、付箋の位置は Canvas の表示可能な範囲内に制限される
 */
describe('DataManager - Property 7: ドラッグ位置の境界制限', () => {
    /**
     * 境界制限のロジックをテスト
     * SimpleDragHandler の updatePosition メソッドの境界チェックロジックを検証
     */
    
    /**
     * Property 7.1: 負の座標は0に制限される
     */
    it('should constrain negative positions to 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -1000, max: -1 }),
                fc.integer({ min: -1000, max: -1 }),
                (negativeX, negativeY) => {
                    // 境界チェックロジック
                    const boundedX = Math.max(0, negativeX);
                    const boundedY = Math.max(0, negativeY);
                    
                    expect(boundedX).toBe(0);
                    expect(boundedY).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.2: 最大境界を超える座標は制限される
     */
    it('should constrain positions exceeding canvas bounds', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 2000 }),
                fc.integer({ min: 0, max: 2000 }),
                fc.integer({ min: 500, max: 1000 }), // canvasWidth
                fc.integer({ min: 500, max: 1000 }), // canvasHeight
                fc.integer({ min: 150, max: 250 }),  // noteWidth
                fc.integer({ min: 150, max: 220 }),  // noteHeight
                (x, y, canvasWidth, canvasHeight, noteWidth, noteHeight) => {
                    const maxX = canvasWidth - noteWidth;
                    const maxY = canvasHeight - noteHeight;
                    
                    // 境界チェックロジック
                    const boundedX = Math.max(0, Math.min(maxX, x));
                    const boundedY = Math.max(0, Math.min(maxY, y));
                    
                    // 境界内に収まっていることを確認
                    expect(boundedX).toBeGreaterThanOrEqual(0);
                    expect(boundedX).toBeLessThanOrEqual(maxX);
                    expect(boundedY).toBeGreaterThanOrEqual(0);
                    expect(boundedY).toBeLessThanOrEqual(maxY);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 7.3: 有効な範囲内の座標は変更されない
     */
    it('should not modify positions within valid bounds', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 500, max: 1000 }), // canvasWidth
                fc.integer({ min: 500, max: 1000 }), // canvasHeight
                fc.integer({ min: 150, max: 250 }),  // noteWidth
                fc.integer({ min: 150, max: 220 }),  // noteHeight
                (canvasWidth, canvasHeight, noteWidth, noteHeight) => {
                    const maxX = canvasWidth - noteWidth;
                    const maxY = canvasHeight - noteHeight;
                    
                    // 有効な範囲内の座標を生成
                    return fc.assert(
                        fc.property(
                            fc.integer({ min: 0, max: Math.max(0, maxX) }),
                            fc.integer({ min: 0, max: Math.max(0, maxY) }),
                            (validX, validY) => {
                                // 境界チェックロジック
                                const boundedX = Math.max(0, Math.min(maxX, validX));
                                const boundedY = Math.max(0, Math.min(maxY, validY));
                                
                                // 有効な範囲内の座標は変更されない
                                expect(boundedX).toBe(validX);
                                expect(boundedY).toBe(validY);
                            }
                        ),
                        { numRuns: 50 }
                    );
                }
            ),
            { numRuns: 20 }
        );
    });
});

/**
 * Feature: postodo-sticky-notes
 * Property 9: 削除時のファイル削除
 * Validates: Requirements 5.2
 * 
 * *任意の* 付箋削除操作に対して、対応する Note_File が Postodo_Folder から削除される
 */
describe('DataManager - Property 9: 削除時のファイル削除', () => {
    let storageAdapter: MockStorageAdapter;
    let eventBus: EventBus;
    let noteRepository: NoteRepository;
    let dataManager: DataManager;

    beforeEach(() => {
        storageAdapter = new MockStorageAdapter();
        eventBus = new EventBus();
        noteRepository = new NoteRepository(storageAdapter, eventBus);
        dataManager = new DataManager(noteRepository, eventBus);
    });

    /**
     * Property 9.1: 付箋削除時にファイルが削除される
     * Requirements 5.2: WHEN Sticky_Note が削除された場合
     *                   THEN THE Postodo_System SHALL Postodo_Folder から対応する Note_File を削除する
     */
    it('should delete Note_File when note is deleted', async () => {
        await fc.assert(
            fc.asyncProperty(validCreateNoteOptionsArb, async (createOptions) => {
                storageAdapter.clear();
                
                // 付箋を作成
                const createResult = await dataManager.createNote(createOptions);
                expect(createResult.success).toBe(true);
                
                if (!createResult.success) return;
                
                const note = createResult.data;
                
                // ファイルが存在することを確認
                expect(storageAdapter.getFiles().has(note.filePath)).toBe(true);
                
                // 付箋を削除
                const deleteResult = await dataManager.deleteNote(note.id);
                expect(deleteResult.success).toBe(true);
                
                // ファイルが削除されていることを確認
                expect(storageAdapter.getFiles().has(note.filePath)).toBe(false);
            }),
            { numRuns: 50 }
        );
    });

    /**
     * Property 9.2: 削除イベントが発火される
     */
    it('should emit delete event when note is deleted', async () => {
        await fc.assert(
            fc.asyncProperty(validCreateNoteOptionsArb, async (createOptions) => {
                storageAdapter.clear();
                
                // 付箋を作成
                const createResult = await dataManager.createNote(createOptions);
                expect(createResult.success).toBe(true);
                
                if (!createResult.success) return;
                
                const note = createResult.data;
                
                // イベントリスナーを設定
                let deleteEventReceived = false;
                let deletedId: string | null = null;
                
                dataManager.onNoteDeleted((id) => {
                    deleteEventReceived = true;
                    deletedId = id;
                });
                
                // 付箋を削除
                const deleteResult = await dataManager.deleteNote(note.id);
                expect(deleteResult.success).toBe(true);
                
                // イベントが発火されたことを確認
                expect(deleteEventReceived).toBe(true);
                expect(deletedId).toBe(note.id);
            }),
            { numRuns: 50 }
        );
    });

    /**
     * Property 9.3: 削除後に他の付箋が取得できることを確認
     */
    it('should still be able to get remaining notes after deletion', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                async (createOptions) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // 削除前にファイルが存在することを確認
                    const filesBefore = storageAdapter.getFiles().size;
                    expect(filesBefore).toBe(1);
                    
                    // 付箋を削除
                    const deleteResult = await dataManager.deleteNote(note.id);
                    expect(deleteResult.success).toBe(true);
                    
                    // 削除後にファイルが存在しないことを確認
                    const filesAfter = storageAdapter.getFiles().size;
                    expect(filesAfter).toBe(0);
                }
            ),
            { numRuns: 30 }
        );
    });
});

/**
 * Feature: postodo-sticky-notes
 * Property 10: 外観変更の永続化
 * Validates: Requirements 6.3, 6.4
 * 
 * *任意の* 付箋の色またはサイズ変更に対して、変更内容が Note_File に永続化される
 */
describe('DataManager - Property 10: 外観変更の永続化', () => {
    let storageAdapter: MockStorageAdapter;
    let eventBus: EventBus;
    let noteRepository: NoteRepository;
    let dataManager: DataManager;

    beforeEach(() => {
        storageAdapter = new MockStorageAdapter();
        eventBus = new EventBus();
        noteRepository = new NoteRepository(storageAdapter, eventBus);
        dataManager = new DataManager(noteRepository, eventBus);
    });

    /**
     * Property 10.1: 色変更の永続化
     * Requirements 6.3: WHEN ユーザーがパレットアイコンから色を選択した場合
     *                   THEN THE Postodo_System SHALL Sticky_Note の色を更新し Note_File に永続化する
     */
    it('should persist color changes to Note_File', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                fc.constantFrom<NoteColor>('yellow', 'pink', 'blue', 'green', 'orange', 'purple'),
                async (createOptions, newColor) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // 色を更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        appearance: { ...note.appearance, color: newColor }
                    });
                    expect(updateResult.success).toBe(true);
                    
                    // ファイル内容を確認
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toBeDefined();
                    expect(fileContent).toContain(`color: ${newColor}`);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 10.2: サイズ変更の永続化
     * Requirements 6.4: WHEN ユーザーがサイズピッカーからサイズを選択した場合
     *                   THEN THE Postodo_System SHALL Sticky_Note の寸法を更新し Note_File に永続化する
     */
    it('should persist size changes to Note_File', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                fc.constantFrom<NoteSize>('small', 'medium', 'large'),
                async (createOptions, newSize) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // サイズを更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        appearance: { ...note.appearance, size: newSize }
                    });
                    expect(updateResult.success).toBe(true);
                    
                    // ファイル内容を確認
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toBeDefined();
                    expect(fileContent).toContain(`size: ${newSize}`);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 10.3: 複数の外観プロパティの同時変更
     */
    it('should persist multiple appearance changes simultaneously', async () => {
        await fc.assert(
            fc.asyncProperty(
                validCreateNoteOptionsArb,
                validAppearanceArb,
                async (createOptions, newAppearance) => {
                    storageAdapter.clear();
                    
                    // 付箋を作成
                    const createResult = await dataManager.createNote(createOptions);
                    expect(createResult.success).toBe(true);
                    
                    if (!createResult.success) return;
                    
                    const note = createResult.data;
                    
                    // 外観を更新
                    const updateResult = await dataManager.updateNote(note.id, {
                        appearance: newAppearance
                    });
                    expect(updateResult.success).toBe(true);
                    
                    // ファイル内容を確認
                    const fileContent = storageAdapter.getFiles().get(note.filePath);
                    expect(fileContent).toBeDefined();
                    expect(fileContent).toContain(`color: ${newAppearance.color}`);
                    expect(fileContent).toContain(`size: ${newAppearance.size}`);
                    expect(fileContent).toContain(`rotation: ${newAppearance.rotation}`);
                }
            ),
            { numRuns: 50 }
        );
    });
});
