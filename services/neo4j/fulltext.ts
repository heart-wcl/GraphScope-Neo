/**
 * Fulltext Search Service
 * 全文搜索 - 全文索引管理、搜索、模糊匹配
 */

import type { Driver } from 'neo4j-driver';
import type { Neo4jNode } from '../../types';

export interface FulltextIndex {
  name: string;
  type: 'FULLTEXT';
  entityType: 'NODE' | 'RELATIONSHIP';
  labelsOrTypes: string[];
  properties: string[];
  state: string;
  populationPercent: number;
  analyzer?: string;
}

export interface SearchResult {
  node: Neo4jNode;
  score: number;
}

export interface RelationshipSearchResult {
  relationshipId: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
  score: number;
}

/**
 * 获取所有全文索引
 */
export async function getFulltextIndexes(
  driver: Driver,
  database?: string
): Promise<FulltextIndex[]> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      SHOW INDEXES
      WHERE type = 'FULLTEXT'
      YIELD name, type, entityType, labelsOrTypes, properties, state, populationPercent
      RETURN name, type, entityType, labelsOrTypes, properties, state, populationPercent
    `);
    
    return result.records.map(record => ({
      name: record.get('name'),
      type: 'FULLTEXT' as const,
      entityType: record.get('entityType'),
      labelsOrTypes: record.get('labelsOrTypes') || [],
      properties: record.get('properties') || [],
      state: record.get('state'),
      populationPercent: record.get('populationPercent') || 100
    }));
  } finally {
    await session.close();
  }
}

/**
 * 创建节点全文索引
 */
export async function createNodeFulltextIndex(
  driver: Driver,
  indexName: string,
  labels: string[],
  properties: string[],
  analyzer: string = 'standard-no-stop-words',
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  const labelsStr = labels.map(l => `\`${l}\``).join('|');
  const propsStr = properties.map(p => `n.\`${p}\``).join(', ');
  
  try {
    await session.run(`
      CREATE FULLTEXT INDEX ${indexName} IF NOT EXISTS
      FOR (n:${labelsStr})
      ON EACH [${propsStr}]
      OPTIONS { indexConfig: { \`fulltext.analyzer\`: '${analyzer}' } }
    `);
  } finally {
    await session.close();
  }
}

/**
 * 创建关系全文索引
 */
export async function createRelationshipFulltextIndex(
  driver: Driver,
  indexName: string,
  relationshipTypes: string[],
  properties: string[],
  analyzer: string = 'standard-no-stop-words',
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  const typesStr = relationshipTypes.map(t => `\`${t}\``).join('|');
  const propsStr = properties.map(p => `r.\`${p}\``).join(', ');
  
  try {
    await session.run(`
      CREATE FULLTEXT INDEX ${indexName} IF NOT EXISTS
      FOR ()-[r:${typesStr}]-()
      ON EACH [${propsStr}]
      OPTIONS { indexConfig: { \`fulltext.analyzer\`: '${analyzer}' } }
    `);
  } finally {
    await session.close();
  }
}

/**
 * 删除全文索引
 */
export async function dropFulltextIndex(
  driver: Driver,
  indexName: string,
  database?: string
): Promise<void> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    await session.run(`DROP INDEX ${indexName} IF EXISTS`);
  } finally {
    await session.close();
  }
}

/**
 * 执行节点全文搜索
 */
