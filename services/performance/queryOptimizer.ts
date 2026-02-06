/**
 * Query Optimizer Service
 * 查询优化 - 分页、属性投影、索引建议
 */

import type { Driver } from 'neo4j-driver';
import type { Neo4jNode, Neo4jRelationship } from '../neo4j';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextSkip?: number;
}

export interface QueryPaginationConfig {
  limit: number;
  skip: number;
  projection?: string[]; // 要返回的属性列表
}

export interface IndexInfo {
  label: string;
  properties: string[];
  type: 'PROPERTY' | 'FULLTEXT' | 'LOOKUP' | 'UNIQUE' | 'EXISTENCE';
  state: 'ONLINE' | 'POPULATING' | 'FAILED';
  populationPercent?: number;
}

export const DEFAULT_PAGINATION_CONFIG: QueryPaginationConfig = {
  limit: 100,
  skip: 0
};

/**
 * 执行分页查询
 */
export async function executePaginatedQuery(
  driver: Driver,
  query: string,
  params: Record<string, any> = {},
  config: QueryPaginationConfig = DEFAULT_PAGINATION_CONFIG,
  database?: string
): Promise<PaginatedResult<any[]>> {
  const session = driver.session(database ? { database } : undefined);

  try {
    // 获取总数 - 将 RETURN 子句替换为 RETURN count(*)
    // 移除原查询中的 LIMIT/SKIP/ORDER BY 子句
    const baseQuery = query
      .replace(/\s+LIMIT\s+\d+/gi, '')
      .replace(/\s+SKIP\s+\d+/gi, '')
      .replace(/\s+ORDER\s+BY\s+[^]+?(?=\s+LIMIT|\s+SKIP|$)/gi, '');
    
    // 将 RETURN xxx 替换为 RETURN count(*) as total
    const countQuery = baseQuery.replace(
      /RETURN\s+.+$/i,
      'RETURN count(*) AS total'
    );
    
    let total = 0;
    try {
      const countResult = await session.run(countQuery, params);
      total = countResult.records[0]?.get('total')?.toNumber() || 0;
    } catch (countError) {
      // 如果计数查询失败，继续执行但不提供总数
      console.warn('[executePaginatedQuery] Count query failed:', countError);
    }

    // 执行分页查询
    const skipClause = config.skip > 0 ? ` SKIP ${config.skip}` : '';
    const limitClause = ` LIMIT ${config.limit}`;
    const paginatedQuery = `${baseQuery}${skipClause}${limitClause}`;

    const result = await session.run(paginatedQuery, params);
    const data = result.records.map(record => record.toObject());

    return {
      data,
      total,
      hasMore: total > 0 ? config.skip + config.limit < total : data.length === config.limit,
      nextSkip: config.skip + config.limit < total ? config.skip + config.limit : undefined
    };
  } finally {
    await session.close();
  }
}

/**
 * 应用属性投影到查询
 */
export function applyProjection(
  query: string,
  projection: Record<string, string[]>
): string {
  // 匹配 RETURN 子句
  const returnRegex = /RETURN\s+(.+?)(?:\s+LIMIT|\s+ORDER|\s+SKIP|$)/is;
  const match = query.match(returnRegex);

  if (!match) return query;

  const returnClause = match[1].trim();
  const projectedReturn = returnClause.replace(/\b(n|m|r|node|rel|relationship)\b/g, (match) => {
    const variable = match.toLowerCase();
    if (projection[variable]) {
      const props = projection[variable].map(p => `${variable}.${p}`);
      return `{${props.join(', ')}} AS ${variable}`;
    }
    return match;
  });

  return query.replace(returnRegex, `RETURN ${projectedReturn}`);
}

/**
 * 生成优化的查询（只返回必需属性）
 */
export function generateOptimizedQuery(
  baseQuery: string,
  requiredProperties: {
    nodes?: Record<string, string[]>; // { n: ['id', 'name'] }
    relationships?: Record<string, string[]>; // { r: ['type', 'properties'] }
  }
): string {
  if (!Object.keys(requiredProperties).length) return baseQuery;

  return applyProjection(baseQuery, {
    ...(requiredProperties.nodes || {}),
    ...(requiredProperties.relationships || {})
  });
}

/**
 * 获取索引列表
 */
