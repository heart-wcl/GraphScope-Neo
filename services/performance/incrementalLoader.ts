/**
 * Incremental Loader Service
 * 增量加载 - 分批加载节点和关系
 */

import type { Driver } from 'neo4j-driver';
import type { Neo4jNode, Neo4jRelationship, GraphData } from '../neo4j';

export interface IncrementalLoaderConfig {
  batchSize: number; // 每批加载的数量
  preloadThreshold: number; // 预加载阈值（距离边缘多少节点时触发）
  maxBatches: number; // 最大批次数（限制总加载量）
}

export interface LoadProgress {
  loadedNodes: number;
  loadedLinks: number;
  totalNodes?: number;
  totalLinks?: number;
  progress: number; // 0-1
}

export const DEFAULT_INCREMENTAL_LOADER_CONFIG: IncrementalLoaderConfig = {
  batchSize: 50,
  preloadThreshold: 10,
  maxBatches: 20
};

/**
 * 增量加载器类
 */
export class IncrementalLoader {
  private driver: Driver;
  private config: IncrementalLoaderConfig;
  private loadedNodeIds: Set<string> = new Set();
  private loadedLinkIds: Set<string> = new Set();
  private batchCount: number = 0;
  private database?: string;

  constructor(
    driver: Driver,
    config: IncrementalLoaderConfig = DEFAULT_INCREMENTAL_LOADER_CONFIG,
    database?: string
  ) {
    this.driver = driver;
    this.config = config;
    this.database = database;
  }

  /**
   * 加载初始数据（核心节点）
   */
  async loadInitial(query: string, params: Record<string, any> = {}): Promise<GraphData> {
    this.clear();

    const session = this.driver.session(this.database ? { database: this.database } : undefined);

    try {
      const result = await session.run(query, params);
      const data = this.extractGraphData(result);

      this.updateCache(data);

      return data;
    } finally {
      await session.close();
    }
  }

  /**
   * 加载指定节点的邻节点
   */
  async loadNeighbors(nodeId: string): Promise<GraphData> {
    const session = this.driver.session(this.database ? { database: this.database } : undefined);

    try {
      // 查询邻节点
      const query = `
        MATCH (n)-[r]-(m)
        WHERE id(n) = $nodeId
        RETURN n, r, m
        LIMIT $limit
      `;

      const result = await session.run(query, {
        nodeId: parseInt(nodeId),
        limit: this.config.batchSize
      });

      const data = this.extractGraphData(result);

      // 分批加载
      return this.loadBatchedData(data);
    } finally {
      await session.close();
    }
  }

  /**
   * 扩展加载（从已有节点扩展到更多节点）
   */
  async expandFrontier(nodeIds: string[]): Promise<GraphData> {
    if (this.batchCount >= this.config.maxBatches) {
      return { nodes: [], links: [] };
    }

    const session = this.driver.session(this.database ? { database: this.database } : undefined);

    try {
      // 查询边界节点的邻居
      const query = `
        MATCH (n)-[r]-(m)
        WHERE id(n) IN $nodeIds
        RETURN n, r, m
        LIMIT $limit
      `;

      const result = await session.run(query, {
        nodeIds: nodeIds.map(id => parseInt(id)),
        limit: this.config.batchSize
      });

      const data = this.extractGraphData(result);

      return this.loadBatchedData(data);
    } finally {
      await session.close();
    }
  }

  /**
   * 加载特定标签的节点
   */
  async loadNodesByLabel(label: string, skip: number = 0): Promise<Neo4jNode[]> {
    const session = this.driver.session(this.database ? { database: this.database } : undefined);

    try {
      const query = `
        MATCH (n:${label})
        RETURN n
        SKIP $skip
        LIMIT $limit
      `;

      const result = await session.run(query, {
        skip,
        limit: this.config.batchSize
      });

      const nodes: Neo4jNode[] = [];

      result.records.forEach(record => {
        const node = record.get('n');
        const id = node.identity.toNumber().toString();
        
        if (!this.loadedNodeIds.has(id)) {
          nodes.push({
            id,
            labels: node.labels,
            properties: node.properties,
            color: this.getNodeColor(node.labels[0]),
            radius: 20 + Object.keys(node.properties).length * 1.5
          });
        }
      });

      nodes.forEach(n => this.loadedNodeIds.add(n.id));

      return nodes;
    } finally {
      await session.close();
    }
  }

