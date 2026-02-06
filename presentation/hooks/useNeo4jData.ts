/**
 * useNeo4jData Hook - DDD 架构表现层
 * 统一管理从 Neo4j 加载数据的逻辑
 * 
 * 解决问题：多个组件中重复的数据加载和刷新逻辑
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Driver } from 'neo4j-driver';
import { AsyncState } from '../../shared/types';
import { formatError } from '../../shared/utils';

/**
 * Neo4j 数据加载配置
 */
export interface UseNeo4jDataOptions<T> {
  /** 是否自动加载 */
  autoLoad?: boolean;
  /** 依赖项（变化时重新加载） */
  deps?: any[];
  /** 初始数据 */
  initialData?: T | null;
  /** 成功回调 */
  onSuccess?: (data: T) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
  /** 加载开始回调 */
  onLoadStart?: () => void;
  /** 加载结束回调 */
  onLoadEnd?: () => void;
  /** 轮询间隔（毫秒，0 表示不轮询） */
  pollingInterval?: number;
  /** 是否在 driver 为空时跳过加载 */
  skipWhenNoDriver?: boolean;
}

/**
 * Neo4j 数据 Hook 返回值
 */
export interface UseNeo4jDataResult<T> {
  /** 数据 */
  data: T | null;
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 手动加载/刷新数据 */
  load: () => Promise<void>;
  /** 刷新数据（load 的别名） */
  refresh: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
  /** 手动设置数据 */
  setData: (data: T | null) => void;
  /** 清除错误 */
  clearError: () => void;
  /** 是否已初始化加载 */
  isInitialized: boolean;
}

/**
 * Neo4j 数据加载 Hook
 * 
 * @example
 * ```tsx
 * const { data: schema, loading, error, refresh } = useNeo4jData(
 *   driver,
 *   database,
 *   async (driver, database) => {
 *     return await getSchemaInfo(driver, database);
 *   },
 *   {
 *     autoLoad: true,
 *     onSuccess: (schema) => console.log('Schema loaded:', schema)
 *   }
 * );
 * 
 * if (loading) return <LoadingSpinner />;
 * if (error) return <ErrorAlert message={error} />;
 * 
 * return (
 *   <div>
 *     <button onClick={refresh}>Refresh</button>
 *     <SchemaDisplay schema={schema} />
 *   </div>
 * );
 * ```
 */
export function useNeo4jData<T>(
  driver: Driver | null,
  database: string | undefined,
  fetcher: (driver: Driver, database: string | undefined) => Promise<T>,
  options: UseNeo4jDataOptions<T> = {}
): UseNeo4jDataResult<T> {
  const {
    autoLoad = true,
    deps = [],
    initialData = null,
    onSuccess,
    onError,
    onLoadStart,
    onLoadEnd,
    pollingInterval = 0,
    skipWhenNoDriver = true
  } = options;

  const [state, setState] = useState<AsyncState<T> & { isInitialized: boolean }>({
    data: initialData,
    loading: false,
    error: null,
    isInitialized: false
  });

  const mountedRef = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    if (skipWhenNoDriver && !driver) {
      return;
    }

    if (!driver) {
      setState(prev => ({
        ...prev,
        error: 'No database driver available',
        loading: false
      }));
      return;
    }

    onLoadStart?.();
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await fetcher(driver, database);

      if (!mountedRef.current) return;

      setState({
        data: result,
        loading: false,
        error: null,
        isInitialized: true
      });
      onSuccess?.(result);
    } catch (err) {
      if (!mountedRef.current) return;

      const errorMessage = formatError(err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        isInitialized: true
      }));
      onError?.(errorMessage);
    } finally {
      onLoadEnd?.();
    }
  }, [driver, database, fetcher, onSuccess, onError, onLoadStart, onLoadEnd, skipWhenNoDriver]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null,
      isInitialized: false
    });
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 自动加载
  useEffect(() => {
    if (autoLoad) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver, database, ...deps]);

  // 轮询
  useEffect(() => {
    if (pollingInterval > 0 && driver) {
      pollingRef.current = setInterval(load, pollingInterval);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [pollingInterval, driver, load]);

  // 组件卸载
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    load,
    refresh: load,
    reset,
    setData,
    clearError,
    isInitialized: state.isInitialized
  };
}

/**
 * 多数据源加载 Hook
 * 
 * @example
 * ```tsx
 * const { data, loading, error } = useNeo4jMultiData(
 *   driver,
 *   database,
 *   {
 *     labels: (driver, db) => getLabels(driver, db),
 *     relationships: (driver, db) => getRelationshipTypes(driver, db),
 *     constraints: (driver, db) => getConstraints(driver, db)
 *   }
 * );
 * 
 * if (loading) return <LoadingSpinner />;
 * 
 * return (
 *   <div>
 *     <LabelsList labels={data.labels} />
 *     <RelationshipsList relationships={data.relationships} />
 *   </div>
 * );
 * ```
 */
export function useNeo4jMultiData<T extends Record<string, any>>(
  driver: Driver | null,
  database: string | undefined,
  fetchers: { [K in keyof T]: (driver: Driver, database: string | undefined) => Promise<T[K]> },
  options: Omit<UseNeo4jDataOptions<T>, 'initialData'> = {}
): UseNeo4jDataResult<T> {
  const combinedFetcher = useCallback(async (drv: Driver, db: string | undefined): Promise<T> => {
    const entries = Object.entries(fetchers);
    const results = await Promise.all(
      entries.map(async ([key, fetcher]) => {
        const result = await fetcher(drv, db);
        return [key, result] as const;
      })
    );
    return Object.fromEntries(results) as T;
  }, [fetchers]);

  return useNeo4jData(driver, database, combinedFetcher, {
    ...options,
    initialData: null
  });
}

export default useNeo4jData;