export async function getIndexes(
  driver: Driver,
  database?: string
): Promise<IndexInfo[]> {
  const session = driver.session(database ? { database } : undefined);

  try {
    const result = await session.run(`
      CALL db.indexes() YIELD
        labelOrType,
        properties,
        type,
        state,
        populationPercent
      RETURN {
        label: labelOrType,
        properties: properties,
        type: type,
        state: state,
        populationPercent: populationPercent
      } as info
    `);

    return result.records.map(record => {
      const info = record.get('info');
      return {
        label: info.label,
        properties: info.properties || [],
        type: info.type,
        state: info.state,
        populationPercent: info.populationPercent
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * 建议缺失的索引（基于常用查询模式）
 */
export function suggestIndexes(
  schema: {
    labels: { label: string; count: number }[];
    relationships: { type: string; count: number }[];
  }
): string[] {
  const suggestions: string[] = [];

  // 为高频查询的标签建议索引
  schema.labels
    .filter(l => l.count > 1000)
    .forEach(l => {
      suggestions.push(
        `CREATE INDEX ${l.label.toLowerCase()}_id_index FOR (n:${l.label}) ON (n.id)`
      );
    });

  // 为高频查询的关系类型建议索引
  schema.relationships
    .filter(r => r.count > 1000)
    .forEach(r => {
      suggestions.push(
        `CREATE INDEX ${r.type.toLowerCase()}_type_index FOR ()-[r:${r.type}]->() ON (r.type)`
      );
    });

  return suggestions;
}

/**
 * 创建索引
 */
export async function createIndex(
  driver: Driver,
  label: string,
  properties: string[],
  type: 'PROPERTY' | 'UNIQUE' | 'EXISTENCE' = 'PROPERTY',
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);

  try {
    let query: string;

    if (type === 'UNIQUE') {
      query = `CREATE CONSTRAINT FOR (n:${label}) REQUIRE n.${properties[0]} IS UNIQUE`;
    } else if (type === 'EXISTENCE') {
      query = `CREATE CONSTRAINT FOR (n:${label}) REQUIRE n.${properties[0]} IS NOT NULL`;
    } else {
      const indexName = `${label.toLowerCase()}_${properties.join('_')}_index`;
      const props = properties.map(p => `n.${p}`).join(', ');
      query = `CREATE INDEX ${indexName} FOR (n:${label}) ON (${props})`;
    }

    await session.run(query);
  } finally {
    await session.close();
  }
}

/**
 * 分析查询性能（获取执行计划）
 */
export async function analyzeQueryPerformance(
  driver: Driver,
  query: string,
  params: Record<string, any> = {},
  database?: string
): Promise<{
  plan: any;
  estimatedRows: number;
  dbHits?: number;
  warnings: string[];
}> {
  const session = driver.session(database ? { database } : undefined);

  try {
    const result = await session.run(`EXPLAIN ${query}`, params);
    const summary = result.summary;
    const plan = summary.plan;

    // 提取估计行数
    const estimatedRows = plan?.arguments?.EstimatedRows || 0;

    // 生成性能警告
    const warnings: string[] = [];

    // 检查全节点扫描
    const hasAllNodesScan = plan?.operatorType?.toLowerCase().includes('allnodesscan');
    if (hasAllNodesScan) {
      warnings.push('检测到全节点扫描，建议添加索引');
    }

    // 检查 EAGER 操作
    const hasEager = JSON.stringify(plan).toLowerCase().includes('eager');
    if (hasEager) {
      warnings.push('检测到 EAGER 操作符，可能导致内存消耗增加');
    }

    // 检查笛卡尔积
    const hasCartesianProduct = plan?.operatorType?.toLowerCase().includes('cartesianproduct');
    if (hasCartesianProduct) {
      warnings.push('检测到笛卡尔积，建议添加 WHERE 条件或优化查询');
    }

    return {
      plan,
      estimatedRows,
      warnings
    };
  } finally {
    await session.close();
  }
}

/**
 * 批量查询优化（合并多个小查询）
 */
export async function executeBatchQueries(
  driver: Driver,
  queries: Array<{ query: string; params?: Record<string, any> }>,
  database?: string
): Promise<any[]> {
  const session = driver.session(database ? { database } : undefined);

  try {
    const results: any[] = [];

    for (const { query, params = {} } of queries) {
      const result = await session.run(query, params);
      results.push(result.records.map(r => r.toObject()));
    }

    return results;
  } finally {
    await session.close();
  }
}

/**
 * 使用 UNION ALL 合并多个查询结果
 */
export function unionQueries(...queries: string[]): string {
  return queries.join(' UNION ALL ');
}