  /**
   * 检查是否应该加载更多
   */
  shouldLoadMore(visibleNodeCount: number): boolean {
    return visibleNodeCount < this.config.preloadThreshold;
  }

  /**
   * 获取加载进度
   */
  getProgress(totalNodes?: number, totalLinks?: number): LoadProgress {
    const loadedNodes = this.loadedNodeIds.size;
    const loadedLinks = this.loadedLinkIds.size;

    let progress = 0;
    if (totalNodes) {
      progress = loadedNodes / totalNodes;
    }

    return {
      loadedNodes,
      loadedLinks,
      totalNodes,
      totalLinks,
      progress
    };
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.loadedNodeIds.clear();
    this.loadedLinkIds.clear();
    this.batchCount = 0;
  }

  /**
   * 提取图数据
   */
  private extractGraphData(result: any): GraphData {
    const nodesMap = new Map<string, Neo4jNode>();
    const linksMap = new Map<string, Neo4jRelationship>();

    result.records.forEach(record => {
      record.keys.forEach(key => {
        const value = record.get(key);

        // 处理节点
        if (value?.labels && value?.identity) {
          const id = value.identity.toNumber().toString();
          if (!nodesMap.has(id)) {
            nodesMap.set(id, {
              id,
              labels: value.labels,
              properties: value.properties,
              color: this.getNodeColor(value.labels[0]),
              radius: 20 + Object.keys(value.properties).length * 1.5
            });
          }
        }

        // 处理关系
        if (value?.type && value?.start !== undefined && value?.end !== undefined) {
          const id = value.identity.toNumber().toString();
          if (!linksMap.has(id)) {
            linksMap.set(id, {
              id,
              type: value.type,
              startNode: value.start.toNumber().toString(),
              endNode: value.end.toNumber().toString(),
              source: value.start.toNumber().toString(),
              target: value.end.toNumber().toString(),
              properties: value.properties
            });
          }
        }
      });
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links: Array.from(linksMap.values())
    };
  }

  /**
   * 更新缓存
   */
  private updateCache(data: GraphData): void {
    data.nodes.forEach(n => this.loadedNodeIds.add(n.id));
    data.links.forEach(l => this.loadedLinkIds.add(l.id));
  }

  /**
   * 分批加载数据
   */
  private async loadBatchedData(data: GraphData): Promise<GraphData> {
    // 过滤已加载的数据
    const newNodes = data.nodes.filter(n => !this.loadedNodeIds.has(n.id));
    const newLinks = data.links.filter(l => !this.loadedLinkIds.has(l.id));

    // 更新缓存
    this.updateCache({ nodes: newNodes, links: newLinks });
    this.batchCount++;

    return {
      nodes: newNodes,
      links: newLinks
    };
  }

  /**
   * 获取节点颜色
   */
  private getNodeColor(label: string): string {
    const neonColors = [
      '#00F0FF', '#FF00FF', '#00FF88', '#FF6B00',
      '#B388FF', '#FFEA00', '#00FFEF', '#FF4081'
    ];

    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % neonColors.length;
    return neonColors[index];
  }
}

/**
 * 创建增量加载器工厂函数
 */
export function createIncrementalLoader(
  driver: Driver,
  config?: Partial<IncrementalLoaderConfig>,
  database?: string
): IncrementalLoader {
  return new IncrementalLoader(
    driver,
    { ...DEFAULT_INCREMENTAL_LOADER_CONFIG, ...config },
    database
  );
}
