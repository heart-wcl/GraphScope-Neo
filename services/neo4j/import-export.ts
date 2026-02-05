/**
 * Import/Export Service
 * 数据导入导出 - Cypher脚本、JSON、CSV
 */

import type { Driver } from 'neo4j-driver';
import type { Neo4jNode, Neo4jRelationship, GraphData } from '../../types';

export interface ExportOptions {
  includeConstraints?: boolean;
  includeIndexes?: boolean;
  labels?: string[];
  relationshipTypes?: string[];
  limit?: number;
}

export interface ImportResult {
  success: boolean;
  nodesCreated: number;
  relationshipsCreated: number;
  error?: string;
}

/**
 * 导出为 Cypher 脚本
 */
export async function exportToCypher(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<string> {
  const session = driver.session(database ? { database } : undefined);
  const lines: string[] = [];
  
  const {
    includeConstraints = true,
    includeIndexes = true,
    labels,
    limit = 10000
  } = options;
  
  try {
    // 导出约束
    if (includeConstraints) {
      lines.push('// Constraints');
      const constraintResult = await session.run('SHOW CONSTRAINTS');
      constraintResult.records.forEach(record => {
        const name = record.get('name');
        const type = record.get('type');
        const labelsOrTypes = record.get('labelsOrTypes') || [];
        const properties = record.get('properties') || [];
        
        if (type === 'UNIQUENESS' && labelsOrTypes.length > 0 && properties.length > 0) {
          lines.push(`CREATE CONSTRAINT ${name} IF NOT EXISTS FOR (n:${labelsOrTypes[0]}) REQUIRE n.${properties[0]} IS UNIQUE;`);
        }
      });
      lines.push('');
    }
    
    // 导出索引
    if (includeIndexes) {
      lines.push('// Indexes');
      const indexResult = await session.run("SHOW INDEXES WHERE type <> 'LOOKUP'");
      indexResult.records.forEach(record => {
        const name = record.get('name');
        const labelsOrTypes = record.get('labelsOrTypes') || [];
        const properties = record.get('properties') || [];
        const type = record.get('type');
        
        if (type !== 'CONSTRAINT' && labelsOrTypes.length > 0 && properties.length > 0) {
          const propsStr = properties.map((p: string) => `n.${p}`).join(', ');
          lines.push(`CREATE INDEX ${name} IF NOT EXISTS FOR (n:${labelsOrTypes[0]}) ON (${propsStr});`);
        }
      });
      lines.push('');
    }
    
    // 导出节点
    lines.push('// Nodes');
    
    let nodeQuery = 'MATCH (n)';
    if (labels && labels.length > 0) {
      nodeQuery = `MATCH (n) WHERE ANY(label IN labels(n) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    nodeQuery += ` RETURN n LIMIT ${limit}`;
    
    const nodesResult = await session.run(nodeQuery);
    
    nodesResult.records.forEach(record => {
      const node = record.get('n');
      const nodeLabels = node.labels.join(':');
      const props = formatPropertiesForCypher(node.properties);
      lines.push(`CREATE (:${nodeLabels} ${props});`);
    });
    lines.push('');
    
    // 导出关系
    lines.push('// Relationships');
    lines.push('// Note: Relationships are exported using internal IDs for matching');
    
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(a) as startId, id(b) as endId, type(r) as type, properties(r) as props LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    
    relsResult.records.forEach(record => {
      const startId = record.get('startId').toNumber();
      const endId = record.get('endId').toNumber();
      const type = record.get('type');
      const props = formatPropertiesForCypher(record.get('props') || {});
      
      lines.push(`// MATCH (a), (b) WHERE id(a) = ${startId} AND id(b) = ${endId} CREATE (a)-[:${type} ${props}]->(b);`);
    });
    
    return lines.join('\n');
  } finally {
    await session.close();
  }
}

/**
 * 导出为 JSON
 */
