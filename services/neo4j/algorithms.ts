/**
 * Graph Algorithms Service
 * 图算法集成 - PageRank、社区检测、中心性、相似度
 * 需要 Neo4j GDS (Graph Data Science) 库
 */

import type { Driver } from 'neo4j-driver';

export interface AlgorithmResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime?: number;
}

export interface PageRankResult {
  nodeId: string;
  score: number;
  labels: string[];
  properties: Record<string, any>;
}

export interface CommunityResult {
  nodeId: string;
  communityId: number;
  labels: string[];
  properties: Record<string, any>;
}

export interface CentralityResult {
  nodeId: string;
  score: number;
  labels: string[];
  properties: Record<string, any>;
}

export interface SimilarityResult {
  node1Id: string;
  node2Id: string;
  similarity: number;
}

export interface GraphProjection {
  name: string;
  nodeCount: number;
  relationshipCount: number;
  creationTime: string;
}

/**
 * 检查 GDS 是否可用
 */
export async function isGDSAvailable(driver: Driver): Promise<boolean> {
  const session = driver.session();
  
  try {
    await session.run('RETURN gds.version() AS version');
    return true;
  } catch {
    return false;
  } finally {
    await session.close();
  }
}

/**
 * 获取 GDS 版本
 */
export async function getGDSVersion(driver: Driver): Promise<string | null> {
  const session = driver.session();
  
  try {
    const result = await session.run('RETURN gds.version() AS version');
    return result.records[0]?.get('version') || null;
  } catch {
    return null;
  } finally {
    await session.close();
  }
}

/**
 * 列出所有图投影
 */
export async function listGraphProjections(driver: Driver): Promise<GraphProjection[]> {
  const session = driver.session();
  
  try {
    const result = await session.run('CALL gds.graph.list() YIELD graphName, nodeCount, relationshipCount, creationTime');
    
    return result.records.map(record => ({
      name: record.get('graphName'),
      nodeCount: record.get('nodeCount')?.toNumber() || 0,
      relationshipCount: record.get('relationshipCount')?.toNumber() || 0,
      creationTime: record.get('creationTime')
    }));
  } catch {
    return [];
  } finally {
    await session.close();
  }
}

/**
 * 创建图投影
 */
