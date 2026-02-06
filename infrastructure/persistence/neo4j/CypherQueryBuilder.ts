/**
 * Cypher 查询构建器 - DDD 架构基础设施层
 * 统一管理所有 Cypher 查询的构建逻辑
 * 
 * 解决问题：项目中 30+ 处重复的查询构建代码
 */

import { escapeCypherIdentifier, formatLabels, formatPropertyList } from '../../../shared/utils';

/**
 * 构建结果
 */
export interface BuildResult {
  query: string;
  params: Record<string, any>;
}

/**
 * Cypher 查询构建器
 * 
 * @example
 * ```typescript
 * const builder = new CypherQueryBuilder();
 * 
 * const { query, params } = builder
 *   .match('(n:Person)')
 *   .whereId('n', '123')
 *   .setProperty('n', 'name', 'Alice')
 *   .return('n')
 *   .build();
 * 
 * // 使用 SessionManager 执行
 * await sessionManager.run(query, params);
 * ```
 */
export class CypherQueryBuilder {
  private clauses: string[] = [];
  private params: Record<string, any> = {};
  private paramIndex = 0;

  /**
   * 添加参数并返回参数名
   */
  private addParam(value: any): string {
    const name = `p${this.paramIndex++}`;
    this.params[name] = value;
    return name;
  }

  /**
   * 转义属性键名
   */
  private escapeKey(key: string): string {
    return escapeCypherIdentifier(key);
  }

  // ============= MATCH 子句 =============

  /**
   * MATCH 子句
   */
  match(pattern: string): this {
    this.clauses.push(`MATCH ${pattern}`);
    return this;
  }

  /**
   * OPTIONAL MATCH 子句
   */
  optionalMatch(pattern: string): this {
    this.clauses.push(`OPTIONAL MATCH ${pattern}`);
    return this;
  }

  // ============= WHERE 子句 =============

  /**
   * WHERE 子句
   */
  where(condition: string): this {
    this.clauses.push(`WHERE ${condition}`);
    return this;
  }

  /**
   * WHERE 按 ID 匹配
   */
  whereId(variable: string, id: string | number): this {
    const numId = typeof id === 'string' ? parseInt(id) : id;
    const paramName = this.addParam(numId);
    this.clauses.push(`WHERE id(${variable}) = $${paramName}`);
    return this;
  }

  /**
   * WHERE 按 ID 列表匹配
   */
  whereIdIn(variable: string, ids: (string | number)[]): this {
    const numIds = ids.map(id => typeof id === 'string' ? parseInt(id) : id);
    const paramName = this.addParam(numIds);
    this.clauses.push(`WHERE id(${variable}) IN $${paramName}`);
    return this;
  }

  /**
   * AND 条件
   */
  and(condition: string): this {
    this.clauses.push(`AND ${condition}`);
    return this;
  }

  /**
   * AND 按 ID 匹配
   */
  andId(variable: string, id: string | number): this {
    const numId = typeof id === 'string' ? parseInt(id) : id;
    const paramName = this.addParam(numId);
    this.clauses.push(`AND id(${variable}) = $${paramName}`);
    return this;
  }

  /**
   * OR 条件
   */
  or(condition: string): this {
    this.clauses.push(`OR ${condition}`);
    return this;
  }

  // ============= CREATE 子句 =============

  /**
   * CREATE 节点
   */
  createNode(variable: string, label: string, properties?: Record<string, any>): this {
    const escapedLabel = this.escapeKey(label);
    if (properties && Object.keys(properties).length > 0) {
      const paramName = this.addParam(properties);
      this.clauses.push(`CREATE (${variable}:${escapedLabel} $${paramName})`);
    } else {
      this.clauses.push(`CREATE (${variable}:${escapedLabel})`);
    }
    return this;
  }

  /**
   * CREATE 关系
   */
  createRelationship(
    startVar: string,
    endVar: string,
    relVar: string,
    type: string,
    properties?: Record<string, any>
  ): this {
    const escapedType = this.escapeKey(type);
    if (properties && Object.keys(properties).length > 0) {
      const paramName = this.addParam(properties);
      this.clauses.push(
        `CREATE (${startVar})-[${relVar}:${escapedType} $${paramName}]->(${endVar})`
      );
    } else {
      this.clauses.push(`CREATE (${startVar})-[${relVar}:${escapedType}]->(${endVar})`);
    }
    return this;
  }

  /**
   * MERGE 子句
   */
  merge(pattern: string): this {
    this.clauses.push(`MERGE ${pattern}`);
    return this;
  }

  // ============= SET 子句 =============

  /**
   * SET 单个属性
   */
  setProperty(variable: string, key: string, value: any): this {
    const paramName = this.addParam(value);
    this.clauses.push(`SET ${variable}.${this.escapeKey(key)} = $${paramName}`);
    return this;
  }

  /**
   * SET 合并属性（使用 +=）
   */
  setProperties(variable: string, properties: Record<string, any>): this {
    const paramName = this.addParam(properties);
    this.clauses.push(`SET ${variable} += $${paramName}`);
    return this;
  }

  /**
   * SET 替换所有属性（使用 =）
   */
  replaceProperties(variable: string, properties: Record<string, any>): this {
    const paramName = this.addParam(properties);
    this.clauses.push(`SET ${variable} = $${paramName}`);
    return this;
  }

