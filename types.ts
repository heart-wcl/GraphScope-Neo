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
  color?: string; // For visualization
  radius?: number; // For visualization
}

export interface Neo4jRelationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, any>;
  source?: Neo4jNode | string; // D3 requires object reference or ID
  target?: Neo4jNode | string;
}

export interface GraphData {
  nodes: Neo4jNode[];
  links: Neo4jRelationship[];
}

export interface ConnectionConfig {
  name: string;
  protocol: 'bolt' | 'neo4j' | 'neo4j+s' | 'bolt+s' | 'http' | 'https' | 'demo';
  host: string;
  port: string;
  username: string;
  password: string;
  database?: string;
}

export interface Session {
  id: string;
  config: ConnectionConfig;
}

 // Execution plan operator type
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

 // Execution plan result
 export interface ExecutionPlan {
   root: PlanOperator;
   mode: 'explain' | 'profile';
   metrics?: {
     totalTime: number; // nanoseconds
     totalDbHits: number;
     totalMemory: number; // bytes
     totalRows: number;
     pageCacheHitRatio?: number;
   };
 }

 export type ViewMode = 'graph' | 'table' | 'json' | 'plan';

 export type { Driver } from 'neo4j-driver';

 // Type guard for plan result
 export function isExecutionPlan(result: any): result is ExecutionPlan {
   return result && typeof result === 'object' && 'root' in result && 'mode' in result;
 }

 // Performance monitoring types
 export interface PerformanceMetrics {
   fps: number;
   renderTime: number;
   memory: number;
   visibleNodes: number;
   visibleLinks: number;
   totalNodes: number;
   totalLinks: number;
   cullRate: number; // 裁剪率 (0-1)
 }

 export interface PerformanceConfig {
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

 // Cache configuration
 export interface CacheConfig {
   enabled: boolean;
   ttl: number; // 毫秒
   maxSize: number; // 最大缓存条目数
 }

 export const DEFAULT_CACHE_CONFIG: CacheConfig = {
   enabled: true,
   ttl: 5 * 60 * 1000, // 5分钟
   maxSize: 100
 };