export async function fulltextSearchNodes(
  driver: Driver,
  indexName: string,
  searchTerm: string,
  limit: number = 100,
  database?: string
): Promise<SearchResult[]> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      CALL db.index.fulltext.queryNodes($indexName, $searchTerm)
      YIELD node, score
      RETURN node, score
      ORDER BY score DESC
      LIMIT $limit
    `, { indexName, searchTerm, limit });
    
    return result.records.map(record => {
      const node = record.get('node');
      return {
        node: {
          id: node.identity.toString(),
          labels: node.labels,
          properties: node.properties
        },
        score: record.get('score')
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * 执行关系全文搜索
 */
export async function fulltextSearchRelationships(
  driver: Driver,
  indexName: string,
  searchTerm: string,
  limit: number = 100,
  database?: string
): Promise<RelationshipSearchResult[]> {
  const session = driver.session(database ? { database } : undefined);
  
  try {
    const result = await session.run(`
      CALL db.index.fulltext.queryRelationships($indexName, $searchTerm)
      YIELD relationship, score
      RETURN relationship, score
      ORDER BY score DESC
      LIMIT $limit
    `, { indexName, searchTerm, limit });
    
    return result.records.map(record => {
      const rel = record.get('relationship');
      return {
        relationshipId: rel.identity.toString(),
        type: rel.type,
        startNodeId: rel.start.toString(),
        endNodeId: rel.end.toString(),
        properties: rel.properties,
        score: record.get('score')
      };
    });
  } finally {
    await session.close();
  }
}

/**
 * 模糊搜索 (使用 Lucene 语法)
 */
export async function fuzzySearchNodes(
  driver: Driver,
  indexName: string,
  searchTerm: string,
  fuzziness: number = 2,
  limit: number = 100,
  database?: string
): Promise<SearchResult[]> {
  // 添加模糊匹配语法 (Lucene ~N)
  const fuzzyTerm = `${searchTerm}~${fuzziness}`;
  return fulltextSearchNodes(driver, indexName, fuzzyTerm, limit, database);
}

/**
 * 通配符搜索
 */
export async function wildcardSearchNodes(
  driver: Driver,
  indexName: string,
  searchPattern: string,
  limit: number = 100,
  database?: string
): Promise<SearchResult[]> {
  // 支持 * 和 ? 通配符
  return fulltextSearchNodes(driver, indexName, searchPattern, limit, database);
}

/**
 * 短语搜索 (精确匹配短语)
 */
export async function phraseSearchNodes(
  driver: Driver,
  indexName: string,
  phrase: string,
  limit: number = 100,
  database?: string
): Promise<SearchResult[]> {
  // 使用引号包裹短语进行精确匹配
  const phraseQuery = `"${phrase}"`;
  return fulltextSearchNodes(driver, indexName, phraseQuery, limit, database);
}

/**
 * 布尔搜索 (AND, OR, NOT)
 */
export async function booleanSearchNodes(
  driver: Driver,
  indexName: string,
  mustTerms: string[],
  shouldTerms: string[],
  mustNotTerms: string[],
  limit: number = 100,
  database?: string
): Promise<SearchResult[]> {
  // 构建 Lucene 布尔查询
  const parts: string[] = [];
  
  if (mustTerms.length > 0) {
    parts.push(mustTerms.map(t => `+${t}`).join(' '));
  }
  if (shouldTerms.length > 0) {
    parts.push(shouldTerms.join(' '));
  }
  if (mustNotTerms.length > 0) {
    parts.push(mustNotTerms.map(t => `-${t}`).join(' '));
  }
  
  const query = parts.join(' ');
  return fulltextSearchNodes(driver, indexName, query, limit, database);
}

/**
 * 获取可用的分析器列表
 */
export function getAvailableAnalyzers(): Array<{ name: string; description: string }> {
  return [
    { name: 'standard', description: '标准分析器 (包含停用词)' },
    { name: 'standard-no-stop-words', description: '标准分析器 (不含停用词)' },
    { name: 'simple', description: '简单分析器 (小写转换)' },
    { name: 'whitespace', description: '空白分析器 (仅按空格分词)' },
    { name: 'stop', description: '停用词分析器' },
    { name: 'keyword', description: '关键词分析器 (不分词)' },
    { name: 'pattern', description: '正则表达式分析器' },
    { name: 'snowball', description: 'Snowball 词干分析器' },
    { name: 'arabic', description: '阿拉伯语分析器' },
    { name: 'armenian', description: '亚美尼亚语分析器' },
    { name: 'basque', description: '巴斯克语分析器' },
    { name: 'brazilian', description: '巴西葡萄牙语分析器' },
    { name: 'bulgarian', description: '保加利亚语分析器' },
    { name: 'catalan', description: '加泰罗尼亚语分析器' },
    { name: 'cjk', description: 'CJK (中日韩) 分析器' },
    { name: 'czech', description: '捷克语分析器' },
    { name: 'danish', description: '丹麦语分析器' },
    { name: 'dutch', description: '荷兰语分析器' },
    { name: 'english', description: '英语分析器' },
    { name: 'finnish', description: '芬兰语分析器' },
    { name: 'french', description: '法语分析器' },
    { name: 'galician', description: '加利西亚语分析器' },
    { name: 'german', description: '德语分析器' },
    { name: 'greek', description: '希腊语分析器' },
    { name: 'hindi', description: '印地语分析器' },
    { name: 'hungarian', description: '匈牙利语分析器' },
    { name: 'indonesian', description: '印度尼西亚语分析器' },
    { name: 'irish', description: '爱尔兰语分析器' },
    { name: 'italian', description: '意大利语分析器' },
    { name: 'latvian', description: '拉脱维亚语分析器' },
    { name: 'lithuanian', description: '立陶宛语分析器' },
    { name: 'norwegian', description: '挪威语分析器' },
    { name: 'persian', description: '波斯语分析器' },
    { name: 'portuguese', description: '葡萄牙语分析器' },
    { name: 'romanian', description: '罗马尼亚语分析器' },
    { name: 'russian', description: '俄语分析器' },
    { name: 'sorani', description: '索拉尼库尔德语分析器' },
    { name: 'spanish', description: '西班牙语分析器' },
    { name: 'swedish', description: '瑞典语分析器' },
    { name: 'thai', description: '泰语分析器' },
    { name: 'turkish', description: '土耳其语分析器' }
  ];
}
