/**
 * Neo4j Session 管理器 - DDD 架构基础设施层
 * 统一管理所有 Neo4j 数据库会话操作
 * 
 * 解决问题：项目中 78+ 处重复的 session 管理代码
 */

import { Driver, Session, ManagedTransaction } from 'neo4j-driver';
import { Result } from '../../../shared/types';
import { formatError } from '../../../shared/utils';

// Neo4j session.run 返回的查询结果类型
export interface QueryResult {
  records: any[];
  summary: any;
}

/**
 * Session 配置
 */
export interface SessionConfig {
  database?: string;
  defaultAccessMode?: 'READ' | 'WRITE';
}

/**
 * 事务配置
 */
export interface TransactionConfig extends SessionConfig {
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Neo4j Session 管理器
 * 
 * @example
 * ```typescript
 * const sessionManager = new Neo4jSessionManager(driver);
 * 
 * // 执行查询
 * const result = await sessionManager.run<GraphData>(
 *   'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT $limit',
 *   { limit: 100 },
 *   { database: 'neo4j' }
 * );
 * 
 * if (result.success) {
 *   console.log(result.data);
 * }
 * 
 * // 执行事务
 * const txResult = await sessionManager.executeTransaction(async (tx) => {
 *   await tx.run('CREATE (n:Person {name: $name})', { name: 'Alice' });
 *   return 'Node created';
 * });
 * ```
 */
export class Neo4jSessionManager {
  constructor(private driver: Driver) {}

  /**
   * 创建 Session
   */
  private createSession(config?: SessionConfig): Session {
    return this.driver.session(
      config?.database ? { database: config.database } : undefined
    );
  }

  /**
   * 执行查询并返回原始 Neo4j Result
   */
  async run(
    cypher: string,
    params?: Record<string, any>,
    config?: SessionConfig
  ): Promise<Result<QueryResult>> {
    const session = this.createSession(config);
    try {
      const result = await session.run(cypher, params);
      return Result.success(result as QueryResult);
    } catch (error) {
      return Result.fromError(error);
    } finally {
      await session.close();
    }
  }

  /**
   * 执行查询并使用映射函数处理结果
   */
  async runWithMapper<T>(
    cypher: string,
    params: Record<string, any> | undefined,
    mapper: (result: QueryResult) => T,
    config?: SessionConfig
  ): Promise<Result<T>> {
    const session = this.createSession(config);
    try {
      const result = await session.run(cypher, params);
      const mappedData = mapper(result as QueryResult);
      return Result.success(mappedData);
    } catch (error) {
      return Result.fromError(error);
    } finally {
      await session.close();
    }
  }

  /**
   * 执行只读操作
   */
  async executeRead<T>(
    work: (session: Session) => Promise<T>,
    config?: SessionConfig
  ): Promise<Result<T>> {
    return this.executeWithSession(work, config);
  }

  /**
   * 执行写入操作
   */
  async executeWrite<T>(
    work: (session: Session) => Promise<T>,
    config?: SessionConfig
  ): Promise<Result<T>> {
    return this.executeWithSession(work, config);
  }

  /**
   * 执行事务
   */
  async executeTransaction<T>(
    work: (tx: ManagedTransaction) => Promise<T>,
    config?: TransactionConfig
  ): Promise<Result<T>> {
    const session = this.createSession(config);
    try {
      const result = await session.executeWrite(work);
      return Result.success(result);
    } catch (error) {
      return Result.fromError(error);
    } finally {
      await session.close();
    }
  }

  /**
   * 执行只读事务
   */
  async executeReadTransaction<T>(
    work: (tx: ManagedTransaction) => Promise<T>,
    config?: SessionConfig
  ): Promise<Result<T>> {
    const session = this.createSession(config);
    try {
      const result = await session.executeRead(work);
      return Result.success(result);
    } catch (error) {
      return Result.fromError(error);
    } finally {
      await session.close();
    }
  }

  /**
   * 批量执行多个查询（在同一事务中）
   */
  async runBatch(
    queries: Array<{ cypher: string; params?: Record<string, any> }>,
    config?: SessionConfig
  ): Promise<Result<QueryResult[]>> {
    const session = this.createSession(config);
    try {
      const results = await session.executeWrite(async (tx) => {
        const txResults: QueryResult[] = [];
        for (const query of queries) {
          const result = await tx.run(query.cypher, query.params);
          txResults.push(result as QueryResult);
        }
        return txResults;
      });
      return Result.success(results);
    } catch (error) {
      return Result.fromError(error);
    } finally {
      await session.close();
    }
  }

  /**
   * 验证连接
   */
  async verifyConnectivity(): Promise<Result<boolean>> {
    try {
      await this.driver.verifyConnectivity();
      return Result.success(true);
    } catch (error) {
      return Result.fromError(error);
    }
  }

  /**
   * 执行带 Session 的操作（内部方法）
   */
  private async executeWithSession<T>(
    work: (session: Session) => Promise<T>,
    config?: SessionConfig
  ): Promise<Result<T>> {
    const session = this.createSession(config);
    try {
      const result = await work(session);
      return Result.success(result);
    } catch (error) {
      return Result.fromError(error);
    } finally {
      await session.close();
    }
  }

  /**
   * 带重试的执行
   */
  async runWithRetry(
    cypher: string,
    params?: Record<string, any>,
    config?: TransactionConfig
  ): Promise<Result<QueryResult>> {
    const maxRetries = config?.maxRetries ?? 3;
    const retryDelay = config?.retryDelay ?? 1000;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.run(cypher, params, config);
      if (result.success) {
        return result;
      }

      lastError = result.error;
      
      // 检查是否为可重试错误
      if (!this.isRetryableError(result.error)) {
        return result;
      }

      if (attempt < maxRetries) {
        await this.delay(retryDelay * attempt);
      }
    }

    return Result.failure(formatError(lastError));
  }

  /**
   * 检查是否为可重试错误
   */
  private isRetryableError(error: string | undefined): boolean {
    if (!error) return false;
    const retryableErrors = [
      'connection',
      'timeout',
      'transient',
      'deadlock',
      'leader'
    ];
    const lowerError = error.toLowerCase();
    return retryableErrors.some(keyword => lowerError.includes(keyword));
  }

  /**
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建 Session 管理器实例
 */
export function createSessionManager(driver: Driver): Neo4jSessionManager {
  return new Neo4jSessionManager(driver);
}