export async function createGraphProjection(
  driver: Driver,
  graphName: string,
  nodeLabels: string[] | '*',
  relationshipTypes: string[] | '*',
  database?: string
): Promise<AlgorithmResult<{ nodeCount: number; relationshipCount: number }>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const nodeSpec = nodeLabels === '*' ? '*' : nodeLabels;
    const relSpec = relationshipTypes === '*' ? '*' : relationshipTypes;
    
    const result = await session.run(`
      CALL gds.graph.project($graphName, $nodeLabels, $relationshipTypes)
      YIELD graphName, nodeCount, relationshipCount
      RETURN nodeCount, relationshipCount
    `, {
      graphName,
      nodeLabels: nodeSpec,
      relationshipTypes: relSpec
    });
    
    return {
      success: true,
      data: {
        nodeCount: result.records[0]?.get('nodeCount')?.toNumber() || 0,
        relationshipCount: result.records[0]?.get('relationshipCount')?.toNumber() || 0
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 删除图投影
 */
export async function dropGraphProjection(
  driver: Driver,
  graphName: string
): Promise<AlgorithmResult<void>> {
  const session = driver.session();
  
  try {
    await session.run('CALL gds.graph.drop($graphName)', { graphName });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * PageRank 算法
 */
export async function runPageRank(
  driver: Driver,
  graphName: string,
  options: {
    maxIterations?: number;
    dampingFactor?: number;
    tolerance?: number;
  } = {},
  limit: number = 100,
  database?: string
): Promise<AlgorithmResult<PageRankResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  const {
    maxIterations = 20,
    dampingFactor = 0.85,
    tolerance = 0.0001
  } = options;
  
  try {
    const result = await session.run(`
      CALL gds.pageRank.stream($graphName, {
        maxIterations: $maxIterations,
        dampingFactor: $dampingFactor,
        tolerance: $tolerance
      })
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, score
      ORDER BY score DESC
      LIMIT $limit
    `, {
      graphName,
      maxIterations,
      dampingFactor,
      tolerance,
      limit
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        score: record.get('score'),
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 社区检测 (Louvain)
 */
export async function runLouvain(
  driver: Driver,
  graphName: string,
  options: {
    maxLevels?: number;
    maxIterations?: number;
    tolerance?: number;
    includeIntermediateCommunities?: boolean;
  } = {},
  database?: string
): Promise<AlgorithmResult<CommunityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  const {
    maxLevels = 10,
    maxIterations = 10,
    tolerance = 0.0001,
    includeIntermediateCommunities = false
  } = options;
  
  try {
    const result = await session.run(`
      CALL gds.louvain.stream($graphName, {
        maxLevels: $maxLevels,
        maxIterations: $maxIterations,
        tolerance: $tolerance,
        includeIntermediateCommunities: $includeIntermediateCommunities
      })
      YIELD nodeId, communityId
      WITH gds.util.asNode(nodeId) AS node, communityId
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, communityId
    `, {
      graphName,
      maxLevels,
      maxIterations,
      tolerance,
      includeIntermediateCommunities
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        communityId: record.get('communityId')?.toNumber() || 0,
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 度中心性
 */
export async function runDegreeCentrality(
  driver: Driver,
  graphName: string,
  orientation: 'NATURAL' | 'REVERSE' | 'UNDIRECTED' = 'NATURAL',
  limit: number = 100,
  database?: string
): Promise<AlgorithmResult<CentralityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      CALL gds.degree.stream($graphName, { orientation: $orientation })
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, score
      ORDER BY score DESC
      LIMIT $limit
    `, {
      graphName,
      orientation,
      limit
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        score: record.get('score'),
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 介数中心性
 */
export async function runBetweennessCentrality(
  driver: Driver,
  graphName: string,
  options: {
    samplingSize?: number;
    samplingSeed?: number;
  } = {},
  limit: number = 100,
  database?: string
): Promise<AlgorithmResult<CentralityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const configParts: string[] = [];
    if (options.samplingSize) configParts.push(`samplingSize: ${options.samplingSize}`);
    if (options.samplingSeed) configParts.push(`samplingSeed: ${options.samplingSeed}`);
    const config = configParts.length > 0 ? `, { ${configParts.join(', ')} }` : '';
    
    const result = await session.run(`
      CALL gds.betweenness.stream($graphName${config})
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, score
      ORDER BY score DESC
      LIMIT $limit
    `, {
      graphName,
      limit
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        score: record.get('score'),
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 接近中心性
 */
export async function runClosenessCentrality(
  driver: Driver,
  graphName: string,
  useWassermanFaust: boolean = false,
  limit: number = 100,
  database?: string
): Promise<AlgorithmResult<CentralityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      CALL gds.closeness.stream($graphName, { useWassermanFaust: $useWassermanFaust })
      YIELD nodeId, score
      WITH gds.util.asNode(nodeId) AS node, score
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, score
      ORDER BY score DESC
      LIMIT $limit
    `, {
      graphName,
      useWassermanFaust,
      limit
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        score: record.get('score'),
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 节点相似度 (Jaccard)
 */
export async function runNodeSimilarity(
  driver: Driver,
  graphName: string,
  options: {
    similarityCutoff?: number;
    topK?: number;
  } = {},
  limit: number = 100,
  database?: string
): Promise<AlgorithmResult<SimilarityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  const {
    similarityCutoff = 0.5,
    topK = 10
  } = options;
  
  try {
    const result = await session.run(`
      CALL gds.nodeSimilarity.stream($graphName, {
        similarityCutoff: $similarityCutoff,
        topK: $topK
      })
      YIELD node1, node2, similarity
      RETURN id(gds.util.asNode(node1)) as node1Id, id(gds.util.asNode(node2)) as node2Id, similarity
      LIMIT $limit
    `, {
      graphName,
      similarityCutoff,
      topK,
      limit
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        node1Id: record.get('node1Id').toString(),
        node2Id: record.get('node2Id').toString(),
        similarity: record.get('similarity')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 标签传播 (Label Propagation)
 */
export async function runLabelPropagation(
  driver: Driver,
  graphName: string,
  maxIterations: number = 10,
  database?: string
): Promise<AlgorithmResult<CommunityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      CALL gds.labelPropagation.stream($graphName, { maxIterations: $maxIterations })
      YIELD nodeId, communityId
      WITH gds.util.asNode(nodeId) AS node, communityId
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, communityId
    `, {
      graphName,
      maxIterations
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        communityId: record.get('communityId')?.toNumber() || 0,
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 弱连通分量
 */
export async function runWeaklyConnectedComponents(
  driver: Driver,
  graphName: string,
  database?: string
): Promise<AlgorithmResult<CommunityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      CALL gds.wcc.stream($graphName)
      YIELD nodeId, componentId
      WITH gds.util.asNode(nodeId) AS node, componentId
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, componentId as communityId
    `, {
      graphName
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        communityId: record.get('communityId')?.toNumber() || 0,
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 三角形计数
 */
export async function runTriangleCount(
  driver: Driver,
  graphName: string,
  limit: number = 100,
  database?: string
): Promise<AlgorithmResult<CentralityResult[]>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      CALL gds.triangleCount.stream($graphName)
      YIELD nodeId, triangleCount
      WITH gds.util.asNode(nodeId) AS node, triangleCount
      RETURN id(node) as nodeId, labels(node) as labels, properties(node) as properties, triangleCount as score
      ORDER BY triangleCount DESC
      LIMIT $limit
    `, {
      graphName,
      limit
    });
    
    return {
      success: true,
      data: result.records.map(record => ({
        nodeId: record.get('nodeId').toString(),
        score: record.get('score')?.toNumber() || 0,
        labels: record.get('labels'),
        properties: record.get('properties')
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}
