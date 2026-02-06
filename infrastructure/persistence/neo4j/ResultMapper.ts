/**
 * 结果映射器 - DDD 架构基础设施层
 * 统一处理 Neo4j 查询结果的转换逻辑
 * 
 * 解决问题：多处重复的图数据提取和转换代码
 */

import {
  Neo4jNode,
  Neo4jRelationship,
  GraphData,
  ExecutionPlan,
  PlanOperator
} from '../../../shared/types';
import {
  generateColor,
  convertNeo4jTypes,
  isNeo4jInteger,
  isNeo4jPath
} from '../../../shared/utils';
import { QueryResult } from './Neo4jSessionManager';

/**
 * 结果映射器
 * 
 * @example
 * ```typescript
 * const mapper = new ResultMapper();
 * 
 * // 从查询结果提取图数据
 * const graphData = mapper.toGraphData(neo4jResult);
 * 
 * // 转换为表格数据
 * const tableData = mapper.toTableData(neo4jResult);
 * ```
 */
export class ResultMapper {
  private nodesMap = new Map<string, Neo4jNode>();
  private linksMap = new Map<string, Neo4jRelationship>();
  private internalIdToNodeId = new Map<string, string>();

  /**
   * 从 Neo4j Result 提取图数据
   */
  toGraphData(result: QueryResult): GraphData {
    this.reset();

    // 检查是否有图数据
    const hasGraphData = result.records.some((record: any) =>
      record.keys.some((key: string) => {
        const value = record.get(key);
        return this.isNodeValue(value) || this.isRelationshipValue(value) || isNeo4jPath(value);
      })
    );

    if (!hasGraphData) {
      return { nodes: [], links: [] };
    }

    // 第一遍：收集所有节点
    result.records.forEach((record: any) => {
      record.keys.forEach((key: string) => {
        const value = record.get(key);
        this.collectNodes(value);
      });
    });

    // 第二遍：处理所有关系
    result.records.forEach((record: any) => {
      record.keys.forEach((key: string) => {
        const value = record.get(key);
        this.processRelationship(value);
      });
    });

    return {
      nodes: Array.from(this.nodesMap.values()),
      links: Array.from(this.linksMap.values())
    };
  }

  /**
   * 从 Neo4j Result 提取表格数据
   */
  toTableData(result: QueryResult): { columns: string[]; rows: any[][] } {
    const columns = result.records[0]?.keys?.map(String) || [];
    const rows = result.records.map((record: any) =>
      columns.map((col: string) => {
        const value = record.get(col);
        return convertNeo4jTypes(value);
      })
    );
    return { columns, rows };
  }

  /**
   * 从 Neo4j Result 提取执行计划
   */
  toExecutionPlan(result: QueryResult): ExecutionPlan | null {
    const summary = result.summary;
    if (!summary) return null;

    // 检查是否有 profile 或 plan
    const hasProfile = summary.profile != null;
    const hasPlan = summary.plan != null;
    
    const plan = hasProfile ? summary.profile : hasPlan ? summary.plan : null;

    if (!plan) return null;

    const mode = hasProfile ? 'profile' : 'explain';
    const root = this.convertPlanOperator(plan);

    let metrics;
    if (hasProfile && summary.profile) {
      metrics = this.calculatePlanMetrics(summary.profile);
    }

    return { root, mode, metrics };
  }

  /**
   * 检查结果是否包含图数据
   */
  hasGraphData(result: QueryResult): boolean {
    return result.records.some((record: any) =>
      record.keys.some((key: string) => {
        const value = record.get(key);
        return this.isNodeValue(value) || this.isRelationshipValue(value);
      })
    );
  }

  /**
   * 检查结果是否为执行计划
   */
  isExecutionPlanResult(result: QueryResult): boolean {
    const summary = result.summary;
    return summary?.plan != null || summary?.profile != null;
  }

  /**
   * 重置内部状态
   */
  reset(): void {
    this.nodesMap.clear();
    this.linksMap.clear();
    this.internalIdToNodeId.clear();
  }

  // ============= 私有方法 =============

