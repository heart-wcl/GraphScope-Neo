/**
 * Import/Export Service
 * 数据导入导出 - 支持多种格式
 * Cypher、JSON、CSV、GraphML、GEXF、DOT、Markdown、纯文本
 */

import type { Driver } from 'neo4j-driver';
import type { Neo4jNode, Neo4jRelationship, GraphData } from '../../types';

export type ExportFormat = 
  | 'cypher' 
  | 'json' 
  | 'csv' 
  | 'graphml' 
  | 'gexf' 
  | 'dot' 
  | 'markdown' 
  | 'text'
  | 'excel';

export interface ExportOptions {
  includeConstraints?: boolean;
  includeIndexes?: boolean;
  labels?: string[];
  relationshipTypes?: string[];
  limit?: number;
  includeProperties?: boolean;
  includeStatistics?: boolean;
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

/**
 * 导出为 GraphML 格式 (标准图交换格式)
 */
export async function exportToGraphML(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<string> {
  const session = driver.session(database ? { database } : undefined);
  const { labels, limit = 10000, includeProperties = true } = options;
  
  try {
    // 获取节点
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
    
    // 获取关系
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(r) as id, id(a) as source, id(b) as target, type(r) as type, properties(r) as properties LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    const relationships = relsResult.records.map(record => ({
      id: record.get('id').toNumber(),
      source: record.get('source').toNumber(),
      target: record.get('target').toNumber(),
      type: record.get('type'),
      properties: convertNeo4jTypes(record.get('properties') || {})
    }));
    
    // 收集所有属性键用于定义
    const nodePropertyKeys = new Set<string>();
    const edgePropertyKeys = new Set<string>();
    
    nodes.forEach(n => {
      Object.keys(n.properties).forEach(k => nodePropertyKeys.add(k));
    });
    relationships.forEach(r => {
      Object.keys(r.properties).forEach(k => edgePropertyKeys.add(k));
    });
    
    // 构建 GraphML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns"\n';
    xml += '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns\n';
    xml += '         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">\n';
    
    // 定义节点属性
    xml += '  <key id="labels" for="node" attr.name="labels" attr.type="string"/>\n';
    if (includeProperties) {
      nodePropertyKeys.forEach(key => {
        xml += `  <key id="n_${escapeXml(key)}" for="node" attr.name="${escapeXml(key)}" attr.type="string"/>\n`;
      });
    }
    
    // 定义边属性
    xml += '  <key id="type" for="edge" attr.name="type" attr.type="string"/>\n';
    if (includeProperties) {
      edgePropertyKeys.forEach(key => {
        xml += `  <key id="e_${escapeXml(key)}" for="edge" attr.name="${escapeXml(key)}" attr.type="string"/>\n`;
      });
    }
    
    xml += '  <graph id="G" edgedefault="directed">\n';
    
    // 添加节点
    nodes.forEach(node => {
      xml += `    <node id="${node.id}">\n`;
      xml += `      <data key="labels">${escapeXml(node.labels.join(':'))}</data>\n`;
      if (includeProperties) {
        Object.entries(node.properties).forEach(([key, value]) => {
          xml += `      <data key="n_${escapeXml(key)}">${escapeXml(String(value))}</data>\n`;
        });
      }
      xml += '    </node>\n';
    });
    
    // 添加边
    relationships.forEach(rel => {
      xml += `    <edge id="${rel.id}" source="${rel.source}" target="${rel.target}">\n`;
      xml += `      <data key="type">${escapeXml(rel.type)}</data>\n`;
      if (includeProperties) {
        Object.entries(rel.properties).forEach(([key, value]) => {
          xml += `      <data key="e_${escapeXml(key)}">${escapeXml(String(value))}</data>\n`;
        });
      }
      xml += '    </edge>\n';
    });
    
    xml += '  </graph>\n';
    xml += '</graphml>';
    
    return xml;
  } finally {
    await session.close();
  }
}

/**
 * 导出为 GEXF 格式 (Gephi 格式)
 */
export async function exportToGEXF(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<string> {
  const session = driver.session(database ? { database } : undefined);
  const { labels, limit = 10000, includeProperties = true } = options;
  
  try {
    // 获取节点
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
    
    // 获取关系
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(r) as id, id(a) as source, id(b) as target, type(r) as type, properties(r) as properties LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    const relationships = relsResult.records.map(record => ({
      id: record.get('id').toNumber(),
      source: record.get('source').toNumber(),
      target: record.get('target').toNumber(),
      type: record.get('type'),
      properties: convertNeo4jTypes(record.get('properties') || {})
    }));
    
    // 收集属性定义
    const nodeAttributes = new Map<string, string>();
    const edgeAttributes = new Map<string, string>();
    
    nodes.forEach(n => {
      Object.entries(n.properties).forEach(([key, value]) => {
        nodeAttributes.set(key, typeof value === 'number' ? 'float' : 'string');
      });
    });
    relationships.forEach(r => {
      Object.entries(r.properties).forEach(([key, value]) => {
        edgeAttributes.set(key, typeof value === 'number' ? 'float' : 'string');
      });
    });
    
    const timestamp = new Date().toISOString();
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gexf xmlns="http://www.gexf.net/1.3"\n';
    xml += '      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '      xsi:schemaLocation="http://www.gexf.net/1.3 http://www.gexf.net/1.3/gexf.xsd"\n';
    xml += '      version="1.3">\n';
    xml += `  <meta lastmodifieddate="${timestamp.split('T')[0]}">\n`;
    xml += '    <creator>GraphScope Neo</creator>\n';
    xml += '    <description>Exported from Neo4j Database</description>\n';
    xml += '  </meta>\n';
    xml += '  <graph mode="static" defaultedgetype="directed">\n';
    
    // 节点属性定义
    if (includeProperties && nodeAttributes.size > 0) {
      xml += '    <attributes class="node">\n';
      let attrId = 0;
      nodeAttributes.forEach((type, key) => {
        xml += `      <attribute id="${attrId++}" title="${escapeXml(key)}" type="${type}"/>\n`;
      });
      xml += '    </attributes>\n';
    }
    
    // 边属性定义
    if (includeProperties && edgeAttributes.size > 0) {
      xml += '    <attributes class="edge">\n';
      let attrId = 0;
      edgeAttributes.forEach((type, key) => {
        xml += `      <attribute id="${attrId++}" title="${escapeXml(key)}" type="${type}"/>\n`;
      });
      xml += '    </attributes>\n';
    }
    
    // 节点
    xml += '    <nodes>\n';
    nodes.forEach(node => {
      const label = node.properties.name || node.properties.title || node.labels[0] || `Node ${node.id}`;
      xml += `      <node id="${node.id}" label="${escapeXml(String(label))}">\n`;
      if (includeProperties && Object.keys(node.properties).length > 0) {
        xml += '        <attvalues>\n';
        let attrId = 0;
        const attrKeys = Array.from(nodeAttributes.keys());
        Object.entries(node.properties).forEach(([key, value]) => {
          const idx = attrKeys.indexOf(key);
          if (idx !== -1) {
            xml += `          <attvalue for="${idx}" value="${escapeXml(String(value))}"/>\n`;
          }
        });
        xml += '        </attvalues>\n';
      }
      xml += '      </node>\n';
    });
    xml += '    </nodes>\n';
    
    // 边
    xml += '    <edges>\n';
    relationships.forEach(rel => {
      xml += `      <edge id="${rel.id}" source="${rel.source}" target="${rel.target}" label="${escapeXml(rel.type)}">\n`;
      if (includeProperties && Object.keys(rel.properties).length > 0) {
        xml += '        <attvalues>\n';
        const attrKeys = Array.from(edgeAttributes.keys());
        Object.entries(rel.properties).forEach(([key, value]) => {
          const idx = attrKeys.indexOf(key);
          if (idx !== -1) {
            xml += `          <attvalue for="${idx}" value="${escapeXml(String(value))}"/>\n`;
          }
        });
        xml += '        </attvalues>\n';
      }
      xml += '      </edge>\n';
    });
    xml += '    </edges>\n';
    
    xml += '  </graph>\n';
    xml += '</gexf>';
    
    return xml;
  } finally {
    await session.close();
  }
}

/**
 * 导出为 DOT 格式 (Graphviz)
 */
export async function exportToDOT(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<string> {
  const session = driver.session(database ? { database } : undefined);
  const { labels, limit = 10000, includeProperties = true } = options;
  
  try {
    // 获取节点
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
    
    // 获取关系
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(a) as source, id(b) as target, type(r) as type, properties(r) as properties LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    const relationships = relsResult.records.map(record => ({
      source: record.get('source').toNumber(),
      target: record.get('target').toNumber(),
      type: record.get('type'),
      properties: convertNeo4jTypes(record.get('properties') || {})
    }));
    
    let dot = 'digraph Neo4jGraph {\n';
    dot += '  // Graph settings\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=ellipse, style=filled, fillcolor=lightblue];\n';
    dot += '  edge [color=gray];\n\n';
    
    // 添加节点
    dot += '  // Nodes\n';
    nodes.forEach(node => {
      const label = node.properties.name || node.properties.title || node.labels[0] || `Node ${node.id}`;
      const nodeLabel = node.labels.join(':');
      let attrs = `label="${escapeDot(String(label))}\\n[${escapeDot(nodeLabel)}]"`;
      
      if (includeProperties) {
        const propsStr = Object.entries(node.properties)
          .filter(([k]) => k !== 'name' && k !== 'title')
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${String(v).substring(0, 20)}`)
          .join('\\n');
        if (propsStr) {
          attrs = `label="${escapeDot(String(label))}\\n[${escapeDot(nodeLabel)}]\\n${escapeDot(propsStr)}"`;
        }
      }
      
      dot += `  n${node.id} [${attrs}];\n`;
    });
    
    dot += '\n  // Edges\n';
    relationships.forEach(rel => {
      let attrs = `label="${escapeDot(rel.type)}"`;
      if (includeProperties && Object.keys(rel.properties).length > 0) {
        const propsStr = Object.entries(rel.properties)
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${String(v).substring(0, 15)}`)
          .join('\\n');
        if (propsStr) {
          attrs = `label="${escapeDot(rel.type)}\\n${escapeDot(propsStr)}"`;
        }
      }
      dot += `  n${rel.source} -> n${rel.target} [${attrs}];\n`;
    });
    
    dot += '}\n';
    
    return dot;
  } finally {
    await session.close();
  }
}

/**
 * 导出为 Markdown 表格
 */
export async function exportToMarkdown(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<string> {
  const session = driver.session(database ? { database } : undefined);
  const { labels, limit = 10000, includeStatistics = true } = options;
  
  try {
    let md = '# Neo4j 数据库导出\n\n';
    md += `导出时间: ${new Date().toLocaleString()}\n\n`;
    
    // 统计信息
    if (includeStatistics) {
      const countResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
      const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
      const nodeCount = countResult.records[0]?.get('nodeCount')?.toNumber() || 0;
      const relCount = relCountResult.records[0]?.get('relCount')?.toNumber() || 0;
      
      md += '## 统计信息\n\n';
      md += `- 总节点数: ${nodeCount}\n`;
      md += `- 总关系数: ${relCount}\n\n`;
    }
    
    // 获取节点
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
    
    // 按标签分组节点
    const nodesByLabel = new Map<string, typeof nodes>();
    nodes.forEach(node => {
      const label = node.labels[0] || 'Unknown';
      if (!nodesByLabel.has(label)) {
        nodesByLabel.set(label, []);
      }
      nodesByLabel.get(label)!.push(node);
    });
    
    md += '## 节点\n\n';
    
    nodesByLabel.forEach((labelNodes, label) => {
      md += `### ${label} (${labelNodes.length}个)\n\n`;
      
      // 收集所有属性
      const allProps = new Set<string>();
      labelNodes.forEach(n => {
        Object.keys(n.properties).forEach(k => allProps.add(k));
      });
      
      const propList = Array.from(allProps).slice(0, 6); // 最多显示6个属性
      
      // 表头
      md += '| ID | ' + propList.join(' | ') + ' |\n';
      md += '| --- | ' + propList.map(() => '---').join(' | ') + ' |\n';
      
      // 数据行
      labelNodes.slice(0, 50).forEach(node => { // 每个标签最多显示50行
        const row = [String(node.id)];
        propList.forEach(prop => {
          const value = node.properties[prop];
          row.push(formatMdCell(value));
        });
        md += '| ' + row.join(' | ') + ' |\n';
      });
      
      if (labelNodes.length > 50) {
        md += `\n*... 还有 ${labelNodes.length - 50} 个节点未显示*\n`;
      }
      
      md += '\n';
    });
    
    // 获取关系
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(a) as source, id(b) as target, type(r) as type, properties(r) as properties LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    const relationships = relsResult.records.map(record => ({
      source: record.get('source').toNumber(),
      target: record.get('target').toNumber(),
      type: record.get('type'),
      properties: convertNeo4jTypes(record.get('properties') || {})
    }));
    
    if (relationships.length > 0) {
      md += '## 关系\n\n';
      md += '| 源节点 | 关系类型 | 目标节点 | 属性 |\n';
      md += '| --- | --- | --- | --- |\n';
      
      relationships.slice(0, 100).forEach(rel => {
        const propsStr = Object.entries(rel.properties)
          .map(([k, v]) => `${k}: ${formatMdCell(v)}`)
          .join(', ');
        md += `| ${rel.source} | ${rel.type} | ${rel.target} | ${propsStr || '-'} |\n`;
      });
      
      if (relationships.length > 100) {
        md += `\n*... 还有 ${relationships.length - 100} 个关系未显示*\n`;
      }
    }
    
    return md;
  } finally {
    await session.close();
  }
}

/**
 * 导出为纯文本格式
 */
export async function exportToText(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<string> {
  const session = driver.session(database ? { database } : undefined);
  const { labels, limit = 10000, includeStatistics = true, includeProperties = true } = options;
  
  try {
    let text = '═══════════════════════════════════════════════════════════════\n';
    text += '                    Neo4j 数据库导出 (纯文本)\n';
    text += `                    ${new Date().toLocaleString()}\n`;
    text += '═══════════════════════════════════════════════════════════════\n\n';
    
    // 统计信息
    if (includeStatistics) {
      const countResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
      const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
      const nodeCount = countResult.records[0]?.get('nodeCount')?.toNumber() || 0;
      const relCount = relCountResult.records[0]?.get('relCount')?.toNumber() || 0;
      
      text += '【统计信息】\n';
      text += `  节点总数: ${nodeCount}\n`;
      text += `  关系总数: ${relCount}\n\n`;
    }
    
    // 获取节点
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
    
    text += '═══════════════════════════════════════════════════════════════\n';
    text += `                         节点 (${nodes.length}个)\n`;
    text += '═══════════════════════════════════════════════════════════════\n\n';
    
    nodes.forEach((node, idx) => {
      text += `[${idx + 1}] 节点 #${node.id}\n`;
      text += `    标签: ${node.labels.join(', ')}\n`;
      if (includeProperties && Object.keys(node.properties).length > 0) {
        text += '    属性:\n';
        Object.entries(node.properties).forEach(([key, value]) => {
          text += `      - ${key}: ${formatTextValue(value)}\n`;
        });
      }
      text += '\n';
    });
    
    // 获取关系
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(r) as id, id(a) as source, id(b) as target, type(r) as type, properties(r) as properties LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    const relationships = relsResult.records.map(record => ({
      id: record.get('id').toNumber(),
      source: record.get('source').toNumber(),
      target: record.get('target').toNumber(),
      type: record.get('type'),
      properties: convertNeo4jTypes(record.get('properties') || {})
    }));
    
    if (relationships.length > 0) {
      text += '═══════════════════════════════════════════════════════════════\n';
      text += `                         关系 (${relationships.length}个)\n`;
      text += '═══════════════════════════════════════════════════════════════\n\n';
      
      relationships.forEach((rel, idx) => {
        text += `[${idx + 1}] (${rel.source}) -[:${rel.type}]-> (${rel.target})\n`;
        if (includeProperties && Object.keys(rel.properties).length > 0) {
          text += '    属性:\n';
          Object.entries(rel.properties).forEach(([key, value]) => {
            text += `      - ${key}: ${formatTextValue(value)}\n`;
          });
        }
        text += '\n';
      });
    }
    
    text += '═══════════════════════════════════════════════════════════════\n';
    text += '                            导出完成\n';
    text += '═══════════════════════════════════════════════════════════════\n';
    
    return text;
  } finally {
    await session.close();
  }
}

/**
 * 导出为 Excel 兼容的 CSV (带 BOM，支持中文)
 */
export async function exportToExcelCsv(
  driver: Driver,
  options: ExportOptions = {},
  database?: string
): Promise<{ nodes: string; relationships: string }> {
  const session = driver.session(database ? { database } : undefined);
  const { labels, limit = 10000 } = options;
  
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel
  
  try {
    // 获取节点
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
    
    // 收集所有节点属性
    const allNodeProps = new Set<string>();
    nodes.forEach(n => {
      Object.keys(n.properties).forEach(k => allNodeProps.add(k));
    });
    
    const nodePropList = Array.from(allNodeProps);
    
    // 生成节点 CSV
    let nodesCsv = BOM + 'ID,标签,' + nodePropList.join(',') + '\n';
    nodes.forEach(node => {
      const row = [
        String(node.id),
        `"${node.labels.join(':')}"`,
        ...nodePropList.map(prop => formatCsvValue(node.properties[prop]))
      ];
      nodesCsv += row.join(',') + '\n';
    });
    
    // 获取关系
    let relQuery = 'MATCH (a)-[r]->(b)';
    if (labels && labels.length > 0) {
      relQuery = `MATCH (a)-[r]->(b) WHERE ANY(label IN labels(a) WHERE label IN [${labels.map(l => `'${l}'`).join(', ')}])`;
    }
    relQuery += ` RETURN id(r) as id, id(a) as source, id(b) as target, type(r) as type, properties(r) as properties LIMIT ${limit}`;
    
    const relsResult = await session.run(relQuery);
    const relationships = relsResult.records.map(record => ({
      id: record.get('id').toNumber(),
      source: record.get('source').toNumber(),
      target: record.get('target').toNumber(),
      type: record.get('type'),
      properties: convertNeo4jTypes(record.get('properties') || {})
    }));
    
    // 收集所有关系属性
    const allRelProps = new Set<string>();
    relationships.forEach(r => {
      Object.keys(r.properties).forEach(k => allRelProps.add(k));
    });
    
    const relPropList = Array.from(allRelProps);
    
    // 生成关系 CSV
    let relsCsv = BOM + 'ID,源节点,目标节点,关系类型,' + relPropList.join(',') + '\n';
    relationships.forEach(rel => {
      const row = [
        String(rel.id),
        String(rel.source),
        String(rel.target),
        `"${rel.type}"`,
        ...relPropList.map(prop => formatCsvValue(rel.properties[prop]))
      ];
      relsCsv += row.join(',') + '\n';
    });
    
    return { nodes: nodesCsv, relationships: relsCsv };
  } finally {
    await session.close();
  }
}

/**
 * 统一导出接口
 */
export async function exportData(
  driver: Driver,
  format: ExportFormat,
  options: ExportOptions = {},
  database?: string
): Promise<string | { nodes: string; relationships: string }> {
  switch (format) {
    case 'cypher':
      return exportToCypher(driver, options, database);
    case 'json':
      const jsonData = await exportToJSON(driver, options, database);
      return JSON.stringify(jsonData, null, 2);
    case 'csv':
      // CSV 需要单独处理，这里返回节点 CSV
      return '请使用 exportNodesToCsv 或 exportToExcelCsv';
    case 'graphml':
      return exportToGraphML(driver, options, database);
    case 'gexf':
      return exportToGEXF(driver, options, database);
    case 'dot':
      return exportToDOT(driver, options, database);
    case 'markdown':
      return exportToMarkdown(driver, options, database);
    case 'text':
      return exportToText(driver, options, database);
    case 'excel':
      return exportToExcelCsv(driver, options, database);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// Helper functions

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeDot(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function formatMdCell(value: any): string {
  if (value === null || value === undefined) return '-';
  const str = String(value);
  return str.length > 30 ? str.substring(0, 27) + '...' : str;
}

function formatTextValue(value: any): string {
  if (value === null || value === undefined) return '(空)';
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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
