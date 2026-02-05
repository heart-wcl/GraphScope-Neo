/**
 * Dependency Injection Container
 * 依赖注入容器 - 便于测试和替换实现
 */

export type ServiceLifetime = 'Singleton' | 'Scoped' | 'Transient';

export interface ServiceDescriptor<T = any> {
  id: string;
  factory: (...args: any[]) => T;
  lifetime: ServiceLifetime;
  dependencies?: string[];
}

export class DIContainer {
  private services: Map<string, any> = new Map();
  private descriptors: Map<string, ServiceDescriptor> = new Map();

  /**
   * 注册服务
   */
  register<T = any>(descriptor: ServiceDescriptor<T>): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  /**
   * 批量注册
   */
  registerBatch(descriptors: ServiceDescriptor[]): void {
    descriptors.forEach(d => this.register(d));
  }

  /**
   * 解析服务
   */
  resolve<T = any>(serviceId: string): T {
    // 检查是否已创建
    if (this.services.has(serviceId)) {
      return this.services.get(serviceId);
    }

    // 获取服务描述
    const descriptor = this.descriptors.get(serviceId);
    if (!descriptor) {
      throw new Error(`Service "${serviceId}" not registered`);
    }

    // 解析依赖
    const dependencies = descriptor.dependencies || [];
    const resolvedDeps = dependencies.map(dep => this.resolve(dep));

    // 创建服务实例
    const instance = descriptor.factory(...resolvedDeps);

    // Singleton 模式缓存实例
    if (descriptor.lifetime === 'Singleton') {
      this.services.set(serviceId, instance);
    }

    return instance;
  }

  /**
   * 解析所有服务（用于调试）
   */
  resolveAll(): Record<string, any> {
    const services: Record<string, any> = {};

    this.descriptors.forEach((descriptor, id) => {
      if (descriptor.lifetime === 'Singleton') {
        services[id] = this.resolve(id);
      }
    });

    return services;
  }

  /**
   * 检查服务是否已注册
   */
  has(serviceId: string): boolean {
    return this.descriptors.has(serviceId);
  }

  /**
   * 清除所有服务（用于测试）
   */
  clear(): void {
    this.services.clear();
    this.descriptors.clear();
  }

  /**
   * 创建子容器（用于 Scoped 服务）
   */
  createChild(): DIContainer {
    const child = new DIContainer();
    
    // 继承父容器的服务描述
    this.descriptors.forEach((descriptor, id) => {
      child.register({ ...descriptor, lifetime: 'Scoped' as any });
    });

    return child;
  }
}

// 全局单例容器
export const globalContainer = new DIContainer();

// 常用服务ID常量
export const SERVICE_IDS = {
  // Neo4j 服务
  NEO4J_DRIVER: 'neo4j:driver',
  NEO4J_EXECUTOR: 'neo4j:executor',
  NEO4J_LOADER: 'neo4j:loader',

  // 性能服务
  PERFORMANCE_MONITOR: 'performance:monitor',
  PERFORMANCE_TRACKER: 'performance:tracker',
  VIEWPORT_CULLER: 'performance:viewportCuller',
  LOD_RENDERER: 'performance:lodRenderer',

  // 缓存服务
  CACHE_SERVICE: 'cache:service',
  QUERY_CACHE: 'cache:query',

  // 事件服务
  EVENT_BUS: 'events:bus',

  // UI 服务
  THEME_SERVICE: 'ui:theme',
  TOAST_SERVICE: 'ui:toast',
  MODAL_SERVICE: 'ui:modal',

  // 工具服务
  LOGGER: 'utils:logger',
  VALIDATOR: 'utils:validator',
} as const;

export type ServiceId = typeof SERVICE_IDS[keyof typeof SERVICE_IDS];

export default DIContainer;
