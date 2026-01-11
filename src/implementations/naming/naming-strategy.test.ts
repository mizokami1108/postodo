import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { TimestampNamingStrategy } from './timestamp-naming-strategy';
import { CustomNamingStrategy } from './custom-naming-strategy';
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
         * タイムスタンプ戦略は Sticky-yyyyMMddHHmmssSSS 形式のファイル名を生成する（ミリ秒を含む）
         */
        it('should generate file names in Sticky-yyyyMMddHHmmssSSS format for any note', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const fileName = strategy.generateFileName(note);
                    
                    // Sticky-yyyyMMddHHmmssSSS 形式であることを確認（17桁）
                    expect(fileName).toMatch(/^Sticky-\d{17}$/);
                    
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
                    fc.string().filter(s => !s.match(/^Sticky-\d{14}$/) && !s.match(/^Sticky-\d{17}$/)),
                    (invalidFileName) => {
                        const parsed = strategy.parseFileName(invalidFileName);
                        expect(parsed).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('CustomNamingStrategy', () => {
        /**
         * Property 3: ファイル命名規則の適用
         * カスタム戦略は指定されたフォーマットに基づいてファイル名を生成する
         * ミリ秒が含まれない場合はランダムサフィックスが追加される
         */
        it('should generate file names based on custom format for any note', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const strategy = new CustomNamingStrategy('Note-{YYYY}-{MM}-{DD}');
                    const fileName = strategy.generateFileName(note);
                    
                    // Note-YYYY-MM-DD-xxxx 形式であることを確認（ランダムサフィックス付き）
                    expect(fileName).toMatch(/^Note-\d{4}-\d{2}-\d{2}-[a-z0-9]{4}$/);
                }),
                { numRuns: 100 }
            );
        });

        /**
         * ミリ秒を含むフォーマットではランダムサフィックスが追加されない
         */
        it('should not add random suffix when format includes {SSS}', () => {
            const strategy = new CustomNamingStrategy('Note-{YYYY}{MM}{DD}{SSS}');
            const fileName = strategy.generateFileName({});
            
            // Note-YYYYMMDD + 3桁ミリ秒 = 11桁の数字部分
            expect(fileName).toMatch(/^Note-\d{11}$/);
        });

        /**
         * 全てのプレースホルダーが正しく置換されることを確認
         * ミリ秒を含むのでランダムサフィックスは追加されない
         */
        it('should replace all placeholders correctly', () => {
            const strategy = new CustomNamingStrategy('{YYYY}{MM}{DD}{HH}{mm}{ss}{SSS}');
            const fileName = strategy.generateFileName({});
            
            // 全て数字に置換されていることを確認（17桁）
            expect(fileName).toMatch(/^\d{17}$/);
        });

        /**
         * フォーマット変更のテスト
         */
        it('should allow format to be changed', () => {
            const strategy = new CustomNamingStrategy('Old-{YYYY}{SSS}');
            expect(strategy.generateFileName({})).toMatch(/^Old-\d{7}$/);
            
            strategy.setFormat('New-{MM}-{DD}{SSS}');
            expect(strategy.generateFileName({})).toMatch(/^New-\d{2}-\d{5}$/);
        });

        /**
         * パーステスト - タイムスタンプを含むファイル名
         */
        it('should parse file names with timestamp patterns', () => {
            const strategy = new CustomNamingStrategy();
            
            // 有効なタイムスタンプパターン
            const parsed = strategy.parseFileName('Note-2026-01-11-16-45-30');
            expect(parsed).not.toBeNull();
            expect(parsed?.timestamp).toBeInstanceOf(Date);
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
            
            const customStrategy = factory.create('custom');
            expect(customStrategy.strategyType).toBe('custom');
        });

        /**
         * カスタムフォーマットが正しく適用されることを確認
         * ミリ秒を含まないフォーマットにはランダムサフィックスが追加される
         */
        it('should apply custom format when creating custom strategy', () => {
            const factory = new NamingStrategyFactory('MyNote-{YYYY}{MM}{DD}');
            
            const strategy = factory.create('custom');
            const fileName = strategy.generateFileName({});
            
            // ランダムサフィックス付き: MyNote-YYYYMMDD-xxxx
            expect(fileName).toMatch(/^MyNote-\d{8}-[a-z0-9]{4}$/);
        });

        /**
         * setCustomFormatでフォーマットを変更できることを確認
         * ミリ秒を含まないフォーマットにはランダムサフィックスが追加される
         */
        it('should allow custom format to be changed via setCustomFormat', () => {
            const factory = new NamingStrategyFactory();
            
            factory.setCustomFormat('Changed-{YYYY}');
            const strategy = factory.create('custom');
            const fileName = strategy.generateFileName({});
            
            // ランダムサフィックス付き: Changed-YYYY-xxxx
            expect(fileName).toMatch(/^Changed-\d{4}-[a-z0-9]{4}$/);
        });

        /**
         * 生成された戦略が正しいファイル名形式を生成することを確認
         */
        it('should generate correct file name format based on strategy type', () => {
            const factory = new NamingStrategyFactory();
            
            fc.assert(
                fc.property(
                    stickyNoteArb,
                    fc.constantFrom('timestamp', 'custom') as fc.Arbitrary<'timestamp' | 'custom'>,
                    (note, strategyType) => {
                        const strategy = factory.create(strategyType);
                        const fileName = strategy.generateFileName(note);
                        
                        if (strategyType === 'timestamp') {
                            // 17桁（ミリ秒を含む）
                            expect(fileName).toMatch(/^Sticky-\d{17}$/);
                        } else {
                            // デフォルトのカスタムフォーマット（秒まで含むのでランダムサフィックス付き）
                            expect(fileName).toMatch(/^Sticky-\d{8}-\d{6}-[a-z0-9]{4}$/);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
