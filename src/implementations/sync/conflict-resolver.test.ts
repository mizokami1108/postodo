import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ConflictResolver } from './conflict-resolver';
import { StickyNote, Position, NoteMetadata, NoteColor, NoteSize } from '../../types/core-types';

/**
 * StickyNote生成用のArbitrary
 */
const positionArb = fc.record({
    x: fc.integer({ min: 0, max: 1000 }),
    y: fc.integer({ min: 0, max: 1000 }),
    zIndex: fc.integer({ min: 1, max: 100 })
});

/**
 * 有効なISO日付文字列を生成するArbitrary
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01 in ms
    .map(ms => new Date(ms).toISOString());

const metadataArb = fc.record({
    created: isoDateArb,
    modified: isoDateArb,
    tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
    links: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
    attachments: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 })
}) as fc.Arbitrary<NoteMetadata>;

const stickyNoteArb = (id: string = 'test-note-id') => fc.record({
    id: fc.constant(id),
    filePath: fc.constant('Postodo/test-note.md'),
    title: fc.string({ minLength: 0, maxLength: 100 }).map(s => s.trim()),
    content: fc.string({ minLength: 0, maxLength: 500 }).map(s => s.trim()),
    position: positionArb,
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
 * 2つの異なる位置を生成するArbitrary
 */
const differentPositionsArb = fc.tuple(positionArb, positionArb).filter(
    ([pos1, pos2]) => pos1.x !== pos2.x || pos1.y !== pos2.y || pos1.zIndex !== pos2.zIndex
);

/**
 * 2つの異なるコンテンツを生成するArbitrary
 */
const differentContentsArb = fc.tuple(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.string({ minLength: 1, maxLength: 100 })
).filter(([c1, c2]) => c1 !== c2);

/**
 * 2つの異なるメタデータを生成するArbitrary
 */
const differentMetadataArb = fc.tuple(metadataArb, metadataArb).filter(([m1, m2]) => {
    const tags1 = [...m1.tags].sort().join(',');
    const tags2 = [...m2.tags].sort().join(',');
    return tags1 !== tags2;
});

/**
 * Feature: postodo-sticky-notes
 * Property 11: 位置競合時のUI優先
 * Validates: Requirements 8.1
 * 
 * *任意の* 位置競合が検出された場合、UI側の位置が優先される
 */
