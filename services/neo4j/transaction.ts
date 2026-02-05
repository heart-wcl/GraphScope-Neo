/**
 * Transaction Management Service
 * 事务管理 - 支持批量操作、原子性、自动回滚
 */

import type { Driver, ManagedTransaction, Session } from 'neo4j-driver';
import type { Neo4jNode, Neo4jRelationship } from '../../types';

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BatchNodeInput {
  label: string;
  properties: Record<string, any>;
}

export interface BatchRelationshipInput {
  startNodeId: string;
  endNodeId: string;
  type: string;
  properties?: Record<string, any>;
}

/**
 * 执行写事务 (自动重试和回滚)
 */
export async function executeWriteTransaction<T>(
  driver: Driver,
  work: (tx: ManagedTransaction) => Promise<T>,
  database?: string
): Promise<TransactionResult<T>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.executeWrite(work);
    return { success: true, data: result };
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
 * 执行读事务 (自动重试)
 */
export async function executeReadTransaction<T>(
  driver: Driver,
  work: (tx: ManagedTransaction) => Promise<T>,
  database?: string
): Promise<TransactionResult<T>> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.executeRead(work);
    return { success: true, data: result };
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
 * 批量创建节点 (事务)
 */
export async function batchCreateNodes(
  driver: Driver,
  nodes: BatchNodeInput[],
  database?: string
): Promise<TransactionResult<string[]>> {
  return executeWriteTransaction(driver, async (tx) => {
    const createdIds: string[] = [];
    
    for (const node of nodes) {
      // Build properties string with parameters
      const propKeys = Object.keys(node.properties);
      const propParams: Record<string, any> = {};
      const propParts: string[] = [];
      
      propKeys.forEach((key, idx) => {
        const paramName = `prop_${createdIds.length}_${idx}`;
        propParts.push(`${key}: $${paramName}`);
        propParams[paramName] = node.properties[key];
      });
      
      const propsStr = propParts.length > 0 ? ` { ${propParts.join(', ')} }` : '';
      
      const result = await tx.run(
        `CREATE (n:\`${node.label}\`${propsStr}) RETURN id(n) as id`,
        propParams
      );
      
      const id = result.records[0]?.get('id');
      if (id) {
        createdIds.push(id.toNumber().toString());
      }
    }
    
    return createdIds;
  }, database);
}

/**
 * 批量删除节点 (事务, 包含关系)
 */
export async function batchDeleteNodes(
  driver: Driver,
  nodeIds: string[],
  database?: string
): Promise<TransactionResult<number>> {
  return executeWriteTransaction(driver, async (tx) => {
    const result = await tx.run(
      `MATCH (n) WHERE id(n) IN $ids DETACH DELETE n RETURN count(n) as deleted`,
      { ids: nodeIds.map(id => parseInt(id)) }
    );
    return result.records[0]?.get('deleted')?.toNumber() || 0;
  }, database);
}

/**
 * 批量创建关系 (事务)
 */
export async function batchCreateRelationships(
  driver: Driver,
  relationships: BatchRelationshipInput[],
  database?: string
): Promise<TransactionResult<string[]>> {
  return executeWriteTransaction(driver, async (tx) => {
    const createdIds: string[] = [];
    
    for (const rel of relationships) {
      const propKeys = Object.keys(rel.properties || {});
      const propParams: Record<string, any> = {
        startId: parseInt(rel.startNodeId),
        endId: parseInt(rel.endNodeId)
      };
      const propParts: string[] = [];
      
      propKeys.forEach((key, idx) => {
        const paramName = `prop_${createdIds.length}_${idx}`;
        propParts.push(`${key}: $${paramName}`);
        propParams[paramName] = rel.properties![key];
      });
      
      const propsStr = propParts.length > 0 ? ` { ${propParts.join(', ')} }` : '';
      
      const result = await tx.run(
        `MATCH (a), (b) WHERE id(a) = $startId AND id(b) = $endId 
         CREATE (a)-[r:\`${rel.type}\`${propsStr}]->(b) 
         RETURN id(r) as id`,
        propParams
      );
      
      const id = result.records[0]?.get('id');
      if (id) {
        createdIds.push(id.toNumber().toString());
      }
    }
    
    return createdIds;
  }, database);
}

