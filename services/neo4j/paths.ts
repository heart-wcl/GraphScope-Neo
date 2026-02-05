/**
 * Path Finding Service
 * 路径查询 - 最短路径、所有路径、加权路径
 */

import type { Driver } from 'neo4j-driver';
import type { Neo4jNode, Neo4jRelationship } from '../../types';

export interface PathResult {
  nodes: Neo4jNode[];
  relationships: Neo4jRelationship[];
  length: number;
  cost?: number;
}

export interface PathOptions {
  relationshipTypes?: string[];
  direction?: 'OUTGOING' | 'INCOMING' | 'BOTH';
  minDepth?: number;
  maxDepth?: number;
}

// Helper to generate neon colors
const NEON_COLORS = [
  '#00F0FF', '#FF00FF', '#00FF88', '#FF6B00', '#B388FF',
  '#FFEA00', '#00FFEF', '#FF4081', '#69F0AE', '#FFD740'
];

const getColor = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NEON_COLORS[Math.abs(hash) % NEON_COLORS.length];
};

/**
 * 提取路径数据
 */
function extractPathData(path: any): PathResult {
  const nodes: Neo4jNode[] = [];
  const relationships: Neo4jRelationship[] = [];
  const nodeIds = new Set<string>();
  
  // 提取起始节点
  const startNode = path.start;
  const startId = startNode.identity.toString();
  if (!nodeIds.has(startId)) {
    nodeIds.add(startId);
    const label = startNode.labels[0] || 'Node';
    nodes.push({
      id: startId,
      labels: startNode.labels,
      properties: startNode.properties,
      color: getColor(label),
      radius: 20 + (Object.keys(startNode.properties).length * 1.5)
    });
  }
  
  // 提取路径段
  if (path.segments && Array.isArray(path.segments)) {
    path.segments.forEach((segment: any) => {
      const endNode = segment.end;
      const rel = segment.relationship;
      const endId = endNode.identity.toString();
      
      if (!nodeIds.has(endId)) {
        nodeIds.add(endId);
        const label = endNode.labels[0] || 'Node';
        nodes.push({
          id: endId,
          labels: endNode.labels,
          properties: endNode.properties,
          color: getColor(label),
          radius: 20 + (Object.keys(endNode.properties).length * 1.5)
        });
      }
      
      relationships.push({
        id: rel.identity.toString(),
        type: rel.type,
        startNode: rel.start.toString(),
        endNode: rel.end.toString(),
        properties: rel.properties,
        source: rel.start.toString(),
        target: rel.end.toString()
      });
    });
  }
  
  return {
    nodes,
    relationships,
    length: path.length || relationships.length
  };
}

/**
 * 查找最短路径
 */
export async function findShortestPath(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  options: PathOptions = {},
  database?: string
): Promise<PathResult | null> {
  const session = driver.session(database ? { database } : undefined);
  
  const { 
    relationshipTypes, 
    direction = 'BOTH',
    maxDepth = 15 
  } = options;
  
  // Build relationship pattern
  let relPattern = '';
  if (relationshipTypes && relationshipTypes.length > 0) {
    const types = relationshipTypes.map(t => `\`${t}\``).join('|');
    relPattern = `:${types}`;
  }
  
  // Build direction pattern
  let pathPattern = '';
  switch (direction) {
    case 'OUTGOING':
      pathPattern = `(start)-[${relPattern}*..${maxDepth}]->(end)`;
      break;
    case 'INCOMING':
      pathPattern = `(start)<-[${relPattern}*..${maxDepth}]-(end)`;
      break;
    default:
      pathPattern = `(start)-[${relPattern}*..${maxDepth}]-(end)`;
  }
  
  try {
    const result = await session.run(`
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      MATCH path = shortestPath(${pathPattern})
      RETURN path
    `, { 
      startId: parseInt(startNodeId), 
      endId: parseInt(endNodeId) 
    });
    
    if (result.records.length === 0) return null;
    
    const path = result.records[0].get('path');
    return extractPathData(path);
  } finally {
    await session.close();
  }
}

/**
 * 查找所有路径
 */
