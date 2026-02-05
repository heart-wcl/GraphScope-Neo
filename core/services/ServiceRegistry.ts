/**
 * Service Implementations
 * 服务实现 - 使用依赖注入容器
 */

import type { Driver } from 'neo4j-driver';
import type { LoaderManager } from '../services/performance';
import { DIContainer, SERVICE_IDS } from '../core/di/DIContainer';
import { EventBus, EVENT_TYPES } from '../core/events/EventBus';
import type { PerformanceConfig } from '../types';

/**
 * Neo4j Driver 服务
 */
export class Neo4jDriverService {
  private driver: Driver | null = null;

  constructor(private config: { protocol: string; host: string; port: string; username: string; password: string; database?: string }) {}

  async initialize(): Promise<Driver> {
    const { driver } = await import('neo4j-driver');
    const { auth } = await import('neo4j-driver');

    const uri = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
    this.driver = driver(uri, auth.basic(this.config.username, this.config.password));

    return this.driver;
  }

  getDriver(): Driver {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return this.driver;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }

    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch (error) {
      console.error('Connection failed', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}

/**
 * 性能监控服务
 */
export class PerformanceMonitorService {
  private metrics: Map<string, number> = new Map();
  private history: Array<{ timestamp: number; metrics: Record<string, number> }> = [];

  constructor(private config: PerformanceConfig, private eventBus: EventBus) {}

  startMonitoring(): void {
    this.eventBus.on(EVENT_TYPES.PERFORMANCE_METRICS, (metrics: any) => {
      this.metrics.set('fps', metrics.fps);
      this.metrics.set('renderTime', metrics.renderTime);
      this.metrics.set('memory', metrics.memory);
      this.metrics.set('visibleNodes', metrics.visibleNodes);
      this.metrics.set('visibleLinks', metrics.visibleLinks);
      this.metrics.set('cullRate', metrics.cullRate);

      // 记录历史
      if (this.history.length > 600) { // 保留最近10分钟（假设每秒一次）
        this.history.shift();
      }
      this.history.push({
        timestamp: Date.now(),
        metrics: { fps: metrics.fps, renderTime: metrics.renderTime, memory: metrics.memory }
      });
    });
  }

  stopMonitoring(): void {
    this.eventBus.off(EVENT_TYPES.PERFORMANCE_METRICS);
  }

  getAverageMetrics(timeWindow: number = 60000): Record<string, number> {
    const now = Date.now();
    const recentHistory = this.history.filter(
      h => now - h.timestamp <= timeWindow
    );

    if (recentHistory.length === 0) {
      return {
        fps: 0,
        renderTime: 0,
        memory: 0
      };
    }

    const avgFps = recentHistory.reduce((sum, h) => sum + h.metrics.fps, 0) / recentHistory.length;
    const avgRenderTime = recentHistory.reduce((sum, h) => sum + h.metrics.renderTime, 0) / recentHistory.length;
    const avgMemory = recentHistory.reduce((sum, h) => sum + h.metrics.memory, 0) / recentHistory.length;

    return {
      fps: avgFps,
      renderTime: avgRenderTime,
      memory: avgMemory
    };
  }

  getHistory(): Array<{ timestamp: number; metrics: Record<string, number> }> {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.metrics.clear();
  }
}

/**
 * 缓存服务
 */
export class CacheService {
  private cache: Map<string, { value: any; expiresAt: number; metadata?: any }> = new Map();

  constructor(private eventBus: EventBus) {}

  get<T = any>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  set<T = any>(key: string, value: T, ttl: number = 5 * 60 * 1000, metadata?: any): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      metadata
    });

    this.eventBus.emit(EVENT_TYPES.DATA_LOADED, { key, metadata });
  }

  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }

    return Date.now() <= cached.expiresAt;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(pattern?: string): void {
    if (pattern) {
      const keys = Array.from(this.cache.keys()).filter(k => k.includes(pattern));
      keys.forEach(k => this.cache.delete(k));
    } else {
      this.cache.clear();
    }
  }

  getStats(): { size: number; keys: string[]; } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * 清理过期缓存
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    this.cache.forEach((cached, key) => {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    });

    return cleaned;
  }
}

/**
 * 配置服务
 */
export class ConfigService {
  private config: Record<string, any> = {};

  constructor(private eventBus: EventBus) {
    // 从 localStorage 加载初始配置
    this.loadFromStorage();
  }

  get<T = any>(key: string, defaultValue?: T): T {
    const value = this.config[key];
    return value !== undefined ? value as T : defaultValue;
  }

  set<T = any>(key: string, value: T): void {
    this.config[key] = value;
    this.saveToStorage();
    this.eventBus.emit(EVENT_TYPES.THEME_CHANGED, { key, value });
  }

  getAll(): Record<string, any> {
    return { ...this.config };
  }

  setAll(newConfig: Record<string, any>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveToStorage();
  }

  reset(): void {
    this.config = {};
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('neo4j-omnivis-config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('neo4j-omnivis-config');
      if (saved) {
        this.config = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }
}

/**
 * 服务工厂函数
 */
export function registerServices(container: DIContainer, config: {
  neo4j: { protocol: string; host: string; port: string; username: string; password: string; database?: string };
  performance: PerformanceConfig;
}): void {
  // 创建事件总线（Singleton）
  container.register({
    id: SERVICE_IDS.EVENT_BUS,
    factory: () => new EventBus(),
    lifetime: 'Singleton'
  });

  // 创建 Neo4j Driver 服务（Singleton）
  container.register({
    id: SERVICE_IDS.NEO4J_DRIVER,
    factory: () => new Neo4jDriverService(config.neo4j),
    lifetime: 'Singleton',
    dependencies: []
  });

  // 创建性能监控服务（Singleton）
  container.register({
    id: SERVICE_IDS.PERFORMANCE_MONITOR,
    factory: () => new PerformanceMonitorService(config.performance, container.resolve(SERVICE_IDS.EVENT_BUS)),
    lifetime: 'Singleton',
    dependencies: [SERVICE_IDS.EVENT_BUS]
  });

  // 创建缓存服务（Singleton）
  container.register({
    id: SERVICE_IDS.CACHE_SERVICE,
    factory: () => new CacheService(container.resolve(SERVICE_IDS.EVENT_BUS)),
    lifetime: 'Singleton',
    dependencies: [SERVICE_IDS.EVENT_BUS]
  });

  // 创建配置服务（Singleton）
  container.register({
    id: SERVICE_IDS.THEME_SERVICE,
    factory: () => new ConfigService(container.resolve(SERVICE_IDS.EVENT_BUS)),
    lifetime: 'Singleton',
    dependencies: [SERVICE_IDS.EVENT_BUS]
  });
}

export default { Neo4jDriverService, PerformanceMonitorService, CacheService, ConfigService, registerServices };
