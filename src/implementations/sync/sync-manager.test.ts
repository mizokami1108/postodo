import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SyncManager, executeWithRetry, RetryConfig, RetryResult } from './sync-manager';
import { StickyNote, Result, NoteColor, NoteSize, NoteMetadata } from '../../types/core-types';
import { INoteRepository } from '../../interfaces/data/i-note-repository';
import { IConflictResolver, ConflictType, ResolveResult, ConflictDetectionResult } from '../../interfaces/sync/i-conflict-resolver';
import { IEventBus } from '../../core/event-bus';

/**
 * 有効なISO日付文字列を生成するArbitrary
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1893456000000 })
    .map(ms => new Date(ms).toISOString());

const metadataArb = fc.record({
    created: isoDateArb,
    modified: isoDateArb,
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    links: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
    attachments: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 })
}) as fc.Arbitrary<NoteMetadata>;

/**
 * StickyNote生成用のArbitrary
 */
const stickyNoteArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    filePath: fc.constant('Postodo/test-note.md'),
    title: fc.string({ minLength: 0, maxLength: 100 }).map(s => s.trim()),
    content: fc.string({ minLength: 0, maxLength: 500 }).map(s => s.trim()),
    position: fc.record({
        x: fc.integer({ min: 0, max: 1000 }),
        y: fc.integer({ min: 0, max: 1000 }),
        zIndex: fc.integer({ min: 1, max: 100 })
    }),
    dimensions: fc.record({
        width: fc.integer({ min: 150, max: 250 }),
        height: fc.integer({ min: 150, max: 220 })
    }),
    appearance: fc.record({
        color: fc.constantFrom<NoteColor>('yellow', 'pink', 'blue', 'green', 'orange', 'purple'),
        size: fc.constantFrom<NoteSize>('small', 'medium', 'large'),
        rotation: fc.integer({ min: -5, max: 5 })
    }),
    metadata: metadataArb,
    completed: fc.boolean()
}) as fc.Arbitrary<StickyNote>;

/**
 * リトライ設定生成用のArbitrary（テスト用に非常に短い遅延）
 */
const retryConfigArb = fc.record({
    maxRetries: fc.integer({ min: 1, max: 5 }),
    initialDelayMs: fc.constant(1), // テスト用に1msの遅延
    backoffMultiplier: fc.constant(1) // テスト用に倍率1
});

/**
 * 失敗回数を生成するArbitrary（0から最大リトライ回数+1まで）
 */
const failureCountArb = (maxRetries: number) => fc.integer({ min: 0, max: maxRetries + 1 });

/**
 * Feature: postodo-sticky-notes
 * Property 14: 同期失敗時のリトライ
 * Validates: Requirements 7.4
 * 
 * *任意の* 同期失敗に対して、指数バックオフで最大3回まで再試行される
 */