export async function exportToJSON(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<{ nodes: any[]; relationships: any[] }> {
  const session = driver.session(database ? { database } : undefined);
  
  const { labels, limit = 10000 } = options;
  
  try {
    // 导出节点
    let nodeQuery = 'MATCH (n)';
    if (labels && labels.length > 0) {
      nodeQuery = `MATCH (n) WHERE ANY(label IN labels(n) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    nodeQuery += ` RETURN id(n) as id, labels(n) as labels, properties(n) as properties LIMIT ${limit}`;
    
    const nodesResult = await session.run(nodeQuery);
    const nodes = nodesResult.records.map(record => ({
      id: record.get('id').toNumber(),
      labels: record.get('labels'),
      properties: convertNeo4jTypes(record.get('properties'))
    }));
    
    // 导出关系
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(r) as id, id(a) as startNode, id(b) as endNode, type(r) as type, properties(r) as properties LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    const relationships = relsResult.records.map(record => ({
      id: record.get('id').toNumber(),
      startNode: record.get('startNode').toNumber(),
      endNode: record.get('endNode').toNumber(),
      type: record.get('type'),
      properties: convertNeo4jTypes(record.get('properties') || {})
    }));
    
    return { nodes, relationships };
  } finally {
    await session.close();
  }
}

/**
 * 导出为 CSV (节点)
 */
export async function exportNodesToCsv(
  driver: Driver,
  label: string,
  properties: string[],
  limit: number = 10000,
  database?: string
): Promise<string> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const propsReturn = properties.map(p => `n.${p} as ${p}`).join(', ');
    const result = await session.run(`
      MATCH (n:\`${label}\`)
      RETURN ${propsReturn}
      LIMIT ${limit}
    `);
    
    // CSV header
    const lines: string[] = [properties.join(',')];
    
    // CSV rows
    result.records.forEach(record => {
      const row = properties.map(p => {
        const value = record.get(p);
        return formatCsvValue(value);
      });
      lines.push(row.join(','));
    });
    
    return lines.join('\n');
  } finally {
    await session.close();
  }
}

/**
 * 从 JSON 导入
 */
export async function importFromJSON(
  driver: Driver,
  data: { nodes: any[]; relationships: any[] },
  database?: string
): Promise<ImportResult> {
  const session = driver.session(database ? { database } : undefined);
  
  let nodesCreated = 0;
  let relationshipsCreated = 0;
  const idMapping = new Map<number, number>(); // old ID -> new ID
  
  try {
    // 导入节点
    for (const node of data.nodes) {
      const labelsStr = node.labels.map((l: string) => `:\`${l}\``).join('');
      const result = await session.run(
        `CREATE (n${labelsStr} $props) RETURN id(n) as newId`,
        { props: node.properties }
      );
      
      const newId = result.records[0]?.get('newId')?.toNumber();
      if (newId !== undefined) {
        idMapping.set(node.id, newId);
        nodesCreated++;
      }
    }
    
    // 导入关系
    for (const rel of data.relationships) {
      const newStartId = idMapping.get(rel.startNode);
      const newEndId = idMapping.get(rel.endNode);
      
      if (newStartId !== undefined && newEndId !== undefined) {
        await session.run(
          `MATCH (a), (b) WHERE id(a) = $startId AND id(b) = $endId
           CREATE (a)-[r:\`${rel.type}\` $props]->(b)`,
          { startId: newStartId, endId: newEndId, props: rel.properties || {} }
        );
        relationshipsCreated++;
      }
    }
    
    return { success: true, nodesCreated, relationshipsCreated };
  } catch (error) {
    return {
      success: false,
      nodesCreated,
      relationshipsCreated,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 从 CSV 导入节点
 */
export async function importNodesFromCsv(
  driver: Driver,
  csvData: string,
  label: string,
  propertyMapping?: Record<string, string>, // CSV column -> property name
  database?: string
): Promise<ImportResult> {
  const session = driver.session(database ? { database } : undefined);
  
  let nodesCreated = 0;
  
  try {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, nodesCreated: 0, relationshipsCreated: 0, error: 'CSV must have header and at least one row' };
    }
    
    const headers = parseCsvLine(lines[0]);
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const props: Record<string, any> = {};
      
      headers.forEach((header, idx) => {
        const propName = propertyMapping?.[header] || header;
        const value = values[idx];
        
        // Try to parse as number
        if (value && !isNaN(Number(value))) {
          props[propName] = Number(value);
        } else {
          props[propName] = value;
        }
      });
      
      await session.run(
        `CREATE (n:\`${label}\` $props)`,
        { props }
      );
      nodesCreated++;
    }
    
    return { success: true, nodesCreated, relationshipsCreated: 0 };
  } catch (error) {
    return {
      success: false,
      nodesCreated,
      relationshipsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await session.close();
  }
}

/**
 * 导出当前图形视图数据
 */
export function exportGraphData(graphData: GraphData): string {
  return JSON.stringify({
    nodes: graphData.nodes.map(n => ({
      id: n.id,
      labels: n.labels,
      properties: n.properties
    })),
    links: graphData.links.map(l => ({
      id: l.id,
      type: l.type,
      startNode: l.startNode,
      endNode: l.endNode,
      properties: l.properties
    }))
  }, null, 2);
}

// Helper functions

function formatPropertiesForCypher(props: Record<string, any>): string {
  if (!props || Object.keys(props).length === 0) return '{}';
  
  const parts = Object.entries(props).map(([key, value]) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return `${key}: '${value.replace(/'/g, "\\'")}'`;
    if (typeof value === 'number') return `${key}: ${value}`;
    if (typeof value === 'boolean') return `${key}: ${value}`;
    if (Array.isArray(value)) return `${key}: ${JSON.stringify(value)}`;
    return `${key}: ${JSON.stringify(value)}`;
  }).filter(Boolean);
  
  return `{${parts.join(', ')}}`;
}

function convertNeo4jTypes(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  // Handle Neo4j Integer
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') {
    return obj.toNumber();
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(convertNeo4jTypes);
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertNeo4jTypes(value);
    }
    return result;
  }
  
  return obj;
}

function formatCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  
  // Handle Neo4j Integer
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    return value.toNumber().toString();
  }
  
  const strValue = String(value);
  
  // Escape if contains comma, quote, or newline
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  
  return strValue;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