export async function findAllPaths(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  options: PathOptions = {},
  limit: number = 10,
  database?: string
): Promise<PathResult[]> {
  const session = driver.session(database ? { database } : undefined);
  
  const { 
    relationshipTypes, 
    direction = 'BOTH',
    minDepth = 1,
    maxDepth = 5 
  } = options;
  
  // Build relationship pattern
  let relPattern = '';
  if (relationshipTypes && relationshipTypes.length > 0) {
    const types = relationshipTypes.map(t => `\`${t}\``).join('|');
    relPattern = `:${types}`;
  }
  
  // Build direction pattern
  let pathPattern = '';
  switch (direction) {
    case 'OUTGOING':
      pathPattern = `(start)-[${relPattern}*${minDepth}..${maxDepth}]->(end)`;
      break;
    case 'INCOMING':
      pathPattern = `(start)<-[${relPattern}*${minDepth}..${maxDepth}]-(end)`;
      break;
    default:
      pathPattern = `(start)-[${relPattern}*${minDepth}..${maxDepth}]-(end)`;
  }
  
  try {
    const result = await session.run(`
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      MATCH path = ${pathPattern}
      RETURN path
      LIMIT $limit
    `, { 
      startId: parseInt(startNodeId), 
      endId: parseInt(endNodeId),
      limit
    });
    
    return result.records.map(record => extractPathData(record.get('path')));
  } finally {
    await session.close();
  }
}

/**
 * 查找所有最短路径 (可能有多条等长路径)
 */
export async function findAllShortestPaths(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  options: PathOptions = {},
  database?: string
): Promise<PathResult[]> {
  const session = driver.session(database ? { database } : undefined);
  
  const { 
    relationshipTypes, 
    direction = 'BOTH',
    maxDepth = 15 
  } = options;
  
  // Build relationship pattern
  let relPattern = '';
  if (relationshipTypes && relationshipTypes.length > 0) {
    const types = relationshipTypes.map(t => `\`${t}\``).join('|');
    relPattern = `:${types}`;
  }
  
  // Build direction pattern
  let pathPattern = '';
  switch (direction) {
    case 'OUTGOING':
      pathPattern = `(start)-[${relPattern}*..${maxDepth}]->(end)`;
      break;
    case 'INCOMING':
      pathPattern = `(start)<-[${relPattern}*..${maxDepth}]-(end)`;
      break;
    default:
      pathPattern = `(start)-[${relPattern}*..${maxDepth}]-(end)`;
  }
  
  try {
    const result = await session.run(`
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      MATCH path = allShortestPaths(${pathPattern})
      RETURN path
    `, { 
      startId: parseInt(startNodeId), 
      endId: parseInt(endNodeId) 
    });
    
    return result.records.map(record => extractPathData(record.get('path')));
  } finally {
    await session.close();
  }
}

/**
 * 查找K条最短路径 (需要 APOC)
 */
export async function findKShortestPaths(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  k: number = 5,
  options: PathOptions = {},
  database?: string
): Promise<PathResult[]> {
  const session = driver.session(database ? { database } : undefined);
  
  const { 
    relationshipTypes,
    maxDepth = 15 
  } = options;
  
  // Build relationship filter
  const relFilter = relationshipTypes && relationshipTypes.length > 0
    ? relationshipTypes.join('|')
    : '';
  
  try {
    const result = await session.run(`
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      CALL apoc.algo.kShortestPaths(start, end, $k, $relFilter, $maxDepth)
      YIELD path
      RETURN path
    `, { 
      startId: parseInt(startNodeId), 
      endId: parseInt(endNodeId),
      k,
      relFilter,
      maxDepth
    });
    
    return result.records.map(record => extractPathData(record.get('path')));
  } catch (error) {
    // APOC might not be installed
    console.warn('APOC kShortestPaths not available, falling back to allPaths');
    return findAllPaths(driver, startNodeId, endNodeId, options, k, database);
  } finally {
    await session.close();
  }
}

/**
 * 查找加权最短路径 (需要 APOC 或 GDS)
 */
