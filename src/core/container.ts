// DIコンテナシステム
export class DIContainer {
    private services = new Map<string, ServiceDefinition>();
    private instances = new Map<string, any>();
    private singletons = new Set<string>();

    register<T>(
        token: string, 
        implementation: new (...args: any[]) => T,
        options: ServiceOptions = {}
    ): void {
        this.services.set(token, {
            implementation,
            dependencies: options.dependencies || [],
            singleton: options.singleton || false,
            factory: options.factory
        });

        if (options.singleton) {
            this.singletons.add(token);
        }
    }

    registerFactory<T>(
        token: string,
        factory: (...args: any[]) => T,
        dependencies: string[] = []
    ): void {
        this.services.set(token, {
            factory,
            dependencies,
            singleton: false
        });
    }

    resolve<T>(token: string): T {
        // シングルトンの場合、既存インスタンスを返す
        if (this.singletons.has(token) && this.instances.has(token)) {
            return this.instances.get(token);
        }

        const service = this.services.get(token);
        if (!service) {
            throw new Error(`Service not registered: ${token}`);
        }

        // 依存関係を解決
        const dependencies = service.dependencies.map(dep => this.resolve(dep));

        let instance: T;
        if (service.factory) {
            instance = service.factory(...dependencies);
        } else {
            instance = new service.implementation!(...dependencies);
        }

        // シングルトンの場合、インスタンスを保存
        if (this.singletons.has(token)) {
            this.instances.set(token, instance);
        }

        return instance;
    }

    configure(configuration: ContainerConfiguration): void {
        configuration.services.forEach(config => {
            this.register(config.token, config.implementation, config.options);
        });

        configuration.factories?.forEach(config => {
            this.registerFactory(config.token, config.factory, config.dependencies);
        });
    }

    has(token: string): boolean {
        return this.services.has(token);
    }

    clear(): void {
        this.services.clear();
        this.instances.clear();
        this.singletons.clear();
    }
}

export interface ServiceDefinition {
    implementation?: new (...args: any[]) => any;
    factory?: (...args: any[]) => any;
    dependencies: string[];
    singleton: boolean;
}

export interface ServiceOptions {
    dependencies?: string[];
    singleton?: boolean;
    factory?: (...args: any[]) => any;
}

export interface ContainerConfiguration {
    services: ServiceConfig[];
    factories?: FactoryConfig[];
}

export interface ServiceConfig {
    token: string;
    implementation: new (...args: any[]) => any;
    options?: ServiceOptions;
}

export interface FactoryConfig {
    token: string;
    factory: (...args: any[]) => any;
    dependencies?: string[];
}