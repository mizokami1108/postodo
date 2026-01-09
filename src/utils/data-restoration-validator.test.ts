import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
    DataRestorationValidator, 
    DEFAULT_CANVAS_BOUNDS, 
    DEFAULT_VALUES,
    CanvasBounds 
} from './data-restoration-validator';
import { Position, NoteColor, NoteSize } from '../types/core-types';

/**
 * Feature: postodo-sticky-notes
 * Property 15: データ復元時の整合性検証
 * Validates: Requirements 11.2, 11.3
 * 
 * *任意の* 無効な位置データを含む Note_File に対して、位置が Canvas 内に修正される
 * 
 * Requirements:
 * - 11.2: 付箋を復元する際、データの整合性を検証し無効な位置を修正する
 * - 11.3: Note_Fileに無効なデータが含まれている場合、デフォルト値を適用し警告をログに記録する
 */
describe('DataRestorationValidator - Property 15: データ復元時の整合性検証', () => {
    const validator = new DataRestorationValidator();

    // 有効な位置データのArbitrary
    const validPositionArb = fc.record({
        x: fc.integer({ min: DEFAULT_CANVAS_BOUNDS.minX, max: DEFAULT_CANVAS_BOUNDS.maxX }),
        y: fc.integer({ min: DEFAULT_CANVAS_BOUNDS.minY, max: DEFAULT_CANVAS_BOUNDS.maxY }),
        zIndex: fc.integer({ min: 0, max: 1000 })
    });

    // Canvas境界外の位置データのArbitrary
    const outOfBoundsPositionArb = fc.oneof(
        // x座標が境界外
        fc.record({
            x: fc.oneof(
                fc.integer({ min: -10000, max: DEFAULT_CANVAS_BOUNDS.minX - 1 }),
                fc.integer({ min: DEFAULT_CANVAS_BOUNDS.maxX + 1, max: 20000 })
            ),
            y: fc.integer({ min: DEFAULT_CANVAS_BOUNDS.minY, max: DEFAULT_CANVAS_BOUNDS.maxY }),
            zIndex: fc.integer({ min: 0, max: 1000 })
        }),
        // y座標が境界外
        fc.record({
            x: fc.integer({ min: DEFAULT_CANVAS_BOUNDS.minX, max: DEFAULT_CANVAS_BOUNDS.maxX }),
            y: fc.oneof(
                fc.integer({ min: -10000, max: DEFAULT_CANVAS_BOUNDS.minY - 1 }),
                fc.integer({ min: DEFAULT_CANVAS_BOUNDS.maxY + 1, max: 20000 })
            ),
            zIndex: fc.integer({ min: 0, max: 1000 })
        }),
        // 両方が境界外
        fc.record({
            x: fc.oneof(
                fc.integer({ min: -10000, max: DEFAULT_CANVAS_BOUNDS.minX - 1 }),
                fc.integer({ min: DEFAULT_CANVAS_BOUNDS.maxX + 1, max: 20000 })
            ),
            y: fc.oneof(
                fc.integer({ min: -10000, max: DEFAULT_CANVAS_BOUNDS.minY - 1 }),
                fc.integer({ min: DEFAULT_CANVAS_BOUNDS.maxY + 1, max: 20000 })
            ),
            zIndex: fc.integer({ min: 0, max: 1000 })
        })
    );

    // 無効な位置データのArbitrary（型が不正）
    const invalidTypePositionArb = fc.oneof(
        fc.constant(null),
        fc.constant(undefined),
        fc.string(),
        fc.integer(),
        fc.array(fc.integer()),
        fc.record({
            x: fc.string(),
            y: fc.integer({ min: 0, max: 1000 }),
            zIndex: fc.integer({ min: 0, max: 100 })
        }),
        fc.record({
            x: fc.integer({ min: 0, max: 1000 }),
            y: fc.string(),
            zIndex: fc.integer({ min: 0, max: 100 })
        }),
        fc.record({
            x: fc.constant(NaN),
            y: fc.integer({ min: 0, max: 1000 }),
            zIndex: fc.integer({ min: 0, max: 100 })
        })
    );

    /**
     * Property 15.1: 有効な位置データは変更されない
     * 
     * *任意の* Canvas境界内の有効な位置データに対して、
     * 検証後も同じ値が保持される
     */
    it('should preserve valid position data within canvas bounds', () => {
        fc.assert(
            fc.property(validPositionArb, (position) => {
                const result = validator.validatePosition(position);
                
                expect(result.isValid).toBe(true);
                expect(result.correctedValue.x).toBe(position.x);
                expect(result.correctedValue.y).toBe(position.y);
                expect(result.correctedValue.zIndex).toBe(position.zIndex);
                expect(result.warnings).toHaveLength(0);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15.2: Canvas境界外の位置は境界内にクランプされる
     * 
     * *任意の* Canvas境界外の位置データに対して、
     * 検証後の位置はCanvas境界内に収まる
     */
    it('should clamp out-of-bounds positions to canvas boundaries', () => {
        fc.assert(
            fc.property(outOfBoundsPositionArb, (position) => {
                const result = validator.validatePosition(position);
                
                // 修正後の位置がCanvas境界内にあることを確認
                expect(result.correctedValue.x).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minX);
                expect(result.correctedValue.x).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxX);
                expect(result.correctedValue.y).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minY);
                expect(result.correctedValue.y).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxY);
                
                // 警告が生成されていることを確認
                expect(result.warnings.length).toBeGreaterThan(0);
                expect(result.isValid).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15.3: 無効な型の位置データにはデフォルト値が適用される
     * 
     * *任意の* 完全に無効な型の位置データに対して、
     * デフォルト値が適用され、警告が記録される
     */
    it('should apply default values for invalid position data types', () => {
        // 完全に無効な位置データ（null, undefined, 非オブジェクト）
        const completelyInvalidPositionArb = fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.array(fc.integer())
        );

        fc.assert(
            fc.property(completelyInvalidPositionArb, (position) => {
                const result = validator.validatePosition(position);
                
                // デフォルト値が適用されていることを確認
                expect(result.correctedValue.x).toBe(DEFAULT_VALUES.position.x);
                expect(result.correctedValue.y).toBe(DEFAULT_VALUES.position.y);
                expect(result.correctedValue.zIndex).toBe(DEFAULT_VALUES.position.zIndex);
                
                // 警告が生成されていることを確認
                expect(result.warnings.length).toBeGreaterThan(0);
                expect(result.isValid).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15.3b: 部分的に無効な位置データは個別にデフォルト値が適用される
     * 
     * *任意の* 部分的に無効な位置データに対して、
     * 無効なフィールドのみにデフォルト値が適用される
     */
    it('should apply default values only to invalid fields in position data', () => {
        // 部分的に無効な位置データ（一部のフィールドがNaNや文字列）
        const partiallyInvalidPositionArb = fc.oneof(
            fc.record({
                x: fc.constant(NaN),
                y: fc.integer({ min: 0, max: 1000 }),
                zIndex: fc.integer({ min: 0, max: 100 })
            }),
            fc.record({
                x: fc.integer({ min: 0, max: 1000 }),
                y: fc.constant(NaN),
                zIndex: fc.integer({ min: 0, max: 100 })
            }),
            fc.record({
                x: fc.string() as fc.Arbitrary<any>,
                y: fc.integer({ min: 0, max: 1000 }),
                zIndex: fc.integer({ min: 0, max: 100 })
            })
        );

        fc.assert(
            fc.property(partiallyInvalidPositionArb, (position) => {
                const result = validator.validatePosition(position);
                
                // 警告が生成されていることを確認
                expect(result.warnings.length).toBeGreaterThan(0);
                expect(result.isValid).toBe(false);
                
                // 修正後の位置がCanvas境界内にあることを確認
                expect(result.correctedValue.x).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minX);
                expect(result.correctedValue.x).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxX);
                expect(result.correctedValue.y).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minY);
                expect(result.correctedValue.y).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxY);
                expect(result.correctedValue.zIndex).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15.4: 検証後の位置は常にCanvas境界内にある
     * 
     * *任意の* 位置データ（有効・無効問わず）に対して、
     * 検証後の位置は必ずCanvas境界内にある
     */
    it('should always produce positions within canvas bounds after validation', () => {
        // 任意の位置データ（有効・無効・境界外すべて含む）
        const anyPositionArb = fc.oneof(
            validPositionArb,
            outOfBoundsPositionArb,
            invalidTypePositionArb as fc.Arbitrary<any>
        );

        fc.assert(
            fc.property(anyPositionArb, (position) => {
                const result = validator.validatePosition(position);
                
                // 修正後の位置が必ずCanvas境界内にあることを確認
                expect(result.correctedValue.x).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minX);
                expect(result.correctedValue.x).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxX);
                expect(result.correctedValue.y).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minY);
                expect(result.correctedValue.y).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxY);
                expect(result.correctedValue.zIndex).toBeGreaterThanOrEqual(0);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15.5: 寸法データの検証
     * 
     * *任意の* 無効な寸法データに対して、
     * デフォルト値が適用される
     */
    it('should apply default values for invalid dimensions', () => {
        const invalidDimensionsArb = fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.record({
                width: fc.oneof(fc.constant(-100), fc.constant(0), fc.constant(NaN)),
                height: fc.integer({ min: 100, max: 300 })
            }),
            fc.record({
                width: fc.integer({ min: 100, max: 300 }),
                height: fc.oneof(fc.constant(-100), fc.constant(0), fc.constant(NaN))
            })
        );

        fc.assert(
            fc.property(invalidDimensionsArb, (dimensions) => {
                const result = validator.validateDimensions(dimensions);
                
                // 修正後の寸法が正の値であることを確認
                expect(result.correctedValue.width).toBeGreaterThan(0);
                expect(result.correctedValue.height).toBeGreaterThan(0);
                
                // 警告が生成されていることを確認
                expect(result.warnings.length).toBeGreaterThan(0);
                expect(result.isValid).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15.6: 外観データの検証
     * 
     * *任意の* 無効な外観データに対して、
     * 有効なデフォルト値が適用される
     */
    it('should apply default values for invalid appearance data', () => {
        const validColors: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'orange', 'purple'];
        const validSizes: NoteSize[] = ['small', 'medium', 'large'];

        const invalidAppearanceArb = fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.record({
                color: fc.string().filter(s => !validColors.includes(s as NoteColor)),
                size: fc.constantFrom<NoteSize>(...validSizes),
                rotation: fc.integer({ min: -10, max: 10 })
            }),
            fc.record({
                color: fc.constantFrom<NoteColor>(...validColors),
                size: fc.string().filter(s => !validSizes.includes(s as NoteSize)),
                rotation: fc.integer({ min: -10, max: 10 })
            })
        );

        fc.assert(
            fc.property(invalidAppearanceArb, (appearance) => {
                const result = validator.validateAppearance(appearance);
                
                // 修正後の外観が有効な値であることを確認
                expect(validColors).toContain(result.correctedValue.color);
                expect(validSizes).toContain(result.correctedValue.size);
                expect(typeof result.correctedValue.rotation).toBe('number');
                expect(isNaN(result.correctedValue.rotation)).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Property 15.7: validateAndCorrectNote は常に有効なStickyNoteを返す
     * 
     * *任意の* 部分的なノートデータに対して、
     * 検証後は完全で有効なStickyNoteが返される
     */
    it('should always return a valid StickyNote from validateAndCorrectNote', () => {
        const partialNoteArb = fc.record({
            id: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
            filePath: fc.option(fc.string(), { nil: undefined }),
            title: fc.option(fc.string(), { nil: undefined }),
            content: fc.option(fc.string(), { nil: undefined }),
            position: fc.option(fc.oneof(validPositionArb, outOfBoundsPositionArb, fc.constant(null)), { nil: undefined }),
            dimensions: fc.option(fc.record({
                width: fc.integer({ min: -100, max: 500 }),
                height: fc.integer({ min: -100, max: 500 })
            }), { nil: undefined }),
            completed: fc.option(fc.boolean(), { nil: undefined })
        });

        fc.assert(
            fc.property(partialNoteArb, (partialNote) => {
                const { note, warnings } = validator.validateAndCorrectNote(partialNote);
                
                // 返されたノートが完全な構造を持つことを確認
                expect(note.id).toBeDefined();
                expect(typeof note.id).toBe('string');
                expect(note.filePath).toBeDefined();
                expect(note.position).toBeDefined();
                expect(note.dimensions).toBeDefined();
                expect(note.appearance).toBeDefined();
                expect(note.metadata).toBeDefined();
                expect(typeof note.completed).toBe('boolean');
                
                // 位置がCanvas境界内にあることを確認
                expect(note.position.x).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minX);
                expect(note.position.x).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxX);
                expect(note.position.y).toBeGreaterThanOrEqual(DEFAULT_CANVAS_BOUNDS.minY);
                expect(note.position.y).toBeLessThanOrEqual(DEFAULT_CANVAS_BOUNDS.maxY);
            }),
            { numRuns: 100 }
        );
    });
});