describe('ConflictResolver - Property 11: Position Conflict Resolution', () => {
    let resolver: ConflictResolver;

    beforeEach(() => {
        resolver = new ConflictResolver();
    });

    /**
     * Property 11: 位置競合時のUI優先
     * 任意の位置競合に対して、解決後の位置はUI側の位置と一致する
     */
    it('should prioritize UI position for any position conflict', async () => {
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                differentPositionsArb,
                async (baseNote, [filePosition, uiPosition]) => {
                    const fileNote: StickyNote = {
                        ...baseNote,
                        position: filePosition
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        position: uiPosition
                    };

                    // 競合を検出
                    const conflictType = resolver.detectConflict(fileNote, uiNote);
                    expect(conflictType).toBe('position');

                    // 競合を解決
                    const result = await resolver.resolveConflict(fileNote, uiNote, 'position');

                    // UI側の位置が優先されることを確認
                    expect(result.success).toBe(true);
                    expect(result.strategy).toBe('ui-wins');
                    expect(result.result.position.x).toBe(uiPosition.x);
                    expect(result.result.position.y).toBe(uiPosition.y);
                    expect(result.result.position.zIndex).toBe(uiPosition.zIndex);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 位置が同じ場合は競合なし
     */
    it('should not detect position conflict when positions are identical', () => {
        fc.assert(
            fc.property(
                stickyNoteArb('shared-id'),
                positionArb,
                (baseNote, position) => {
                    const fileNote: StickyNote = { ...baseNote, position };
                    const uiNote: StickyNote = { ...baseNote, position };

                    const conflictType = resolver.detectConflict(fileNote, uiNote);
                    
                    // 位置が同じなら位置競合は検出されない
                    expect(conflictType).not.toBe('position');
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * Feature: postodo-sticky-notes
 * Property 12: コンテンツ競合時の新しい方優先
 * Validates: Requirements 8.2
 * 
 * *任意の* コンテンツ競合が検出された場合、より新しい変更が優先される
 */
describe('ConflictResolver - Property 12: Content Conflict Resolution', () => {
    let resolver: ConflictResolver;

    beforeEach(() => {
        resolver = new ConflictResolver();
    });

    /**
     * Property 12: コンテンツ競合時の新しい方優先
     * 任意のコンテンツ競合に対して、解決後のコンテンツは新しい方と一致する
     */
    it('should prioritize newer content for any content conflict', async () => {
        // 古い日付と新しい日付を生成
        const olderDateArb = fc.integer({ min: 1577836800000, max: 1735689600000 }); // 2020-01-01 to 2025-01-01
        const newerDateArb = fc.integer({ min: 1735776000000, max: 1893456000000 }); // 2025-01-02 to 2030-01-01
        
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                differentContentsArb,
                olderDateArb,
                newerDateArb,
                async (baseNote, [olderContent, newerContent], olderMs, newerMs) => {
                    const olderDate = new Date(olderMs);
                    const newerDate = new Date(newerMs);
                    const fileNote: StickyNote = {
                        ...baseNote,
                        content: olderContent,
                        metadata: {
                            ...baseNote.metadata,
                            modified: olderDate.toISOString()
                        }
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        content: newerContent,
                        metadata: {
                            ...baseNote.metadata,
                            modified: newerDate.toISOString()
                        }
                    };

                    // 競合を検出
                    const conflictType = resolver.detectConflict(fileNote, uiNote);
                    expect(conflictType).toBe('content');

                    // 競合を解決
                    const result = await resolver.resolveConflict(fileNote, uiNote, 'content');

                    // 新しい方（UI）のコンテンツが優先されることを確認
                    expect(result.success).toBe(true);
                    expect(result.strategy).toBe('ui-wins');
                    expect(result.result.content).toBe(newerContent);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * ファイル側が新しい場合はファイル側が優先される
     */
    it('should prioritize file content when file is newer', async () => {
        // 古い日付と新しい日付を生成
        const olderDateArb = fc.integer({ min: 1577836800000, max: 1735689600000 }); // 2020-01-01 to 2025-01-01
        const newerDateArb = fc.integer({ min: 1735776000000, max: 1893456000000 }); // 2025-01-02 to 2030-01-01
        
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                differentContentsArb,
                newerDateArb,
                olderDateArb,
                async (baseNote, [fileContent, uiContent], newerMs, olderMs) => {
                    const newerDate = new Date(newerMs);
                    const olderDate = new Date(olderMs);
                    const fileNote: StickyNote = {
                        ...baseNote,
                        content: fileContent,
                        metadata: {
                            ...baseNote.metadata,
                            modified: newerDate.toISOString()
                        }
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        content: uiContent,
                        metadata: {
                            ...baseNote.metadata,
                            modified: olderDate.toISOString()
                        }
                    };

                    // 競合を解決
                    const result = await resolver.resolveConflict(fileNote, uiNote, 'content');

                    // ファイル側のコンテンツが優先されることを確認
                    expect(result.success).toBe(true);
                    expect(result.strategy).toBe('file-wins');
                    expect(result.result.content).toBe(fileContent);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * コンテンツが同じ場合は競合なし
     */
    it('should not detect content conflict when contents are identical', () => {
        fc.assert(
            fc.property(
                stickyNoteArb('shared-id'),
                fc.string({ minLength: 1, maxLength: 100 }),
                (baseNote, content) => {
                    const fileNote: StickyNote = { ...baseNote, content };
                    const uiNote: StickyNote = { ...baseNote, content };

                    const conflictType = resolver.detectConflict(fileNote, uiNote);
                    
                    // コンテンツが同じならコンテンツ競合は検出されない
                    expect(conflictType).not.toBe('content');
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * Feature: postodo-sticky-notes
 * Property 13: メタデータ競合時のマージ
 * Validates: Requirements 8.3
 * 
 * *任意の* メタデータ競合が検出された場合、競合しないフィールドがマージされる
 */
describe('ConflictResolver - Property 13: Metadata Conflict Resolution', () => {
    let resolver: ConflictResolver;

    beforeEach(() => {
        resolver = new ConflictResolver();
    });

    /**
     * Property 13: メタデータ競合時のマージ
     * 任意のメタデータ競合に対して、タグ・リンク・添付ファイルがマージされる
     */
    it('should merge metadata fields for any metadata conflict', async () => {
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
                fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
                async (baseNote, fileTags, uiTags) => {
                    // 異なるタグを持つ2つのノートを作成
                    const fileNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            tags: fileTags
                        }
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            tags: uiTags
                        }
                    };

                    // 競合を解決
                    const result = await resolver.resolveConflict(fileNote, uiNote, 'metadata');

                    // マージ戦略が適用されることを確認
                    expect(result.success).toBe(true);
                    expect(result.strategy).toBe('merge');

                    // 両方のタグがマージされていることを確認
                    const expectedTags = [...new Set([...fileTags, ...uiTags])];
                    expect(result.result.metadata.tags.sort()).toEqual(expectedTags.sort());
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * リンクのマージテスト
     */
    it('should merge links from both file and UI notes', async () => {
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
                async (baseNote, fileLinks, uiLinks) => {
                    const fileNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            links: fileLinks
                        }
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            links: uiLinks
                        }
                    };

                    const result = await resolver.resolveConflict(fileNote, uiNote, 'metadata');

                    // 両方のリンクがマージされていることを確認
                    const expectedLinks = [...new Set([...fileLinks, ...uiLinks])];
                    expect(result.result.metadata.links.sort()).toEqual(expectedLinks.sort());
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 添付ファイルのマージテスト
     */
    it('should merge attachments from both file and UI notes', async () => {
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
                fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
                async (baseNote, fileAttachments, uiAttachments) => {
                    const fileNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            attachments: fileAttachments
                        }
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            attachments: uiAttachments
                        }
                    };

                    const result = await resolver.resolveConflict(fileNote, uiNote, 'metadata');

                    // 両方の添付ファイルがマージされていることを確認
                    const expectedAttachments = [...new Set([...fileAttachments, ...uiAttachments])];
                    expect(result.result.metadata.attachments.sort()).toEqual(expectedAttachments.sort());
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 重複排除テスト
     * マージ時に重複が排除されることを確認
     */
    it('should deduplicate merged metadata fields', async () => {
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
                async (baseNote, sharedTags) => {
                    // 同じタグを持つ2つのノートを作成
                    const fileNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            tags: sharedTags
                        }
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        metadata: {
                            ...baseNote.metadata,
                            tags: sharedTags
                        }
                    };

                    const result = await resolver.resolveConflict(fileNote, uiNote, 'metadata');

                    // 重複が排除されていることを確認
                    const uniqueTags = [...new Set(sharedTags)];
                    expect(result.result.metadata.tags.length).toBe(uniqueTags.length);
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * 複合競合テスト
 * 複数の競合が同時に発生した場合のテスト
 */
describe('ConflictResolver - Multiple Conflicts', () => {
    let resolver: ConflictResolver;

    beforeEach(() => {
        resolver = new ConflictResolver();
    });

    /**
     * 全ての競合を検出するテスト
     */
    it('should detect all conflict types when multiple conflicts exist', () => {
        fc.assert(
            fc.property(
                stickyNoteArb('shared-id'),
                differentPositionsArb,
                differentContentsArb,
                differentMetadataArb,
                (baseNote, [filePos, uiPos], [fileContent, uiContent], [fileMeta, uiMeta]) => {
                    const fileNote: StickyNote = {
                        ...baseNote,
                        position: filePos,
                        content: fileContent,
                        metadata: fileMeta
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        position: uiPos,
                        content: uiContent,
                        metadata: uiMeta
                    };

                    const detection = resolver.detectAllConflicts(fileNote, uiNote);

                    expect(detection.hasConflict).toBe(true);
                    expect(detection.conflictTypes).toContain('position');
                    expect(detection.conflictTypes).toContain('content');
                    expect(detection.conflictTypes).toContain('metadata');
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 全ての競合を解決するテスト
     */
    it('should resolve all conflicts when multiple conflicts exist', async () => {
        await fc.assert(
            fc.asyncProperty(
                stickyNoteArb('shared-id'),
                differentPositionsArb,
                async (baseNote, [filePos, uiPos]) => {
                    const fileNote: StickyNote = {
                        ...baseNote,
                        position: filePos
                    };
                    const uiNote: StickyNote = {
                        ...baseNote,
                        position: uiPos
                    };

                    const result = await resolver.resolveAllConflicts(fileNote, uiNote);

                    expect(result.success).toBe(true);
                    // 位置はUI優先
                    expect(result.result.position.x).toBe(uiPos.x);
                    expect(result.result.position.y).toBe(uiPos.y);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 競合がない場合のテスト
     */
    it('should return no conflict when notes are identical', () => {
        fc.assert(
            fc.property(
                stickyNoteArb('shared-id'),
                (note) => {
                    const detection = resolver.detectAllConflicts(note, note);

                    expect(detection.hasConflict).toBe(false);
                    expect(detection.conflictTypes).toHaveLength(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * 異なるIDの場合は競合なしとして扱う
     */
    it('should return no conflict when note IDs are different', () => {
        fc.assert(
            fc.property(
                stickyNoteArb('note-1'),
                stickyNoteArb('note-2'),
                (note1, note2) => {
                    const detection = resolver.detectAllConflicts(note1, note2);

                    expect(detection.hasConflict).toBe(false);
                    expect(detection.conflictTypes).toHaveLength(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});
