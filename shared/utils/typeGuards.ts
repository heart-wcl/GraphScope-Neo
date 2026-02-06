/**
 * 类型守卫函数 - DDD 架构共享层
 * 统一类型检查逻辑
 */

import type {
  Neo4jNode,
  Neo4jRelationship,
  GraphData,
  ExecutionPlan,
  Constraint,
  FulltextIndex,
  DatabaseInfo
} from '../types';

/**
 * 检查是否为 Neo4j 节点
 */
export function isNeo4jNode(value: unknown): value is Neo4jNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    'labels' in value &&
    Array.isArray((value as Neo4jNode).labels)
  );
}

/**
 * 检查是否为 Neo4j 关系
 */
export function isNeo4jRelationship(value: unknown): value is Neo4jRelationship {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    'type' in value &&
    'startNode' in value &&
    'endNode' in value
  );
}

/**
 * 检查是否为图数据
 */
export function isGraphData(value: unknown): value is GraphData {
  return (
    value !== null &&
    typeof value === 'object' &&
    'nodes' in value &&
    'links' in value &&
    Array.isArray((value as GraphData).nodes) &&
    Array.isArray((value as GraphData).links)
  );
}

/**
 * 检查是否为执行计划
 */
export function isExecutionPlan(value: unknown): value is ExecutionPlan {
  return (
    value !== null &&
    typeof value === 'object' &&
    'root' in value &&
    'mode' in value
  );
}

/**
 * 检查是否为表格结果
 */
export function isTabularResult(value: unknown): value is { columns: string[]; rows: any[] } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'columns' in value &&
    'rows' in value &&
    Array.isArray((value as { columns: string[]; rows: any[] }).columns) &&
    Array.isArray((value as { columns: string[]; rows: any[] }).rows)
  );
}

/**
 * 检查是否为约束对象
 */
export function isConstraint(value: unknown): value is Constraint {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'type' in value &&
    'entityType' in value
  );
}

/**
 * 检查是否为全文索引
 */
export function isFulltextIndex(value: unknown): value is FulltextIndex {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'labels' in value &&
    'properties' in value &&
    Array.isArray((value as FulltextIndex).labels) &&
    Array.isArray((value as FulltextIndex).properties)
  );
}

/**
 * 检查是否为数据库信息
 */
export function isDatabaseInfo(value: unknown): value is DatabaseInfo {
  return (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'status' in value
  );
}

/**
 * 检查是否为 Neo4j Integer 对象
 */
export function isNeo4jInteger(value: unknown): value is { toNumber: () => number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: unknown }).toNumber === 'function'
  );
}

/**
 * 检查是否为 Neo4j 路径对象
 */
export function isNeo4jPath(value: unknown): value is { segments: any[]; start: any; end: any } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'segments' in value &&
    Array.isArray((value as { segments: unknown }).segments)
  );
}

/**
 * 检查值是否为空（null, undefined, 空字符串, 空数组, 空对象）
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 确保值不为 null 或 undefined
 */
export function assertNonNull<T>(
  value: T | null | undefined,
  message = 'Value is null or undefined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}