export async function findWeightedShortestPath(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  weightProperty: string = 'weight',
  options: PathOptions = {},
  database?: string
): Promise<PathResult | null> {
  const session = driver.session(database ? { database } : undefined);
  
  const { relationshipTypes } = options;
  
  // Build relationship filter
  const relFilter = relationshipTypes && relationshipTypes.length > 0
    ? relationshipTypes.join('|')
    : '';
  
  try {
    const result = await session.run(`
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      CALL apoc.algo.dijkstra(start, end, $relFilter, $weightProperty) 
      YIELD path, weight
      RETURN path, weight
    `, { 
      startId: parseInt(startNodeId), 
      endId: parseInt(endNodeId),
      relFilter,
      weightProperty
    });
    
    if (result.records.length === 0) return null;
    
    const pathData = extractPathData(result.records[0].get('path'));
    pathData.cost = result.records[0].get('weight');
    return pathData;
  } catch (error) {
    console.warn('APOC dijkstra not available');
    return null;
  } finally {
    await session.close();
  }
}

/**
 * 获取节点的邻居 (指定跳数)
 */
export async function getNeighbors(
  driver: Driver,
  nodeId: string,
  depth: number = 1,
  options: PathOptions = {},
  limit: number = 100,
  database?: string
): Promise<{ nodes: Neo4jNode[]; relationships: Neo4jRelationship[] }> {
  const session = driver.session(database ? { database } : undefined);
  
  const { 
    relationshipTypes, 
    direction = 'BOTH'
  } = options;
  
  // Build relationship pattern
  let relPattern = '';
  if (relationshipTypes && relationshipTypes.length > 0) {
    const types = relationshipTypes.map(t => `\`${t}\``).join('|');
    relPattern = `:${types}`;
  }
  
  // Build direction pattern
  let pathPattern = '';
  switch (direction) {
    case 'OUTGOING':
      pathPattern = `(n)-[r${relPattern}*1..${depth}]->(m)`;
      break;
    case 'INCOMING':
      pathPattern = `(n)<-[r${relPattern}*1..${depth}]-(m)`;
      break;
    default:
      pathPattern = `(n)-[r${relPattern}*1..${depth}]-(m)`;
  }
  
  try {
    const result = await session.run(`
      MATCH (n)
      WHERE id(n) = $nodeId
      MATCH ${pathPattern}
      WITH DISTINCT m, r
      LIMIT $limit
      RETURN m as node, r as rels
    `, { 
      nodeId: parseInt(nodeId),
      limit
    });
    
    const nodesMap = new Map<string, Neo4jNode>();
    const relsMap = new Map<string, Neo4jRelationship>();
    
    result.records.forEach(record => {
      const node = record.get('node');
      const nodeId = node.identity.toString();
      
      if (!nodesMap.has(nodeId)) {
        const label = node.labels[0] || 'Node';
        nodesMap.set(nodeId, {
          id: nodeId,
          labels: node.labels,
          properties: node.properties,
          color: getColor(label),
          radius: 20 + (Object.keys(node.properties).length * 1.5)
        });
      }
      
      const rels = record.get('rels');
      if (Array.isArray(rels)) {
        rels.forEach((rel: any) => {
          const relId = rel.identity.toString();
          if (!relsMap.has(relId)) {
            relsMap.set(relId, {
              id: relId,
              type: rel.type,
              startNode: rel.start.toString(),
              endNode: rel.end.toString(),
              properties: rel.properties,
              source: rel.start.toString(),
              target: rel.end.toString()
            });
          }
        });
      }
    });
    
    return {
      nodes: Array.from(nodesMap.values()),
      relationships: Array.from(relsMap.values())
    };
  } finally {
    await session.close();
  }
}

/**
 * 检查两个节点是否连通
 */
export async function areNodesConnected(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  maxDepth: number = 15,
  database?: string
): Promise<boolean> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      RETURN EXISTS((start)-[*..${maxDepth}]-(end)) as connected
    `, { 
      startId: parseInt(startNodeId), 
      endId: parseInt(endNodeId) 
    });
    
    return result.records[0]?.get('connected') || false;
  } finally {
    await session.close();
  }
}

/**
 * 获取两节点之间的距离(跳数)
 */
export async function getDistance(
  driver: Driver,
  startNodeId: string,
  endNodeId: string,
  maxDepth: number = 15,
  database?: string
): Promise<number | null> {
  const path = await findShortestPath(driver, startNodeId, endNodeId, { maxDepth }, database);
  return path ? path.length : null;
}
