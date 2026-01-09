import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DIContainer, ServiceOptions } from './container';

/**
 * テスト用のシンプルなサービスクラス
 */
class SimpleService {
    public readonly instanceId: string;
    
    constructor() {
        this.instanceId = `instance-${Math.random().toString(36).substring(7)}`;
    }
}

/**
 * 依存関係を持つサービスクラス
 */
class DependentService {
    public readonly instanceId: string;
    
    constructor(public readonly dependency: SimpleService) {
        this.instanceId = `dependent-${Math.random().toString(36).substring(7)}`;
    }
}

/**
 * 複数の依存関係を持つサービスクラス
 */
class MultiDependentService {
    public readonly instanceId: string;
    
    constructor(
        public readonly dep1: SimpleService,
        public readonly dep2: DependentService
    ) {
        this.instanceId = `multi-${Math.random().toString(36).substring(7)}`;
    }
}

/**
 * 有効なトークン名を生成するArbitrary
 */
const validTokenArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0 && !s.includes(' '))
    .map(s => s.trim());

/**
 * Feature: postodo-sticky-notes
 * Property 16: DIコンテナのシングルトン保証
 * Validates: Requirements 12.1, 12.3
 * 
 * *任意の* シングルトンとして登録されたサービスに対して、
 * 複数回の resolve で同一インスタンスが返される
 */