/**
 * 批量删除关系 (事务)
 */
export async function batchDeleteRelationships(
  driver: Driver,
  relIds: string[],
  database?: string
): Promise<TransactionResult<number>> {
  return executeWriteTransaction(driver, async (tx) => {
    const result = await tx.run(
      `MATCH ()-[r]->() WHERE id(r) IN $ids DELETE r RETURN count(r) as deleted`,
      { ids: relIds.map(id => parseInt(id)) }
    );
    return result.records[0]?.get('deleted')?.toNumber() || 0;
  }, database);
}

/**
 * 批量更新节点属性 (事务)
 */
export async function batchUpdateNodeProperties(
  driver: Driver,
  updates: Array<{ nodeId: string; properties: Record<string, any> }>,
  database?: string
): Promise<TransactionResult<number>> {
  return executeWriteTransaction(driver, async (tx) => {
    let updatedCount = 0;
    
    for (const update of updates) {
      const result = await tx.run(
        `MATCH (n) WHERE id(n) = $nodeId SET n += $props RETURN n`,
        { 
          nodeId: parseInt(update.nodeId), 
          props: update.properties 
        }
      );
      if (result.records.length > 0) {
        updatedCount++;
      }
    }
    
    return updatedCount;
  }, database);
}

/**
 * 批量更新关系属性 (事务)
 */
export async function batchUpdateRelationshipProperties(
  driver: Driver,
  updates: Array<{ relId: string; properties: Record<string, any> }>,
  database?: string
): Promise<TransactionResult<number>> {
  return executeWriteTransaction(driver, async (tx) => {
    let updatedCount = 0;
    
    for (const update of updates) {
      const result = await tx.run(
        `MATCH ()-[r]->() WHERE id(r) = $relId SET r += $props RETURN r`,
        { 
          relId: parseInt(update.relId), 
          props: update.properties 
        }
      );
      if (result.records.length > 0) {
        updatedCount++;
      }
    }
    
    return updatedCount;
  }, database);
}

/**
 * 执行多条Cypher语句 (事务)
 */
export async function executeMultipleQueries(
  driver: Driver,
  queries: Array<{ query: string; params?: Record<string, any> }>,
  database?: string
): Promise<TransactionResult<any[]>> {
  return executeWriteTransaction(driver, async (tx) => {
    const results: any[] = [];
    
    for (const { query, params = {} } of queries) {
      const result = await tx.run(query, params);
      results.push(result.records.map(r => r.toObject()));
    }
    
    return results;
  }, database);
}

/**
 * 复制节点及其关系 (事务)
 */
