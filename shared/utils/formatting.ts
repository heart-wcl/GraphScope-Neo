/**
 * 格式化工具 - DDD 架构共享层
 * 统一格式化逻辑
 */

import { isNeo4jInteger } from './typeGuards';

/**
 * 格式化值为 Cypher 查询格式
 */
export function formatValueForCypher(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  // 转义单引号
  const escaped = String(value).replace(/'/g, "\\'");
  return `'${escaped}'`;
}

/**
 * 格式化属性对象为 Cypher 格式
 */
export function formatPropertiesForCypher(props: Record<string, unknown>): string {
  if (!props || Object.keys(props).length === 0) return '{}';

  const parts = Object.entries(props)
    .map(([key, value]) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') return `${key}: '${value.replace(/'/g, "\\'")}'`;
      if (typeof value === 'number') return `${key}: ${value}`;
      if (typeof value === 'boolean') return `${key}: ${value}`;
      if (Array.isArray(value)) return `${key}: ${JSON.stringify(value)}`;
      return `${key}: ${JSON.stringify(value)}`;
    })
    .filter(Boolean);

  return `{${parts.join(', ')}}`;
}

/**
 * 格式化值为 CSV 格式
 */
export function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  // 如果包含逗号、引号或换行，需要用引号包裹并转义
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 转换 Neo4j 类型为 JavaScript 原生类型
 */
export function convertNeo4jTypes(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  // 处理 Neo4j Integer
  if (isNeo4jInteger(obj)) {
    return obj.toNumber();
  }

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(convertNeo4jTypes);
  }

  // 处理对象
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertNeo4jTypes(value);
    }
    return result;
  }

  return obj;
}

/**
 * 格式化字节大小
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 格式化数字（添加千位分隔符）
 */
export function formatNumber(num: number, locale = 'en-US'): string {
  return num.toLocaleString(locale);
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化持续时间（纳秒转为可读格式）
 */
export function formatDuration(nanoseconds: number): string {
  if (nanoseconds < 1000) {
    return `${nanoseconds}ns`;
  }
  if (nanoseconds < 1_000_000) {
    return `${(nanoseconds / 1000).toFixed(2)}µs`;
  }
  if (nanoseconds < 1_000_000_000) {
    return `${(nanoseconds / 1_000_000).toFixed(2)}ms`;
  }
  return `${(nanoseconds / 1_000_000_000).toFixed(2)}s`;
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * 转换为 kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * 转换为 camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^(.)/, (char) => char.toLowerCase());
}

/**
 * 安全获取 Neo4j 记录字段值
 */
export function safeGetField<T = unknown>(
  record: { keys?: string[]; get: (key: string) => unknown },
  key: string,
  defaultValue: T
): T {
  try {
    const keys = record.keys || [];
    if (keys.includes(key)) {
      const value = record.get(key);
      return (value ?? defaultValue) as T;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 转义标签/类型名称用于 Cypher
 */
export function escapeCypherIdentifier(identifier: string): string {
  // 如果包含特殊字符，需要用反引号包裹
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    return identifier;
  }
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/**
 * 格式化标签列表为 Cypher 格式
 */
export function formatLabels(labels: string[]): string {
  return labels.map(l => escapeCypherIdentifier(l)).join('|');
}

/**
 * 格式化属性列表为 Cypher 格式
 */
export function formatPropertyList(variable: string, properties: string[]): string {
  return properties.map(p => `${variable}.${escapeCypherIdentifier(p)}`).join(', ');
}