describe('DIContainer - Property 16: シングルトン保証', () => {
    let container: DIContainer;

    beforeEach(() => {
        container = new DIContainer();
    });

    /**
     * Property 16.1: シングルトンとして登録されたサービスは同一インスタンスを返す
     * Requirements 12.1: THE DI_Container SHALL シングルトンとトランジェントのライフタイムでサービス登録をサポートする
     */
    it('should return the same instance for singleton services on multiple resolves', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                fc.integer({ min: 2, max: 10 }),
                (token, resolveCount) => {
                    container.clear();
                    
                    // シングルトンとして登録
                    container.register(token, SimpleService, { singleton: true });
                    
                    // 複数回resolveして全て同じインスタンスか確認
                    const instances: SimpleService[] = [];
                    for (let i = 0; i < resolveCount; i++) {
                        instances.push(container.resolve<SimpleService>(token));
                    }
                    
                    // 全てのインスタンスが同一であることを確認
                    const firstInstance = instances[0];
                    for (const instance of instances) {
                        expect(instance).toBe(firstInstance);
                        expect(instance.instanceId).toBe(firstInstance.instanceId);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 16.2: トランジェントとして登録されたサービスは異なるインスタンスを返す
     */
    it('should return different instances for transient services on multiple resolves', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                fc.integer({ min: 2, max: 10 }),
                (token, resolveCount) => {
                    container.clear();
                    
                    // トランジェント（デフォルト）として登録
                    container.register(token, SimpleService, { singleton: false });
                    
                    // 複数回resolveして異なるインスタンスか確認
                    const instanceIds = new Set<string>();
                    for (let i = 0; i < resolveCount; i++) {
                        const instance = container.resolve<SimpleService>(token);
                        instanceIds.add(instance.instanceId);
                    }
                    
                    // 全てのインスタンスIDが異なることを確認
                    expect(instanceIds.size).toBe(resolveCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 16.3: 未登録のサービスを解決しようとするとエラーがスローされる
     * Requirements 12.3: WHEN サービスが要求された場合 THEN THE DI_Container SHALL 
     *                    登録された実装を返すか、説明的なエラーをスローする
     */
    it('should throw descriptive error for unregistered services', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                (token) => {
                    container.clear();
                    
                    // 登録せずにresolveを試行
                    expect(() => container.resolve(token)).toThrow(`Service not registered: ${token}`);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 16.4: has()メソッドは登録状態を正しく返す
     */
    it('should correctly report service registration status with has()', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                fc.boolean(),
                (token, shouldRegister) => {
                    container.clear();
                    
                    if (shouldRegister) {
                        container.register(token, SimpleService);
                    }
                    
                    expect(container.has(token)).toBe(shouldRegister);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 16.5: clear()後はシングルトンインスタンスもリセットされる
     */
    it('should reset singleton instances after clear()', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                (token) => {
                    container.clear();
                    
                    // シングルトンとして登録
                    container.register(token, SimpleService, { singleton: true });
                    
                    // 最初のインスタンスを取得
                    const firstInstance = container.resolve<SimpleService>(token);
                    
                    // コンテナをクリア
                    container.clear();
                    
                    // 再登録
                    container.register(token, SimpleService, { singleton: true });
                    
                    // 新しいインスタンスを取得
                    const secondInstance = container.resolve<SimpleService>(token);
                    
                    // 異なるインスタンスであることを確認
                    expect(secondInstance.instanceId).not.toBe(firstInstance.instanceId);
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * Feature: postodo-sticky-notes
 * Property 17: DIコンテナの依存関係解決
 * Validates: Requirements 12.2
 * 
 * *任意の* 依存関係を持つサービスに対して、依存関係が再帰的に解決される
 */
describe('DIContainer - Property 17: 依存関係解決', () => {
    let container: DIContainer;

    beforeEach(() => {
        container = new DIContainer();
    });

    /**
     * Property 17.1: 単一の依存関係が正しく解決される
     * Requirements 12.2: THE DI_Container SHALL 登録されたトークンに基づいて依存関係を再帰的に解決する
     */
    it('should resolve single dependency correctly', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                validTokenArb.filter(t => t !== 'simple'), // 異なるトークンを保証
                (dependentToken, simpleToken) => {
                    // トークンが同じ場合はスキップ
                    if (dependentToken === simpleToken) return;
                    
                    container.clear();
                    
                    // 依存関係を登録
                    container.register(simpleToken, SimpleService);
                    container.register(dependentToken, DependentService, {
                        dependencies: [simpleToken]
                    });
                    
                    // 依存関係を持つサービスを解決
                    const dependent = container.resolve<DependentService>(dependentToken);
                    
                    // 依存関係が正しく注入されていることを確認
                    expect(dependent).toBeInstanceOf(DependentService);
                    expect(dependent.dependency).toBeInstanceOf(SimpleService);
                    expect(dependent.dependency.instanceId).toBeDefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 17.2: 複数の依存関係が正しく解決される
     */
    it('should resolve multiple dependencies correctly', () => {
        container.clear();
        
        // 固定トークンで登録（複雑な依存関係チェーン）
        container.register('simple', SimpleService);
        container.register('dependent', DependentService, {
            dependencies: ['simple']
        });
        container.register('multi', MultiDependentService, {
            dependencies: ['simple', 'dependent']
        });
        
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }),
                (resolveCount) => {
                    for (let i = 0; i < resolveCount; i++) {
                        const multi = container.resolve<MultiDependentService>('multi');
                        
                        // 全ての依存関係が正しく注入されていることを確認
                        expect(multi).toBeInstanceOf(MultiDependentService);
                        expect(multi.dep1).toBeInstanceOf(SimpleService);
                        expect(multi.dep2).toBeInstanceOf(DependentService);
                        expect(multi.dep2.dependency).toBeInstanceOf(SimpleService);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 17.3: シングルトン依存関係は共有される
     */
    it('should share singleton dependencies across services', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 5 }),
                (resolveCount) => {
                    container.clear();
                    
                    // シングルトンとして依存関係を登録
                    container.register('sharedSimple', SimpleService, { singleton: true });
                    container.register('dependent1', DependentService, {
                        dependencies: ['sharedSimple']
                    });
                    container.register('dependent2', DependentService, {
                        dependencies: ['sharedSimple']
                    });
                    
                    const dependents1: DependentService[] = [];
                    const dependents2: DependentService[] = [];
                    
                    for (let i = 0; i < resolveCount; i++) {
                        dependents1.push(container.resolve<DependentService>('dependent1'));
                        dependents2.push(container.resolve<DependentService>('dependent2'));
                    }
                    
                    // 全ての依存関係が同じシングルトンインスタンスを参照していることを確認
                    const sharedInstanceId = dependents1[0].dependency.instanceId;
                    
                    for (const dep of [...dependents1, ...dependents2]) {
                        expect(dep.dependency.instanceId).toBe(sharedInstanceId);
                    }
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 17.4: ファクトリ関数での依存関係解決
     */
    it('should resolve dependencies for factory-registered services', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                (factoryToken) => {
                    container.clear();
                    
                    container.register('simpleForFactory', SimpleService);
                    
                    // ファクトリ関数で登録
                    container.registerFactory(
                        factoryToken,
                        (simple: SimpleService) => new DependentService(simple),
                        ['simpleForFactory']
                    );
                    
                    const result = container.resolve<DependentService>(factoryToken);
                    
                    expect(result).toBeInstanceOf(DependentService);
                    expect(result.dependency).toBeInstanceOf(SimpleService);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 17.5: 依存関係が見つからない場合はエラーがスローされる
     */
    it('should throw error when dependency is not registered', () => {
        fc.assert(
            fc.property(
                validTokenArb,
                validTokenArb,
                (serviceToken, missingDepToken) => {
                    if (serviceToken === missingDepToken) return;
                    
                    container.clear();
                    
                    // 依存関係を登録せずにサービスを登録
                    container.register(serviceToken, DependentService, {
                        dependencies: [missingDepToken]
                    });
                    
                    // 解決時にエラーがスローされることを確認
                    expect(() => container.resolve(serviceToken))
                        .toThrow(`Service not registered: ${missingDepToken}`);
                }
            ),
            { numRuns: 100 }
        );
    });
});
