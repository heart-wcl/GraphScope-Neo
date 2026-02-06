/**
 * 配置类型定义 - DDD 架构共享层
 * 统一所有配置类型的定义
 */

/**
 * 配置基类
 */
export interface BaseConfig {
  enabled?: boolean;
}

/**
 * 连接配置
 */
export interface ConnectionConfig {
  name: string;
  protocol: 'bolt' | 'neo4j' | 'neo4j+s' | 'bolt+s' | 'http' | 'https' | 'demo';
  host: string;
  port: string;
  username: string;
  password: string;
  database?: string;
}

/**
 * 会话配置
 */
export interface Session {
  id: string;
  config: ConnectionConfig;
}

/**
 * 缓存配置
 */
export interface CacheConfig extends BaseConfig {
  ttl: number;       // 毫秒
  maxSize: number;   // 最大缓存条目数
}

/**
 * 性能配置
 */
export interface PerformanceConfig extends BaseConfig {
  enableCulling: boolean;
  enableLOD: boolean;
  enableIncrementalLoad: boolean;
  cullingPadding: number;
  lodThresholds: {
    DOT_MODE: number;
    SIMPLE_MODE: number;
    LABEL_MODE: number;
  };
}

/**
 * 查询分页配置
 */
export interface QueryPaginationConfig {
  pageSize: number;
  maxPages: number;
  prefetchNext: boolean;
}

/**
 * Session 管理器配置
 */
export interface SessionManagerConfig {
  database?: string;
  defaultAccessMode?: 'READ' | 'WRITE';
  maxRetries?: number;
  retryDelay?: number;
}

// ============= 默认配置 =============

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 5 * 60 * 1000,  // 5分钟
  maxSize: 100
};

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enabled: true,
  enableCulling: true,
  enableLOD: true,
  enableIncrementalLoad: true,
  cullingPadding: 50,
  lodThresholds: {
    DOT_MODE: 0.3,
    SIMPLE_MODE: 0.6,
    LABEL_MODE: 1.0
  }
};

export const DEFAULT_QUERY_PAGINATION_CONFIG: QueryPaginationConfig = {
  pageSize: 100,
  maxPages: 10,
  prefetchNext: true
};

export const DEFAULT_SESSION_MANAGER_CONFIG: SessionManagerConfig = {
  maxRetries: 3,
  retryDelay: 1000
};
