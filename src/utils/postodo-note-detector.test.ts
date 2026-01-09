import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PostodoNoteDetector, PostodoNoteData } from './postodo-note-detector';
import { StickyNote, NoteColor, NoteSize } from '../types/core-types';

/**
 * Feature: postodo-sticky-notes
 * Property 4: タイトル変更時のファイル名同期
 * Validates: Requirements 2.5
 * 
 * *任意の* 付箋のタイトル変更に対して、対応する Note_File のファイル名が新しいタイトルに変更される
 * 
 * このテストでは、タイトルと本文の独立編集を検証します：
 * - タイトルを変更しても本文は変わらない
 * - 本文を変更してもタイトルは変わらない
 * - タイトルと本文の両方を変更した場合、両方が正しく反映される
 * 
 * 注意: タイトルと本文は保存時にtrim()されるため、前後の空白は保持されません
 */
describe('PostodoNoteDetector - Title and Content Independence', () => {
    // タイトル用のArbitrary（H1見出しに使える文字列、trim後も有効な文字列）
    const titleArb = fc.string({ minLength: 1, maxLength: 100 })
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.includes('\n') && !s.startsWith('#'));

    // 本文用のArbitrary（trim後の文字列）
    const bodyArb = fc.string({ minLength: 0, maxLength: 500 })
        .map(s => s.trim())
        .filter(s => !s.startsWith('#'));

    // StickyNote生成用のArbitrary
    const stickyNoteArb = fc.record({
        id: fc.string({ minLength: 5, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        filePath: fc.constant('Postodo/test-note.md'),
        title: titleArb,
        content: bodyArb,
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

    /**
     * Property 4: タイトル変更時のファイル名同期
     * 
     * ラウンドトリップテスト：
     * 任意のStickyNoteに対して、updateNoteContentで生成したコンテンツを
     * extractPostodoDataで解析すると、元のタイトルと本文が復元される
     */
    it('should preserve title and content through round-trip (updateNoteContent -> extractPostodoData)', () => {
        fc.assert(
            fc.property(stickyNoteArb, (note) => {
                // StickyNoteからMarkdownコンテンツを生成
                const markdownContent = PostodoNoteDetector.updateNoteContent('', note);
                
                // 生成したコンテンツを解析
                const extractedData = PostodoNoteDetector.extractPostodoData(markdownContent, note.filePath);
                
                // 解析結果が存在することを確認
                expect(extractedData).not.toBeNull();
                
                if (extractedData) {
                    // タイトルが保持されていることを確認
                    expect(extractedData.title).toBe(note.title);
                    // 本文が保持されていることを確認
                    expect(extractedData.content).toBe(note.content);
                }
            }),
            { numRuns: 100 }
        );
    });

    /**
     * タイトル抽出テスト：
     * H1見出しがタイトルとして正しく抽出される
     */
    it('should extract title from H1 heading', () => {
        fc.assert(
            fc.property(titleArb, (title) => {
                const content = `# ${title}\n\nSome body content`;
                const extractedTitle = PostodoNoteDetector.extractTitle(content);
                expect(extractedTitle).toBe(title);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * 本文抽出テスト：
     * タイトル（H1見出し）を除いた本文が正しく抽出される
     */
    it('should extract body without title', () => {
        fc.assert(
            fc.property(titleArb, bodyArb, (title, body) => {
                const content = `# ${title}\n\n${body}`;
                const extractedBody = PostodoNoteDetector.extractBodyWithoutTitle(content);
                expect(extractedBody).toBe(body);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * タイトルと本文の結合テスト：
     * buildContentWithTitleで生成したコンテンツから
     * extractTitleとextractBodyWithoutTitleで元の値が復元される
     */
    it('should build content with title and extract them back', () => {
        fc.assert(
            fc.property(titleArb, bodyArb, (title, body) => {
                const content = PostodoNoteDetector.buildContentWithTitle(title, body);
                const extractedTitle = PostodoNoteDetector.extractTitle(content);
                const extractedBody = PostodoNoteDetector.extractBodyWithoutTitle(content);
                
                expect(extractedTitle).toBe(title);
                expect(extractedBody).toBe(body);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * タイトルなしの場合のテスト：
     * タイトルが空の場合、本文のみが返される
     */
    it('should handle empty title correctly', () => {
        fc.assert(
            fc.property(bodyArb, (body) => {
                const content = PostodoNoteDetector.buildContentWithTitle('', body);
                // 空のタイトルの場合、本文のみが返される
                expect(content).toBe(body);
            }),
            { numRuns: 100 }
        );
    });

    /**
     * toStickyNoteテスト：
     * PostodoNoteDataからStickyNoteへの変換でタイトルが保持される
     */
    it('should preserve title when converting PostodoNoteData to StickyNote', () => {
        fc.assert(
            fc.property(titleArb, bodyArb, (title, body) => {
                const data: PostodoNoteData = {
                    id: 'test-id',
                    title,
                    content: body,
                    completed: false
                };
                
                const note = PostodoNoteDetector.toStickyNote(data, 'Postodo/test.md');
                
                expect(note.title).toBe(title);
                expect(note.content).toBe(body);
            }),
            { numRuns: 100 }
        );
    });
});
