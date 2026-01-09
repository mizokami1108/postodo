import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DisplayFilter } from './display-filter';
import { DisplayFilterType } from '../../interfaces/ui/i-display-filter';
import { StickyNote, NoteColor, NoteSize } from '../../types/core-types';

/**
 * Feature: postodo-sticky-notes
 * Property 8: 完了ステータスとフィルターの連動
 * Validates: Requirements 4.2, 4.3, 4.6
 * 
 * *任意の* 付箋と Display_Filter の組み合わせに対して、
 * フィルター条件に基づいて正しく表示/非表示が決定される
 */
describe('DisplayFilter - Property Tests', () => {
    // StickyNote生成用のArbitrary
    const stickyNoteArb = fc.record({
        id: fc.string({ minLength: 5, maxLength: 30 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        filePath: fc.constant('Postodo/test-note.md'),
        title: fc.string({ minLength: 0, maxLength: 100 }).map(s => s.trim()),
        content: fc.string({ minLength: 1, maxLength: 500 }).map(s => s.trim()),
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

    // フィルタータイプのArbitrary
    const filterTypeArb = fc.constantFrom<DisplayFilterType>('incomplete', 'complete', 'all');

    describe('Property 8: 完了ステータスとフィルターの連動', () => {
        /**
         * Property 8.1: 未完了フィルターは未完了の付箋のみを表示する
         * Requirements 4.2: WHEN Sticky_Note の完了ステータスが true に変更された場合
         *                   THEN THE Postodo_System SHALL 現在の Display_Filter に基づいて表示/非表示を決定する
         */
        it('should display only incomplete notes when filter is "incomplete"', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const filter = new DisplayFilter('incomplete');
                    const shouldDisplay = filter.shouldDisplay(note);
                    
                    // 未完了フィルターの場合、未完了の付箋のみ表示
                    expect(shouldDisplay).toBe(!note.completed);
                }),
                { numRuns: 100 }
            );
        });

        /**
         * Property 8.2: 完了フィルターは完了した付箋のみを表示する
         * Requirements 4.3: WHEN Sticky_Note の完了ステータスが false に変更された場合
         *                   THEN THE Postodo_System SHALL 現在の Display_Filter に基づいて表示/非表示を決定する
         */
        it('should display only completed notes when filter is "complete"', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const filter = new DisplayFilter('complete');
                    const shouldDisplay = filter.shouldDisplay(note);
                    
                    // 完了フィルターの場合、完了した付箋のみ表示
                    expect(shouldDisplay).toBe(note.completed);
                }),
                { numRuns: 100 }
            );
        });

        /**
         * Property 8.3: 全表示フィルターは全ての付箋を表示する
         */
        it('should display all notes when filter is "all"', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const filter = new DisplayFilter('all');
                    const shouldDisplay = filter.shouldDisplay(note);
                    
                    // 全表示フィルターの場合、全ての付箋を表示
                    expect(shouldDisplay).toBe(true);
                }),
                { numRuns: 100 }
            );
        });

        /**
         * Property 8.4: フィルター変更時の即座更新
         * Requirements 4.6: WHEN ユーザーが Display_Filter を変更した場合
         *                   THEN THE Postodo_System SHALL 即座に Canvas 上の Sticky_Note 表示を更新する
         */
        it('should notify listeners immediately when filter changes', () => {
            fc.assert(
                fc.property(
                    filterTypeArb,
                    filterTypeArb.filter(f => f !== 'incomplete'), // 初期値と異なるフィルター
                    (initialFilter, newFilter) => {
                        const filter = new DisplayFilter(initialFilter);
                        let notifiedFilter: DisplayFilterType | null = null;
                        
                        filter.onFilterChanged((f) => {
                            notifiedFilter = f;
                        });
                        
                        filter.setFilter(newFilter);
                        
                        // フィルターが変更された場合、リスナーが呼ばれる
                        if (initialFilter !== newFilter) {
                            expect(notifiedFilter).toBe(newFilter);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Property 8.5: 任意のフィルターと付箋の組み合わせで正しい判定
         */
        it('should correctly determine display for any filter and note combination', () => {
            fc.assert(
                fc.property(stickyNoteArb, filterTypeArb, (note, filterType) => {
                    const filter = new DisplayFilter(filterType);
                    const shouldDisplay = filter.shouldDisplay(note);
                    
                    // フィルタータイプに応じた正しい判定
                    switch (filterType) {
                        case 'incomplete':
                            expect(shouldDisplay).toBe(!note.completed);
                            break;
                        case 'complete':
                            expect(shouldDisplay).toBe(note.completed);
                            break;
                        case 'all':
                            expect(shouldDisplay).toBe(true);
                            break;
                    }
                }),
                { numRuns: 100 }
            );
        });

        /**
         * Property 8.6: フィルター状態の一貫性
         * 同じフィルターを設定しても状態が変わらない
         */
        it('should maintain consistent state when setting same filter', () => {
            fc.assert(
                fc.property(filterTypeArb, stickyNoteArb, (filterType, note) => {
                    const filter = new DisplayFilter(filterType);
                    let notificationCount = 0;
                    
                    filter.onFilterChanged(() => {
                        notificationCount++;
                    });
                    
                    // 同じフィルターを設定
                    filter.setFilter(filterType);
                    
                    // 同じフィルターを設定した場合、通知されない
                    expect(notificationCount).toBe(0);
                    expect(filter.currentFilter).toBe(filterType);
                    
                    // 表示判定も一貫している
                    const result1 = filter.shouldDisplay(note);
                    const result2 = filter.shouldDisplay(note);
                    expect(result1).toBe(result2);
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('DisplayFilter - Default Behavior', () => {
        /**
         * Requirements 4.7: THE Postodo_System SHALL デフォルトの Display_Filter として「未完了のみ表示」を使用する
         */
        it('should default to "incomplete" filter', () => {
            const filter = new DisplayFilter();
            expect(filter.currentFilter).toBe('incomplete');
        });

        /**
         * デフォルトフィルターで未完了の付箋が表示されることを確認
         */
        it('should display incomplete notes by default', () => {
            fc.assert(
                fc.property(stickyNoteArb, (note) => {
                    const filter = new DisplayFilter(); // デフォルト
                    const shouldDisplay = filter.shouldDisplay(note);
                    
                    // デフォルトは未完了のみ表示
                    expect(shouldDisplay).toBe(!note.completed);
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('DisplayFilter - Listener Management', () => {
        /**
         * リスナーの登録解除が正しく動作することを確認
         */
        it('should correctly unsubscribe listeners', () => {
            fc.assert(
                fc.property(filterTypeArb, filterTypeArb, (filter1, filter2) => {
                    const filter = new DisplayFilter(filter1);
                    let callCount = 0;
                    
                    const unsubscribe = filter.onFilterChanged(() => {
                        callCount++;
                    });
                    
                    // 登録解除
                    unsubscribe();
                    
                    // フィルター変更
                    if (filter1 !== filter2) {
                        filter.setFilter(filter2);
                    }
                    
                    // 登録解除後は通知されない
                    expect(callCount).toBe(0);
                }),
                { numRuns: 100 }
            );
        });

        /**
         * 複数リスナーが正しく通知されることを確認
         */
        it('should notify all registered listeners', () => {
            const filter = new DisplayFilter('incomplete');
            let listener1Called = false;
            let listener2Called = false;
            
            filter.onFilterChanged(() => {
                listener1Called = true;
            });
            
            filter.onFilterChanged(() => {
                listener2Called = true;
            });
            
            filter.setFilter('complete');
            
            expect(listener1Called).toBe(true);
            expect(listener2Called).toBe(true);
        });

        /**
         * クリーンアップ後はリスナーが呼ばれないことを確認
         */
        it('should not notify listeners after cleanup', () => {
            const filter = new DisplayFilter('incomplete');
            let callCount = 0;
            
            filter.onFilterChanged(() => {
                callCount++;
            });
            
            filter.cleanup();
            filter.setFilter('complete');
            
            expect(callCount).toBe(0);
        });
    });
});
