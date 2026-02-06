/**
 * 核心类型定义 - DDD 架构共享层
 * Neo4j 图数据库相关的核心类型
 */

/**
 * Neo4j 节点
 */
export interface Neo4jNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  color?: string;
  radius?: number;
}

/**
 * Neo4j 关系
 */
export interface Neo4jRelationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, any>;
  source?: Neo4jNode | string;
  target?: Neo4jNode | string;
}

/**
 * 图数据
 */
export interface GraphData {
  nodes: Neo4jNode[];
  links: Neo4jRelationship[];
}

/**
 * Schema 节点标签信息
 */
export interface NodeLabel {
  label: string;
  count: number;
  properties: string[];
}

/**
 * Schema 关系类型信息
 */
export interface RelationshipType {
  type: string;
  count: number;
  properties: string[];
  fromLabels: string[];
  toLabels: string[];
}

/**
 * Schema 信息
 */
export interface SchemaInfo {
  labels: NodeLabel[];
  relationships: RelationshipType[];
}

/**
 * 执行计划操作符
 */
export interface PlanOperator {
  operatorType: string;
  identifiers: string[];
  arguments: {
    [key: string]: string | number | undefined;
    'string-representation'?: string;
    'planner'?: string;
    'runtime'?: string;
    'EstimatedRows'?: number;
    'Id'?: number;
    'Details'?: string;
    'Memory'?: number;
    'DbHits'?: number;
    'Rows'?: number;
    'Time'?: number;
    'Pipeline'?: string;
  };
  children: PlanOperator[];
}

/**
 * 执行计划结果
 */
export interface ExecutionPlan {
  root: PlanOperator;
  mode: 'explain' | 'profile';
  metrics?: {
    totalTime: number;
    totalDbHits: number;
    totalMemory: number;
    totalRows: number;
    pageCacheHitRatio?: number;
  };
}

/**
 * 性能监控指标
 */
export interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memory: number;
  visibleNodes: number;
  visibleLinks: number;
  totalNodes: number;
  totalLinks: number;
  cullRate: number;
}

/**
 * 视图模式
 */
export type ViewMode = 'graph' | 'table' | 'json' | 'plan';

/**
 * 约束类型
 */
export interface Constraint {
  name: string;
  type: string;
  entityType: 'NODE' | 'RELATIONSHIP';
  labelsOrTypes: string[];
  properties: string[];
  ownedIndex?: string;
}

/**
 * 全文索引
 */
export interface FulltextIndex {
  name: string;
  labels: string[];
  properties: string[];
  analyzer?: string;
}

/**
 * 数据库信息
 */
export interface DatabaseInfo {
  name: string;
  address: string;
  role: string;
  status: string;
  default: boolean;
  home: boolean;
}
