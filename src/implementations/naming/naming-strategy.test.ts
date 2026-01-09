import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { TimestampNamingStrategy } from './timestamp-naming-strategy';
import { SequentialNamingStrategy, IFileScanner } from './sequential-naming-strategy';
import { NamingStrategyFactory } from './naming-strategy-factory';
import { StickyNote, NoteColor, NoteSize } from '../../types/core-types';

/**
 * Feature: postodo-sticky-notes
 * Property 3: ファイル命名規則の適用
 * Validates: Requirements 1.6, 1.7, 13.3
 * 
 * *任意の* 付箋作成時に、設定された Naming_Strategy に従ったファイル名が生成される
 */
describe('NamingStrategy - Property Tests', () => {
    // StickyNote生成用のArbitrary
    const stickyNoteArb = fc.record({
        id: fc.string({ minLength: 5, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
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
        metadata: fc.constant({
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            tags: ['postodo'],
            links: [],
            attachments: []
        }),
        completed: fc.boolean()
    }) as fc.Arbitrary<StickyNote>;

    describe('TimestampNamingStrategy', () => {
        let strategy: TimestampNamingStrategy;

        beforeEach(() => {
            strategy = new TimestampNamingStrategy();
        });

        /**
         * Property 3: ファイル命名規則の適用
         * タイムスタンプ戦略は Sticky-yyyyMMddHHmmss 形式のファイル名を生成する
         */
        it('should generate file names in Sticky-yyyyMMddHHmmss format for any note', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const fileName = strategy.generateFileName(note);
                    
                    // Sticky-yyyyMMddHHmmss 形式であることを確認
                    expect(fileName).toMatch(/^Sticky-\d{14}$/);
                    
                    // パースできることを確認
                    const parsed = strategy.parseFileName(fileName);
                    expect(parsed).not.toBeNull();
                    expect(parsed?.timestamp).toBeInstanceOf(Date);
                }),
                { numRuns: 100 }
            );
        });

        /**
         * タイムスタンプのラウンドトリップテスト
         * 生成したファイル名をパースすると有効な日付が得られる
         */
        it('should round-trip timestamp through generate and parse', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const fileName = strategy.generateFileName(note);
                    const parsed = strategy.parseFileName(fileName);
                    
                    expect(parsed).not.toBeNull();
                    if (parsed) {
                        // タイムスタンプが現在時刻に近いことを確認（1分以内）
                        const now = new Date();
                        const diff = Math.abs(now.getTime() - parsed.timestamp!.getTime());
                        expect(diff).toBeLessThan(60000);
                    }
                }),
                { numRuns: 100 }
            );
        });

        /**
         * 無効なファイル名のパーステスト
         */
        it('should return null for invalid file names', () => {
            fc.assert(
                fc.property(
                    fc.string().filter(s => !s.match(/^Sticky-\d{14}$/)),
                    (invalidFileName) => {
                        const parsed = strategy.parseFileName(invalidFileName);
                        expect(parsed).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('SequentialNamingStrategy', () => {
        /**
         * Property 3: ファイル命名規則の適用
         * 連番戦略は Sticky-{seqNo} 形式のファイル名を生成する
         */
        it('should generate file names in Sticky-{seqNo} format for any note', async () => {
            await fc.assert(
                fc.asyncProperty(stickyNoteArb, async (note) => {
                    const strategy = new SequentialNamingStrategy();
                    const fileName = await strategy.generateFileName(note);
                    
                    // Sticky-{seqNo} 形式であることを確認（4桁ゼロパディング）
                    expect(fileName).toMatch(/^Sticky-\d{4}$/);
                    
                    // パースできることを確認
                    const parsed = strategy.parseFileName(fileName);
                    expect(parsed).not.toBeNull();
                    expect(parsed?.seqNo).toBe(1); // スキャナーなしの場合は1から開始
                }),
                { numRuns: 100 }
            );
        });

        /**
         * 連番のパーステスト
         */
        it('should parse sequential file names correctly', () => {
            const strategy = new SequentialNamingStrategy();
            
            fc.assert(
                fc.property(
                    fc.integer({ min: 0, max: 9999 }),
                    (seqNo) => {
                        const fileName = `Sticky-${seqNo.toString().padStart(4, '0')}`;
                        const parsed = strategy.parseFileName(fileName);
                        
                        expect(parsed).not.toBeNull();
                        expect(parsed?.seqNo).toBe(seqNo);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('NamingStrategyFactory', () => {
        /**
         * Property 3: ファイル命名規則の適用
         * ファクトリーは設定に基づいて正しい戦略を生成する
         */
        it('should create correct strategy based on type', () => {
            const factory = new NamingStrategyFactory();
            
            const timestampStrategy = factory.create('timestamp');
            expect(timestampStrategy.strategyType).toBe('timestamp');
            
            const sequentialStrategy = factory.create('sequential');
            expect(sequentialStrategy.strategyType).toBe('sequential');
            
            const customStrategy = factory.create('custom');
            expect(customStrategy.strategyType).toBe('timestamp'); // カスタムはデフォルトでタイムスタンプ
        });

        /**
         * 生成された戦略が正しいファイル名形式を生成することを確認
         */
        it('should generate correct file name format based on strategy type', async () => {
            const factory = new NamingStrategyFactory();
            
            await fc.assert(
                fc.asyncProperty(
                    stickyNoteArb,
                    fc.constantFrom('timestamp', 'sequential') as fc.Arbitrary<'timestamp' | 'sequential'>,
                    async (note, strategyType) => {
                        const strategy = factory.create(strategyType);
                        const fileName = await Promise.resolve(strategy.generateFileName(note));
                        
                        if (strategyType === 'timestamp') {
                            expect(fileName).toMatch(/^Sticky-\d{14}$/);
                        } else {
                            expect(fileName).toMatch(/^Sticky-\d{4}$/);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});


/**
 * Feature: postodo-sticky-notes
 * Property 19: 連番の一意性保証
 * Validates: Requirements 13.5
 * 
 * *任意の* 連番形式での付箋作成に対して、既存のファイルと重複しない連番が生成される
 */
describe('SequentialNamingStrategy - Uniqueness Property Tests', () => {
    /**
     * モックファイルスキャナー
     * テスト用に既存ファイル名のリストを返す
     */
    class MockFileScanner implements IFileScanner {
        constructor(private fileNames: string[]) {}
        
        getExistingFileNames(): string[] {
            return this.fileNames;
        }
    }

    /**
     * Property 19: 連番の一意性保証
     * 任意の既存ファイルリストに対して、生成される連番は既存のものと重複しない
     */
    it('should generate unique sequence number that does not conflict with existing files', async () => {
        await fc.assert(
            fc.asyncProperty(
                // 既存の連番リスト（0-9999の範囲で重複なし）
                fc.uniqueArray(fc.integer({ min: 1, max: 9999 }), { minLength: 0, maxLength: 100 }),
                async (existingSeqNos) => {
                    // 既存ファイル名のリストを生成
                    const existingFileNames = existingSeqNos.map(
                        seqNo => `Sticky-${seqNo.toString().padStart(4, '0')}`
                    );
                    
                    const scanner = new MockFileScanner(existingFileNames);
                    const strategy = new SequentialNamingStrategy(scanner);
                    
                    // 新しいファイル名を生成
                    const newFileName = await strategy.generateFileName({});
                    
                    // 生成されたファイル名が既存のものと重複しないことを確認
                    expect(existingFileNames).not.toContain(newFileName);
                    
                    // 生成された連番が既存の最大値+1であることを確認
                    const parsed = strategy.parseFileName(newFileName);
                    expect(parsed).not.toBeNull();
                    
                    const maxExisting = existingSeqNos.length > 0 ? Math.max(...existingSeqNos) : 0;
                    expect(parsed?.seqNo).toBe(maxExisting + 1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 連続生成時の一意性テスト
     * 複数回連続で生成しても重複しない
     */
    it('should generate unique sequence numbers when called multiple times', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }), // 生成回数
                async (generateCount) => {
                    const existingFileNames: string[] = [];
                    const scanner = new MockFileScanner(existingFileNames);
                    const strategy = new SequentialNamingStrategy(scanner);
                    
                    const generatedFileNames: string[] = [];
                    
                    for (let i = 0; i < generateCount; i++) {
                        const fileName = await strategy.generateFileName({});
                        generatedFileNames.push(fileName);
                        // 生成したファイル名を既存リストに追加（実際の使用をシミュレート）
                        existingFileNames.push(fileName);
                    }
                    
                    // 全ての生成されたファイル名が一意であることを確認
                    const uniqueFileNames = new Set(generatedFileNames);
                    expect(uniqueFileNames.size).toBe(generateCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 空のフォルダからの開始テスト
     * 既存ファイルがない場合は1から開始
     */
    it('should start from 1 when no existing files', async () => {
        const scanner = new MockFileScanner([]);
        const strategy = new SequentialNamingStrategy(scanner);
        
        const fileName = await strategy.generateFileName({});
        
        expect(fileName).toBe('Sticky-0001');
        
        const parsed = strategy.parseFileName(fileName);
        expect(parsed?.seqNo).toBe(1);
    });

    /**
     * 非連番ファイルが混在する場合のテスト
     * 連番形式でないファイルは無視される
     */
    it('should ignore non-sequential file names when calculating next sequence', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
                fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.match(/^Sticky-\d+$/)), { minLength: 0, maxLength: 10 }),
                async (seqNos, nonSeqFileNames) => {
                    // 連番ファイルと非連番ファイルを混在させる
                    const seqFileNames = seqNos.map(n => `Sticky-${n.toString().padStart(4, '0')}`);
                    const allFileNames = [...seqFileNames, ...nonSeqFileNames];
                    
                    const scanner = new MockFileScanner(allFileNames);
                    const strategy = new SequentialNamingStrategy(scanner);
                    
                    const newFileName = await strategy.generateFileName({});
                    const parsed = strategy.parseFileName(newFileName);
                    
                    // 連番ファイルの最大値+1であることを確認
                    const maxSeqNo = Math.max(...seqNos);
                    expect(parsed?.seqNo).toBe(maxSeqNo + 1);
                }
            ),
            { numRuns: 100 }
        );
    });
});
