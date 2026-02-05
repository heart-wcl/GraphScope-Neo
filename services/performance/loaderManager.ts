/**
 * Loader Manager
 * 统一管理所有加载器（查询优化、增量加载等）
 */

import type { Driver } from 'neo4j-driver';
import { IncrementalLoader, createIncrementalLoader, IncrementalLoaderConfig } from './incrementalLoader';
import * as QueryOptimizer from './queryOptimizer';
import type { GraphData } from '../neo4j';

export interface PerformanceLoaderConfig {
  incremental?: IncrementalLoaderConfig;
  cacheEnabled?: boolean;
  cacheTTL?: number; // 缓存过期时间（毫秒）
}

export interface CachedResult {
  data: any;
  timestamp: number;
  expiresAt: number;
}

export class LoaderManager {
  private driver: Driver;
  private database?: string;
  private incrementalLoader: IncrementalLoader;
  private cache: Map<string, CachedResult> = new Map();
  private config: PerformanceLoaderConfig;

  constructor(
    driver: Driver,
    config: PerformanceLoaderConfig = {},
    database?: string
  ) {
    this.driver = driver;
    this.database = database;
    this.config = {
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5分钟
      ...config
    };

    this.incrementalLoader = createIncrementalLoader(
      driver,
      this.config.incremental,
      database
    );

    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 60 * 1000); // 每分钟清理一次
  }

  /**
   * 加载初始数据（带缓存）
   */
  async loadInitial(query: string, params: Record<string, any> = {}): Promise<GraphData> {
    const cacheKey = this.getCacheKey('initial', query, params);

    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<GraphData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const data = await this.incrementalLoader.loadInitial(query, params);

    if (this.config.cacheEnabled) {
      this.setCache(cacheKey, data);
    }

    return data;
  }

  /**
   * 加载邻节点
   */
  async loadNeighbors(nodeId: string): Promise<GraphData> {
    const cacheKey = this.getCacheKey('neighbors', nodeId);

    if (this.config.cacheEnabled) {
      const cached = this.getFromCache<GraphData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const data = await this.incrementalLoader.loadNeighbors(nodeId);

    if (this.config.cacheEnabled) {
      this.setCache(cacheKey, data, 2 * 60 * 1000); // 邻节点缓存2分钟
    }

    return data;
  }

  /**
   * 执行分页查询
   */
  async executePaginated(
    query: string,
    params: Record<string, any> = {},
    paginationConfig?: QueryOptimizer.QueryPaginationConfig
  ): Promise<QueryOptimizer.PaginatedResult<any[]>> {
    const config = paginationConfig || QueryOptimizer.DEFAULT_PAGINATION_CONFIG;
    return QueryOptimizer.executePaginatedQuery(
      this.driver,
      query,
      params,
      config,
      this.database
    );
  }

  /**
   * 执行优化查询
   */
  async executeOptimized(
    query: string,
    params: Record<string, any> = {},
    projection?: QueryOptimizer.RequiredProperties
  ): Promise<any> {
    let optimizedQuery = query;

    if (projection) {
      optimizedQuery = QueryOptimizer.generateOptimizedQuery(query, projection);
    }

    const session = this.driver.session(this.database ? { database: this.database } : undefined);
    try {
      const result = await session.run(optimizedQuery, params);
      return result.records.map(r => r.toObject());
    } finally {
      await session.close();
    }
  }

  /**
   * 获取索引列表
   */
  async getIndexes(): Promise<QueryOptimizer.IndexInfo[]> {
    return QueryOptimizer.getIndexes(this.driver, this.database);
  }

  /**
   * 创建索引
   */
  async createIndex(
    label: string,
    properties: string[],
    type?: QueryOptimizer.IndexType
  ): Promise<void> {
    return QueryOptimizer.createIndex(this.driver, label, properties, type, this.database);
  }

  /**
   * 分析查询性能
   */
  async analyzeQuery(query: string, params?: Record<string, any>) {
    return QueryOptimizer.analyzeQueryPerformance(this.driver, query, params, this.database);
  }

  /**
   * 获取加载进度
   */
  getProgress(totalNodes?: number, totalLinks?: number) {
    return this.incrementalLoader.getProgress(totalNodes, totalLinks);
  }

  /**
   * 清除缓存
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * 清除增量加载器缓存
   */
  clear(): void {
    this.incrementalLoader.clear();
    this.clearCache();
  }

  /**
   * 从缓存获取
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) return null;

    // 检查是否过期
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: any, ttl?: number): void {
    const cacheTTL = ttl || this.config.cacheTTL;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + cacheTTL
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[LoaderManager] Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(type: string, ...parts: any[]): string {
    const sortedParts = parts.map(p =>
      typeof p === 'object' ? JSON.stringify(p, Object.keys(p).sort()) : String(p)
    );
    return `${type}:${sortedParts.join(':')}`;
  }
}

/**
 * 创建加载器管理器
 */
export function createLoaderManager(
  driver: Driver,
  config?: PerformanceLoaderConfig,
  database?: string
): LoaderManager {
  return new LoaderManager(driver, config, database);
}
