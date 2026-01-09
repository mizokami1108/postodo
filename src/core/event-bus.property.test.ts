import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { EventBus } from './event-bus';

/**
 * 有効なイベント名を生成するArbitrary
 * ドット区切りの階層的なイベント名
 */
const eventSegmentArb = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => s.trim().length > 0 && !s.includes('.') && !s.includes('*') && !s.includes('?'))
    .map(s => s.trim().replace(/[^a-zA-Z0-9_-]/g, ''));

const validEventNameArb = fc.array(eventSegmentArb, { minLength: 1, maxLength: 4 })
    .filter(arr => arr.every(s => s.length > 0))
    .map(arr => arr.join('.'));

/**
 * ワイルドカードパターンを生成するArbitrary
 */
const wildcardPatternArb = fc.array(
    fc.oneof(
        eventSegmentArb,
        fc.constant('*')
    ),
    { minLength: 1, maxLength: 4 }
).filter(arr => arr.every(s => s.length > 0))
 .map(arr => arr.join('.'));

/**
 * Feature: postodo-sticky-notes
 * Property 18: イベントバスのパターンマッチング
 * Validates: Requirements 12.4
 * 
 * *任意の* ワイルドカードパターンに対して、マッチするイベントが正しくリスナーに配信される
 */
describe('EventBus - Property 18: イベントパターンマッチング', () => {
    let eventBus: EventBus;

    beforeEach(() => {
        eventBus = new EventBus();
    });

    /**
     * Property 18.1: 完全一致のイベントはリスナーに配信される
     * Requirements 12.4: THE Event_Bus SHALL イベントの購読、購読解除、ワイルドカードパターンマッチングをサポートする
     */
    it('should deliver exact match events to listeners', () => {
        fc.assert(
            fc.property(
                validEventNameArb,
                fc.anything(),
                (eventName, eventData) => {
                    let receivedData: any = undefined;
                    let receivedEvent: string | undefined = undefined;
                    let callCount = 0;
                    
                    eventBus.on(eventName, (data, event) => {
                        receivedData = data;
                        receivedEvent = event;
                        callCount++;
                    });
                    
                    eventBus.emit(eventName, eventData);
                    
                    expect(callCount).toBe(1);
                    expect(receivedData).toEqual(eventData);
                    expect(receivedEvent).toBe(eventName);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 18.2: ワイルドカード「*」は任意のセグメントにマッチする
     */
    it('should match wildcard "*" to any segment', () => {
        fc.assert(
            fc.property(
                eventSegmentArb,
                eventSegmentArb,
                fc.anything(),
                (prefix, suffix, eventData) => {
                    if (!prefix || !suffix) return;
                    
                    let callCount = 0;
                    let receivedEvent: string | undefined;
                    
                    // パターン "prefix.*" を登録
                    eventBus.onPattern(`${prefix}.*`, (data, event) => {
                        callCount++;
                        receivedEvent = event;
                    });
                    
                    // "prefix.suffix" を発火
                    const eventName = `${prefix}.${suffix}`;
                    eventBus.emit(eventName, eventData);
                    
                    expect(callCount).toBe(1);
                    expect(receivedEvent).toBe(eventName);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 18.3: マッチしないイベントはリスナーに配信されない
     */
    it('should not deliver non-matching events to listeners', () => {
        fc.assert(
            fc.property(
                validEventNameArb,
                validEventNameArb,
                fc.anything(),
                (subscribedEvent, emittedEvent, eventData) => {
                    // 同じイベント名の場合はスキップ
                    if (subscribedEvent === emittedEvent) return;
                    
                    let callCount = 0;
                    
                    eventBus.on(subscribedEvent, () => {
                        callCount++;
                    });
                    
                    eventBus.emit(emittedEvent, eventData);
                    
                    expect(callCount).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 18.4: once()で登録したリスナーは一度だけ呼ばれる
     */
    it('should call once() listeners only once', () => {
        fc.assert(
            fc.property(
                validEventNameArb,
                fc.integer({ min: 2, max: 10 }),
                fc.anything(),
                (eventName, emitCount, eventData) => {
                    let callCount = 0;
                    
                    eventBus.once(eventName, () => {
                        callCount++;
                    });
                    
                    // 複数回発火
                    for (let i = 0; i < emitCount; i++) {
                        eventBus.emit(eventName, eventData);
                    }
                    
                    // 一度だけ呼ばれることを確認
                    expect(callCount).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 18.5: off()で購読解除したリスナーは呼ばれない
     */
    it('should not call listeners after off()', () => {
        fc.assert(
            fc.property(
                validEventNameArb,
                fc.anything(),
                (eventName, eventData) => {
                    let callCount = 0;
                    
                    const listener = () => {
                        callCount++;
                    };
                    
                    eventBus.on(eventName, listener);
                    eventBus.emit(eventName, eventData);
                    
                    expect(callCount).toBe(1);
                    
                    // 購読解除
                    eventBus.off(eventName, listener);
                    eventBus.emit(eventName, eventData);
                    
                    // 購読解除後は呼ばれない
                    expect(callCount).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 18.6: on()の戻り値で購読解除できる
     */
    it('should unsubscribe using the returned function from on()', () => {
        fc.assert(
            fc.property(
                validEventNameArb,
                fc.anything(),
                (eventName, eventData) => {
                    let callCount = 0;
                    
                    const unsubscribe = eventBus.on(eventName, () => {
                        callCount++;
                    });
                    
                    eventBus.emit(eventName, eventData);
                    expect(callCount).toBe(1);
                    
                    // 戻り値の関数で購読解除
                    unsubscribe();
                    eventBus.emit(eventName, eventData);
                    
                    // 購読解除後は呼ばれない
                    expect(callCount).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 18.7: 複数のリスナーが同じイベントを購読できる
     */
    it('should support multiple listeners for the same event', () => {
        fc.assert(
            fc.property(
                validEventNameArb,
                fc.integer({ min: 2, max: 10 }),
                fc.anything(),
                (eventName, listenerCount, eventData) => {
                    const callCounts: number[] = Array(listenerCount).fill(0);
                    
                    // 複数のリスナーを登録
                    for (let i = 0; i < listenerCount; i++) {
                        const index = i;
                        eventBus.on(eventName, () => {
                            callCounts[index]++;
                        });
                    }
                    
                    eventBus.emit(eventName, eventData);
                    
                    // 全てのリスナーが呼ばれることを確認
                    for (const count of callCounts) {
                        expect(count).toBe(1);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 18.8: ワイルドカードパターンの購読解除
     */
    it('should unsubscribe wildcard pattern listeners', () => {
        fc.assert(
            fc.property(
                eventSegmentArb,
                eventSegmentArb,
                fc.anything(),
                (prefix, suffix, eventData) => {
                    if (!prefix || !suffix) return;
                    
                    let callCount = 0;
                    
                    const unsubscribe = eventBus.onPattern(`${prefix}.*`, () => {
                        callCount++;
                    });
                    
                    const eventName = `${prefix}.${suffix}`;
                    eventBus.emit(eventName, eventData);
                    expect(callCount).toBe(1);
                    
                    // 購読解除
                    unsubscribe();
                    eventBus.emit(eventName, eventData);
                    
                    // 購読解除後は呼ばれない
                    expect(callCount).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 18.9: 末尾のワイルドカードは複数セグメントにマッチする
     */
    it('should match trailing wildcard to multiple segments', () => {
        fc.assert(
            fc.property(
                eventSegmentArb,
                fc.array(eventSegmentArb, { minLength: 1, maxLength: 3 }),
                fc.anything(),
                (prefix, suffixes, eventData) => {
                    if (!prefix || suffixes.length === 0 || suffixes.some(s => !s)) return;
                    
                    let callCount = 0;
                    let receivedEvent: string | undefined;
                    
                    // パターン "prefix.*" を登録
                    eventBus.onPattern(`${prefix}.*`, (data, event) => {
                        callCount++;
                        receivedEvent = event;
                    });
                    
                    // "prefix.a.b.c" のような複数セグメントのイベントを発火
                    const eventName = `${prefix}.${suffixes.join('.')}`;
                    eventBus.emit(eventName, eventData);
                    
                    expect(callCount).toBe(1);
                    expect(receivedEvent).toBe(eventName);
                }
            ),
            { numRuns: 100 }
        );
    });
});