  // ============= DELETE 子句 =============

  /**
   * DELETE 子句
   */
  delete(...variables: string[]): this {
    this.clauses.push(`DELETE ${variables.join(', ')}`);
    return this;
  }

  /**
   * DETACH DELETE 子句
   */
  detachDelete(...variables: string[]): this {
    this.clauses.push(`DETACH DELETE ${variables.join(', ')}`);
    return this;
  }

  // ============= REMOVE 子句 =============

  /**
   * REMOVE 属性
   */
  removeProperty(variable: string, key: string): this {
    this.clauses.push(`REMOVE ${variable}.${this.escapeKey(key)}`);
    return this;
  }

  /**
   * REMOVE 标签
   */
  removeLabel(variable: string, label: string): this {
    this.clauses.push(`REMOVE ${variable}:${this.escapeKey(label)}`);
    return this;
  }

  // ============= RETURN 子句 =============

  /**
   * RETURN 子句
   */
  return(...expressions: string[]): this {
    this.clauses.push(`RETURN ${expressions.join(', ')}`);
    return this;
  }

  /**
   * RETURN DISTINCT 子句
   */
  returnDistinct(...expressions: string[]): this {
    this.clauses.push(`RETURN DISTINCT ${expressions.join(', ')}`);
    return this;
  }

  // ============= 修饰子句 =============

  /**
   * ORDER BY 子句
   */
  orderBy(expression: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.clauses.push(`ORDER BY ${expression} ${direction}`);
    return this;
  }

  /**
   * SKIP 子句
   */
  skip(count: number): this {
    if (count > 0) {
      this.clauses.push(`SKIP ${Math.floor(count)}`);
    }
    return this;
  }

  /**
   * LIMIT 子句
   */
  limit(count: number): this {
    this.clauses.push(`LIMIT ${Math.floor(count)}`);
    return this;
  }

  // ============= WITH 子句 =============

  /**
   * WITH 子句
   */
  with(...expressions: string[]): this {
    this.clauses.push(`WITH ${expressions.join(', ')}`);
    return this;
  }

  // ============= UNWIND 子句 =============

  /**
   * UNWIND 子句
   */
  unwind(expression: string, alias: string): this {
    this.clauses.push(`UNWIND ${expression} AS ${alias}`);
    return this;
  }

  // ============= CALL 子句 =============

  /**
   * CALL 过程
   */
  call(procedure: string, ...args: any[]): this {
    if (args.length > 0) {
      const paramNames = args.map(arg => {
        const name = this.addParam(arg);
        return `$${name}`;
      });
      this.clauses.push(`CALL ${procedure}(${paramNames.join(', ')})`);
    } else {
      this.clauses.push(`CALL ${procedure}()`);
    }
    return this;
  }

  /**
   * CALL { subquery } 子句
   */
  callSubquery(subquery: string): this {
    this.clauses.push(`CALL {\n  ${subquery}\n}`);
    return this;
  }

  /**
   * YIELD 子句
   */
  yield(...fields: string[]): this {
    this.clauses.push(`YIELD ${fields.join(', ')}`);
    return this;
  }

  // ============= 原始查询 =============

  /**
   * 添加原始 Cypher 子句
   */
  raw(cypher: string, params?: Record<string, any>): this {
    this.clauses.push(cypher);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        this.params[key] = value;
      });
    }
    return this;
  }

  /**
   * 添加参数（不添加子句）
   */
  param(name: string, value: any): this {
    this.params[name] = value;
    return this;
  }

  // ============= 构建 =============

  /**
   * 构建查询
   */
  build(): BuildResult {
    return {
      query: this.clauses.join('\n'),
      params: this.params
    };
  }

  /**
   * 重置构建器
   */
  reset(): this {
    this.clauses = [];
    this.params = {};
    this.paramIndex = 0;
    return this;
  }

  // ============= 静态工具方法 =============

  /**
   * 格式化标签列表
   */
  static formatLabels(labels: string[]): string {
    return formatLabels(labels);
  }

  /**
   * 格式化属性列表
   */
  static formatProperties(variable: string, properties: string[]): string {
    return formatPropertyList(variable, properties);
  }

  /**
   * 转义标识符
   */
  static escapeIdentifier(identifier: string): string {
    return escapeCypherIdentifier(identifier);
  }
}

/**
 * 创建新的查询构建器
 */
export function createQueryBuilder(): CypherQueryBuilder {
  return new CypherQueryBuilder();
}

/**
 * 快捷方法：构建简单的 MATCH-RETURN 查询
 */
export function buildMatchQuery(
  pattern: string,
  returnExpressions: string[],
  options?: {
    where?: string;
    orderBy?: { expression: string; direction?: 'ASC' | 'DESC' };
    skip?: number;
    limit?: number;
  }
): BuildResult {
  const builder = new CypherQueryBuilder().match(pattern);

  if (options?.where) {
    builder.where(options.where);
  }

  builder.return(...returnExpressions);

  if (options?.orderBy) {
    builder.orderBy(options.orderBy.expression, options.orderBy.direction);
  }

  if (options?.skip) {
    builder.skip(options.skip);
  }

  if (options?.limit) {
    builder.limit(options.limit);
  }

  return builder.build();
}