  /**
   * 收集节点
   */
  private collectNodes(value: any): void {
    if (value === null || value === undefined) return;

    // 处理节点
    if (this.isNodeValue(value)) {
      const internalId = value.identity.toString();
      const displayId = internalId;

      if (!this.nodesMap.has(displayId)) {
        const label = value.labels[0] || 'Node';
        this.nodesMap.set(displayId, {
          id: displayId,
          labels: value.labels,
          properties: value.properties,
          color: generateColor(label),
          radius: 20 + (Object.keys(value.properties).length * 1.5)
        });
        this.internalIdToNodeId.set(internalId, displayId);
      }
      return;
    }

    // 处理路径
    if (isNeo4jPath(value)) {
      this.collectNodes(value.start);
      value.segments.forEach((segment: any) => {
        this.collectNodes(segment.start);
        this.collectNodes(segment.end);
      });
      return;
    }

    // 处理数组
    if (Array.isArray(value)) {
      value.forEach(item => this.collectNodes(item));
      return;
    }

    // 处理对象（跳过 Neo4j Integer）
    if (typeof value === 'object') {
      if (isNeo4jInteger(value)) return;
      Object.values(value).forEach(v => this.collectNodes(v));
    }
  }

  /**
   * 处理关系
   */
  private processRelationship(value: any): void {
    if (value === null || value === undefined) return;

    // 处理关系
    if (this.isRelationshipValue(value)) {
      const relInternalId = value.identity.toString();
      if (!this.linksMap.has(relInternalId)) {
        const startInternalId = this.toNumberString(value.start);
        const endInternalId = this.toNumberString(value.end);

        const startNodeId = this.internalIdToNodeId.get(startInternalId) || startInternalId;
        const endNodeId = this.internalIdToNodeId.get(endInternalId) || endInternalId;

        this.linksMap.set(relInternalId, {
          id: relInternalId,
          type: value.type,
          startNode: startNodeId,
          endNode: endNodeId,
          source: startNodeId,
          target: endNodeId,
          properties: value.properties
        });
      }
      return;
    }

    // 处理路径
    if (isNeo4jPath(value)) {
      value.segments.forEach((segment: any) => {
        this.processRelationship(segment.relationship);
      });
      return;
    }

    // 处理数组
    if (Array.isArray(value)) {
      value.forEach(item => this.processRelationship(item));
      return;
    }

    // 处理对象（跳过 Neo4j Integer）
    if (typeof value === 'object') {
      if (isNeo4jInteger(value)) return;
      Object.values(value).forEach(v => this.processRelationship(v));
    }
  }

  /**
   * 检查是否为节点值
   */
  private isNodeValue(value: any): boolean {
    return value && typeof value === 'object' && value.labels && value.identity;
  }

  /**
   * 检查是否为关系值
   */
  private isRelationshipValue(value: any): boolean {
    return value && 
           typeof value === 'object' && 
           value.type && 
           typeof value.start !== 'undefined' && 
           typeof value.end !== 'undefined' &&
           value.identity;
  }

  /**
   * 转换为数字字符串
   */
  private toNumberString(value: any): string {
    if (isNeo4jInteger(value)) {
      return value.toNumber().toString();
    }
    return String(value);
  }

  /**
   * 转换执行计划操作符
   */
  private convertPlanOperator(plan: any): PlanOperator {
    return {
      operatorType: plan.operatorType,
      identifiers: plan.identifiers || [],
      arguments: plan.arguments || {},
      children: (plan.children || []).map((child: any) => this.convertPlanOperator(child))
    };
  }

  /**
   * 计算执行计划指标
   */
  private calculatePlanMetrics(profile: any): ExecutionPlan['metrics'] {
    const calculate = (op: any): { totalTime: number; totalDbHits: number; totalMemory: number; totalRows: number } => {
      const childrenMetrics = (op.children || []).reduce((acc: any, child: any) => {
        const childMetrics = calculate(child);
        acc.totalTime += childMetrics.totalTime;
        acc.totalDbHits += childMetrics.totalDbHits;
        acc.totalMemory += childMetrics.totalMemory;
        acc.totalRows += childMetrics.totalRows;
        return acc;
      }, { totalTime: 0, totalDbHits: 0, totalMemory: 0, totalRows: 0 });

      return {
        totalTime: childrenMetrics.totalTime + (op.time || 0),
        totalDbHits: childrenMetrics.totalDbHits + (op.dbHits || 0),
        totalMemory: childrenMetrics.totalMemory + (op.memory || 0),
        totalRows: childrenMetrics.totalRows + (op.rows || 0)
      };
    };

    const metrics = calculate(profile);
    return {
      ...metrics,
      pageCacheHitRatio: profile.pageCacheHitRatio
    };
  }
}

/**
 * 创建结果映射器实例
 */
export function createResultMapper(): ResultMapper {
  return new ResultMapper();
}

/**
 * 快捷方法：直接转换结果为图数据
 */
export function resultToGraphData(result: QueryResult): GraphData {
  return new ResultMapper().toGraphData(result);
}

/**
 * 快捷方法：直接转换结果为表格数据
 */
export function resultToTableData(result: QueryResult): { columns: string[]; rows: any[][] } {
  return new ResultMapper().toTableData(result);
}