export async function cloneNode(
  driver: Driver,
  nodeId: string,
  includeRelationships: boolean = false,
  database?: string
): Promise<TransactionResult<{ nodeId: string; relationshipIds: string[] }>> {
  return executeWriteTransaction(driver, async (tx) => {
    // 获取原节点
    const nodeResult = await tx.run(
      `MATCH (n) WHERE id(n) = $nodeId RETURN n, labels(n) as labels`,
      { nodeId: parseInt(nodeId) }
    );
    
    if (nodeResult.records.length === 0) {
      throw new Error('Node not found');
    }
    
    const originalNode = nodeResult.records[0].get('n');
    const labels = nodeResult.records[0].get('labels') as string[];
    const labelsStr = labels.map(l => `:\`${l}\``).join('');
    
    // 创建新节点
    const createResult = await tx.run(
      `CREATE (n${labelsStr} $props) RETURN id(n) as id`,
      { props: originalNode.properties }
    );
    
    const newNodeId = createResult.records[0].get('id').toNumber().toString();
    const relationshipIds: string[] = [];
    
    // 如果需要复制关系
    if (includeRelationships) {
      // 获取出向关系
      const outRelsResult = await tx.run(
        `MATCH (n)-[r]->(m) WHERE id(n) = $nodeId RETURN r, type(r) as type, id(m) as targetId`,
        { nodeId: parseInt(nodeId) }
      );
      
      for (const record of outRelsResult.records) {
        const rel = record.get('r');
        const relType = record.get('type');
        const targetId = record.get('targetId').toNumber();
        
        const newRelResult = await tx.run(
          `MATCH (a), (b) WHERE id(a) = $newNodeId AND id(b) = $targetId 
           CREATE (a)-[r:\`${relType}\` $props]->(b) RETURN id(r) as id`,
          { newNodeId: parseInt(newNodeId), targetId, props: rel.properties }
        );
        
        const relId = newRelResult.records[0]?.get('id');
        if (relId) {
          relationshipIds.push(relId.toNumber().toString());
        }
      }
      
      // 获取入向关系
      const inRelsResult = await tx.run(
        `MATCH (m)-[r]->(n) WHERE id(n) = $nodeId RETURN r, type(r) as type, id(m) as sourceId`,
        { nodeId: parseInt(nodeId) }
      );
      
      for (const record of inRelsResult.records) {
        const rel = record.get('r');
        const relType = record.get('type');
        const sourceId = record.get('sourceId').toNumber();
        
        const newRelResult = await tx.run(
          `MATCH (a), (b) WHERE id(a) = $sourceId AND id(b) = $newNodeId 
           CREATE (a)-[r:\`${relType}\` $props]->(b) RETURN id(r) as id`,
          { sourceId, newNodeId: parseInt(newNodeId), props: rel.properties }
        );
        
        const relId = newRelResult.records[0]?.get('id');
        if (relId) {
          relationshipIds.push(relId.toNumber().toString());
        }
      }
    }
    
    return { nodeId: newNodeId, relationshipIds };
  }, database);
}

/**
 * 合并节点 (事务) - 将多个节点合并为一个
 */
export async function mergeNodes(
  driver: Driver,
  nodeIds: string[],
  targetLabel: string,
  mergedProperties: Record<string, any>,
  database?: string
): Promise<TransactionResult<string>> {
  if (nodeIds.length < 2) {
    return { success: false, error: 'At least 2 nodes required for merge' };
  }

  return executeWriteTransaction(driver, async (tx) => {
    // 创建新的合并节点
    const createResult = await tx.run(
      `CREATE (n:\`${targetLabel}\` $props) RETURN id(n) as id`,
      { props: mergedProperties }
    );
    
    const newNodeId = createResult.records[0].get('id').toNumber();
    const nodeIdInts = nodeIds.map(id => parseInt(id));
    
    // 将所有指向旧节点的关系重定向到新节点
    await tx.run(
      `MATCH (m)-[r]->(n) WHERE id(n) IN $oldIds AND NOT id(m) IN $oldIds
       WITH m, r, n, type(r) as relType, properties(r) as relProps
       CREATE (m)-[newR:\`MERGED_REL\`]->(target)
       WHERE id(target) = $newNodeId
       SET newR = relProps
       DELETE r`,
      { oldIds: nodeIdInts, newNodeId }
    );
    
    // 将所有从旧节点出发的关系重定向
    await tx.run(
      `MATCH (n)-[r]->(m) WHERE id(n) IN $oldIds AND NOT id(m) IN $oldIds
       WITH n, r, m, type(r) as relType, properties(r) as relProps
       MATCH (source) WHERE id(source) = $newNodeId
       CREATE (source)-[newR:\`MERGED_REL\`]->(m)
       SET newR = relProps
       DELETE r`,
      { oldIds: nodeIdInts, newNodeId }
    );
    
    // 删除旧节点
    await tx.run(
      `MATCH (n) WHERE id(n) IN $oldIds DETACH DELETE n`,
      { oldIds: nodeIdInts }
    );
    
    return newNodeId.toString();
  }, database);
}