describe('SyncManager - Property 14: Sync Retry with Exponential Backoff', () => {
    /**
     * Property 14: 同期失敗時のリトライ
     * 任意の失敗回数に対して、最大リトライ回数まで再試行される
     */
    it('should retry up to maxRetries times on failure', async () => {
        await fc.assert(
            fc.asyncProperty(
                retryConfigArb,
                fc.integer({ min: 0, max: 10 }),
                async (config, failuresBeforeSuccess) => {
                    let callCount = 0;
                    const operation = async (): Promise<Result<void>> => {
                        callCount++;
                        if (callCount <= failuresBeforeSuccess) {
                            return { success: false, error: new Error('Simulated failure') };
                        }
                        return { success: true, data: undefined };
                    };

                    const result = await executeWithRetry(operation, config);

                    // 成功するまでの呼び出し回数、または最大リトライ回数+1（初回含む）
                    const expectedCalls = Math.min(failuresBeforeSuccess + 1, config.maxRetries + 1);
                    expect(callCount).toBe(expectedCalls);

                    // 失敗回数が最大リトライ回数以下なら成功
                    if (failuresBeforeSuccess <= config.maxRetries) {
                        expect(result.success).toBe(true);
                        expect(result.attempts).toBe(failuresBeforeSuccess + 1);
                    } else {
                        // 最大リトライ回数を超えたら失敗
                        expect(result.success).toBe(false);
                        expect(result.attempts).toBe(config.maxRetries + 1);
                    }
                }
            ),
            { numRuns: 100 }
        );
    }, 30000); // 30秒のタイムアウト

    /**
     * 常に成功する操作は1回で完了する
     */
    it('should succeed on first attempt when operation always succeeds', async () => {
        await fc.assert(
            fc.asyncProperty(
                retryConfigArb,
                async (config) => {
                    let callCount = 0;
                    const operation = async (): Promise<Result<string>> => {
                        callCount++;
                        return { success: true, data: 'success' };
                    };

                    const result = await executeWithRetry(operation, config);

                    expect(callCount).toBe(1);
                    expect(result.success).toBe(true);
                    expect(result.attempts).toBe(1);
                    expect(result.data).toBe('success');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 常に失敗する操作は最大リトライ回数+1回試行される
     */
    it('should attempt maxRetries + 1 times when operation always fails', async () => {
        await fc.assert(
            fc.asyncProperty(
                retryConfigArb,
                async (config) => {
                    let callCount = 0;
                    const errorMessage = 'Persistent failure';
                    const operation = async (): Promise<Result<void>> => {
                        callCount++;
                        return { success: false, error: new Error(errorMessage) };
                    };

                    const result = await executeWithRetry(operation, config);

                    expect(callCount).toBe(config.maxRetries + 1);
                    expect(result.success).toBe(false);
                    expect(result.attempts).toBe(config.maxRetries + 1);
                    expect(result.error?.message).toBe(errorMessage);
                }
            ),
            { numRuns: 100 }
        );
    }, 30000); // 30秒のタイムアウト

    /**
     * 例外をスローする操作もリトライされる
     */
    it('should retry when operation throws an exception', async () => {
        await fc.assert(
            fc.asyncProperty(
                retryConfigArb,
                fc.integer({ min: 1, max: 5 }),
                async (config, throwsBeforeSuccess) => {
                    let callCount = 0;
                    const operation = async (): Promise<Result<void>> => {
                        callCount++;
                        if (callCount <= throwsBeforeSuccess) {
                            throw new Error('Exception thrown');
                        }
                        return { success: true, data: undefined };
                    };

                    const result = await executeWithRetry(operation, config);

                    const expectedCalls = Math.min(throwsBeforeSuccess + 1, config.maxRetries + 1);
                    expect(callCount).toBe(expectedCalls);

                    if (throwsBeforeSuccess <= config.maxRetries) {
                        expect(result.success).toBe(true);
                    } else {
                        expect(result.success).toBe(false);
                    }
                }
            ),
            { numRuns: 100 }
        );
    }, 30000); // 30秒のタイムアウト

    /**
     * デフォルトのリトライ設定は1秒、2秒、4秒の間隔で最大3回
     */
    it('should use default retry config with 1s, 2s, 4s intervals and max 3 retries', () => {
        const mockRepository: INoteRepository = {
            save: vi.fn().mockResolvedValue({ success: true, data: undefined }),
            findById: vi.fn(),
            findAll: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            exists: vi.fn(),
            rename: vi.fn(),
            getSyncStatus: vi.fn(),
            resyncNote: vi.fn(),
            cleanup: vi.fn()
        };

        const mockConflictResolver: IConflictResolver = {
            detectConflict: vi.fn(),
            resolveConflict: vi.fn(),
            detectAllConflicts: vi.fn().mockReturnValue({ hasConflict: false, conflictTypes: [] }),
            resolveAllConflicts: vi.fn()
        };

        const mockEventBus: IEventBus = {
            on: vi.fn().mockReturnValue(() => {}),
            once: vi.fn().mockReturnValue(() => {}),
            off: vi.fn(),
            emit: vi.fn(),
            onPattern: vi.fn().mockReturnValue(() => {})
        };

        const syncManager = new SyncManager(mockRepository, mockConflictResolver, mockEventBus);
        const config = syncManager.getRetryConfig();

        expect(config.maxRetries).toBe(3);
        expect(config.initialDelayMs).toBe(1000);
        expect(config.backoffMultiplier).toBe(2);
    });

    /**
     * カスタムリトライ設定が適用される
     */
    it('should apply custom retry config when provided', () => {
        const mockRepository: INoteRepository = {
            save: vi.fn().mockResolvedValue({ success: true, data: undefined }),
            findById: vi.fn(),
            findAll: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            exists: vi.fn(),
            rename: vi.fn(),
            getSyncStatus: vi.fn(),
            resyncNote: vi.fn(),
            cleanup: vi.fn()
        };

        const mockConflictResolver: IConflictResolver = {
            detectConflict: vi.fn(),
            resolveConflict: vi.fn(),
            detectAllConflicts: vi.fn().mockReturnValue({ hasConflict: false, conflictTypes: [] }),
            resolveAllConflicts: vi.fn()
        };

        const mockEventBus: IEventBus = {
            on: vi.fn().mockReturnValue(() => {}),
            once: vi.fn().mockReturnValue(() => {}),
            off: vi.fn(),
            emit: vi.fn(),
            onPattern: vi.fn().mockReturnValue(() => {})
        };

        const customConfig = {
            maxRetries: 5,
            initialDelayMs: 500,
            backoffMultiplier: 3
        };

        const syncManager = new SyncManager(mockRepository, mockConflictResolver, mockEventBus, customConfig);
        const config = syncManager.getRetryConfig();

        expect(config.maxRetries).toBe(5);
        expect(config.initialDelayMs).toBe(500);
        expect(config.backoffMultiplier).toBe(3);
    });
});

/**
 * SyncManager統合テスト
 */
describe('SyncManager - Integration with Retry', () => {
    let mockRepository: INoteRepository;
    let mockConflictResolver: IConflictResolver;
    let mockEventBus: IEventBus;
    let emittedEvents: { event: string; data: any }[];

    beforeEach(() => {
        emittedEvents = [];

        mockRepository = {
            save: vi.fn().mockResolvedValue({ success: true, data: undefined }),
            findById: vi.fn(),
            findAll: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            exists: vi.fn(),
            rename: vi.fn(),
            getSyncStatus: vi.fn(),
            resyncNote: vi.fn(),
            cleanup: vi.fn()
        };

        mockConflictResolver = {
            detectConflict: vi.fn(),
            resolveConflict: vi.fn(),
            detectAllConflicts: vi.fn().mockReturnValue({ hasConflict: false, conflictTypes: [] }),
            resolveAllConflicts: vi.fn()
        };

        mockEventBus = {
            on: vi.fn().mockReturnValue(() => {}),
            once: vi.fn().mockReturnValue(() => {}),
            off: vi.fn(),
            emit: vi.fn((event, data) => {
                emittedEvents.push({ event, data });
            }),
            onPattern: vi.fn().mockReturnValue(() => {})
        };
    });

    /**
     * syncNoteToFileImmediateがリトライ後に成功した場合、イベントが発火される
     */
    it('should emit sync-retry-succeeded event when retry succeeds', async () => {
        let callCount = 0;
        (mockRepository.save as any).mockImplementation(async () => {
            callCount++;
            if (callCount < 2) {
                return { success: false, error: new Error('Temporary failure') };
            }
            return { success: true, data: undefined };
        });

        // 短いリトライ間隔でテスト
        const syncManager = new SyncManager(
            mockRepository,
            mockConflictResolver,
            mockEventBus,
            { maxRetries: 3, initialDelayMs: 1, backoffMultiplier: 1 }
        );

        const note: StickyNote = {
            id: 'test-id',
            filePath: 'Postodo/test.md',
            title: 'Test',
            content: 'Content',
            position: { x: 0, y: 0, zIndex: 1 },
            dimensions: { width: 200, height: 180 },
            appearance: { color: 'yellow', size: 'medium', rotation: 0 },
            metadata: { created: new Date().toISOString(), modified: new Date().toISOString(), tags: [], links: [], attachments: [] },
            completed: false
        };

        const result = await syncManager.syncNoteToFileImmediate(note);

        expect(result.success).toBe(true);
        expect(callCount).toBe(2);

        // sync-retry-succeeded イベントが発火されていることを確認
        const retrySucceededEvent = emittedEvents.find(e => e.event === 'sync-retry-succeeded');
        expect(retrySucceededEvent).toBeDefined();
        expect(retrySucceededEvent?.data.noteId).toBe('test-id');
        expect(retrySucceededEvent?.data.attempts).toBe(2);
    });

    /**
     * syncNoteToFileImmediateが全てのリトライ後に失敗した場合、イベントが発火される
     */
    it('should emit sync-retry-failed event when all retries fail', async () => {
        (mockRepository.save as any).mockResolvedValue({ success: false, error: new Error('Persistent failure') });

        // 短いリトライ間隔でテスト
        const syncManager = new SyncManager(
            mockRepository,
            mockConflictResolver,
            mockEventBus,
            { maxRetries: 2, initialDelayMs: 1, backoffMultiplier: 1 }
        );

        const note: StickyNote = {
            id: 'test-id',
            filePath: 'Postodo/test.md',
            title: 'Test',
            content: 'Content',
            position: { x: 0, y: 0, zIndex: 1 },
            dimensions: { width: 200, height: 180 },
            appearance: { color: 'yellow', size: 'medium', rotation: 0 },
            metadata: { created: new Date().toISOString(), modified: new Date().toISOString(), tags: [], links: [], attachments: [] },
            completed: false
        };

        const result = await syncManager.syncNoteToFileImmediate(note);

        expect(result.success).toBe(false);

        // sync-retry-failed イベントが発火されていることを確認
        const retryFailedEvent = emittedEvents.find(e => e.event === 'sync-retry-failed');
        expect(retryFailedEvent).toBeDefined();
        expect(retryFailedEvent?.data.noteId).toBe('test-id');
        expect(retryFailedEvent?.data.attempts).toBe(3); // 初回 + 2回リトライ
    });
});
