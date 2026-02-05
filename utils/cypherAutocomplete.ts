/**
 * Cypher Query Autocomplete
 * Cypher 查询自动补全 - 关键字、标签、关系类型、属性
 */

import type { SchemaInfo } from '../services/neo4j';

export interface AutocompleteItem {
  label: string;
  type: 'keyword' | 'label' | 'relType' | 'property' | 'function' | 'clause';
  description?: string;
  insertText?: string;
}

// Cypher keywords
const CYPHER_KEYWORDS: AutocompleteItem[] = [
  // Clauses
  { label: 'MATCH', type: 'clause', description: '匹配图模式' },
  { label: 'OPTIONAL MATCH', type: 'clause', description: '可选匹配' },
  { label: 'WHERE', type: 'clause', description: '过滤条件' },
  { label: 'RETURN', type: 'clause', description: '返回结果' },
  { label: 'WITH', type: 'clause', description: '链接子句' },
  { label: 'CREATE', type: 'clause', description: '创建节点/关系' },
  { label: 'MERGE', type: 'clause', description: '匹配或创建' },
  { label: 'DELETE', type: 'clause', description: '删除节点/关系' },
  { label: 'DETACH DELETE', type: 'clause', description: '删除节点及其关系' },
  { label: 'SET', type: 'clause', description: '设置属性' },
  { label: 'REMOVE', type: 'clause', description: '移除属性/标签' },
  { label: 'ORDER BY', type: 'clause', description: '排序' },
  { label: 'LIMIT', type: 'clause', description: '限制结果数' },
  { label: 'SKIP', type: 'clause', description: '跳过结果' },
  { label: 'UNION', type: 'clause', description: '合并结果' },
  { label: 'UNION ALL', type: 'clause', description: '合并结果(含重复)' },
  { label: 'UNWIND', type: 'clause', description: '展开列表' },
  { label: 'CALL', type: 'clause', description: '调用存储过程' },
  { label: 'FOREACH', type: 'clause', description: '遍历列表' },
  { label: 'LOAD CSV', type: 'clause', description: '加载CSV文件' },
  
  // Keywords
  { label: 'AS', type: 'keyword', description: '别名' },
  { label: 'AND', type: 'keyword', description: '逻辑与' },
  { label: 'OR', type: 'keyword', description: '逻辑或' },
  { label: 'NOT', type: 'keyword', description: '逻辑非' },
  { label: 'XOR', type: 'keyword', description: '逻辑异或' },
  { label: 'IN', type: 'keyword', description: '包含于' },
  { label: 'IS NULL', type: 'keyword', description: '为空' },
  { label: 'IS NOT NULL', type: 'keyword', description: '不为空' },
  { label: 'STARTS WITH', type: 'keyword', description: '以...开头' },
  { label: 'ENDS WITH', type: 'keyword', description: '以...结尾' },
  { label: 'CONTAINS', type: 'keyword', description: '包含' },
  { label: 'DISTINCT', type: 'keyword', description: '去重' },
  { label: 'ASC', type: 'keyword', description: '升序' },
  { label: 'DESC', type: 'keyword', description: '降序' },
  { label: 'TRUE', type: 'keyword', description: '真' },
  { label: 'FALSE', type: 'keyword', description: '假' },
  { label: 'NULL', type: 'keyword', description: '空值' },
  { label: 'CASE', type: 'keyword', description: '条件表达式' },
  { label: 'WHEN', type: 'keyword', description: '条件分支' },
  { label: 'THEN', type: 'keyword', description: '条件结果' },
  { label: 'ELSE', type: 'keyword', description: '默认分支' },
  { label: 'END', type: 'keyword', description: '结束' },
  { label: 'EXISTS', type: 'keyword', description: '存在' },
  { label: 'ALL', type: 'keyword', description: '全部' },
  { label: 'ANY', type: 'keyword', description: '任意' },
  { label: 'NONE', type: 'keyword', description: '无' },
  { label: 'SINGLE', type: 'keyword', description: '单个' },
];

// Cypher functions
const CYPHER_FUNCTIONS: AutocompleteItem[] = [
  // Aggregate functions
  { label: 'count()', type: 'function', description: '计数', insertText: 'count($1)' },
  { label: 'sum()', type: 'function', description: '求和', insertText: 'sum($1)' },
  { label: 'avg()', type: 'function', description: '平均值', insertText: 'avg($1)' },
  { label: 'min()', type: 'function', description: '最小值', insertText: 'min($1)' },
  { label: 'max()', type: 'function', description: '最大值', insertText: 'max($1)' },
  { label: 'collect()', type: 'function', description: '收集为列表', insertText: 'collect($1)' },
  { label: 'stDev()', type: 'function', description: '标准差', insertText: 'stDev($1)' },
  { label: 'percentileDisc()', type: 'function', description: '百分位数', insertText: 'percentileDisc($1, $2)' },
  
  // String functions
  { label: 'toString()', type: 'function', description: '转为字符串', insertText: 'toString($1)' },
  { label: 'toUpper()', type: 'function', description: '转大写', insertText: 'toUpper($1)' },
  { label: 'toLower()', type: 'function', description: '转小写', insertText: 'toLower($1)' },
  { label: 'trim()', type: 'function', description: '去除空格', insertText: 'trim($1)' },
  { label: 'ltrim()', type: 'function', description: '去除左空格', insertText: 'ltrim($1)' },
  { label: 'rtrim()', type: 'function', description: '去除右空格', insertText: 'rtrim($1)' },
  { label: 'replace()', type: 'function', description: '替换', insertText: 'replace($1, $2, $3)' },
  { label: 'substring()', type: 'function', description: '子字符串', insertText: 'substring($1, $2, $3)' },
  { label: 'left()', type: 'function', description: '左截取', insertText: 'left($1, $2)' },
  { label: 'right()', type: 'function', description: '右截取', insertText: 'right($1, $2)' },
  { label: 'split()', type: 'function', description: '分割', insertText: 'split($1, $2)' },
  { label: 'reverse()', type: 'function', description: '反转', insertText: 'reverse($1)' },
  { label: 'size()', type: 'function', description: '大小/长度', insertText: 'size($1)' },
  
  // Numeric functions
  { label: 'toInteger()', type: 'function', description: '转为整数', insertText: 'toInteger($1)' },
  { label: 'toFloat()', type: 'function', description: '转为浮点数', insertText: 'toFloat($1)' },
  { label: 'abs()', type: 'function', description: '绝对值', insertText: 'abs($1)' },
  { label: 'ceil()', type: 'function', description: '向上取整', insertText: 'ceil($1)' },
  { label: 'floor()', type: 'function', description: '向下取整', insertText: 'floor($1)' },
  { label: 'round()', type: 'function', description: '四舍五入', insertText: 'round($1)' },
  { label: 'sign()', type: 'function', description: '符号', insertText: 'sign($1)' },
  { label: 'rand()', type: 'function', description: '随机数', insertText: 'rand()' },
  { label: 'sqrt()', type: 'function', description: '平方根', insertText: 'sqrt($1)' },
  { label: 'log()', type: 'function', description: '自然对数', insertText: 'log($1)' },
  { label: 'log10()', type: 'function', description: '常用对数', insertText: 'log10($1)' },
  { label: 'exp()', type: 'function', description: '指数', insertText: 'exp($1)' },
  
  // List functions
  { label: 'head()', type: 'function', description: '列表首元素', insertText: 'head($1)' },
  { label: 'tail()', type: 'function', description: '列表尾部', insertText: 'tail($1)' },
  { label: 'last()', type: 'function', description: '列表末元素', insertText: 'last($1)' },
  { label: 'range()', type: 'function', description: '生成范围', insertText: 'range($1, $2)' },
  { label: 'reduce()', type: 'function', description: '归约', insertText: 'reduce(s = 0, x IN $1 | s + x)' },
  
  // Graph functions
  { label: 'id()', type: 'function', description: '获取ID', insertText: 'id($1)' },
  { label: 'type()', type: 'function', description: '关系类型', insertText: 'type($1)' },
  { label: 'labels()', type: 'function', description: '节点标签', insertText: 'labels($1)' },
  { label: 'keys()', type: 'function', description: '属性键', insertText: 'keys($1)' },
  { label: 'properties()', type: 'function', description: '属性映射', insertText: 'properties($1)' },
  { label: 'nodes()', type: 'function', description: '路径节点', insertText: 'nodes($1)' },
  { label: 'relationships()', type: 'function', description: '路径关系', insertText: 'relationships($1)' },
  { label: 'length()', type: 'function', description: '路径长度', insertText: 'length($1)' },
  { label: 'startNode()', type: 'function', description: '起始节点', insertText: 'startNode($1)' },
  { label: 'endNode()', type: 'function', description: '终止节点', insertText: 'endNode($1)' },
  
  // Date/Time functions
  { label: 'date()', type: 'function', description: '日期', insertText: 'date()' },
  { label: 'datetime()', type: 'function', description: '日期时间', insertText: 'datetime()' },
  { label: 'time()', type: 'function', description: '时间', insertText: 'time()' },
  { label: 'timestamp()', type: 'function', description: '时间戳', insertText: 'timestamp()' },
  
  // Path functions
  { label: 'shortestPath()', type: 'function', description: '最短路径', insertText: 'shortestPath($1)' },
  { label: 'allShortestPaths()', type: 'function', description: '所有最短路径', insertText: 'allShortestPaths($1)' },
];

// Common query templates
const QUERY_TEMPLATES: AutocompleteItem[] = [
  { 
    label: 'MATCH (n) RETURN n LIMIT 25', 
    type: 'clause', 
    description: '查询所有节点',
    insertText: 'MATCH (n) RETURN n LIMIT 25'
  },
  { 
    label: 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100', 
    type: 'clause', 
    description: '查询节点和关系',
    insertText: 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100'
  },
  { 
    label: 'MATCH (n:Label) WHERE n.property = value RETURN n', 
    type: 'clause', 
    description: '按属性查询',
    insertText: 'MATCH (n:$1) WHERE n.$2 = $3 RETURN n'
  },
  { 
    label: 'CREATE (n:Label {property: value}) RETURN n', 
    type: 'clause', 
    description: '创建节点',
    insertText: 'CREATE (n:$1 {$2: $3}) RETURN n'
  },
  { 
    label: 'MATCH (a), (b) WHERE ... CREATE (a)-[r:TYPE]->(b)', 
    type: 'clause', 
    description: '创建关系',
    insertText: 'MATCH (a), (b) WHERE id(a) = $1 AND id(b) = $2 CREATE (a)-[r:$3]->(b) RETURN r'
  },
  { 
    label: 'EXPLAIN MATCH ...', 
    type: 'clause', 
    description: '查看执行计划',
    insertText: 'EXPLAIN '
  },
  { 
    label: 'PROFILE MATCH ...', 
    type: 'clause', 
    description: '分析查询性能',
    insertText: 'PROFILE '
  },
];

/**
 * 获取自动补全建议
 */
export function getAutocompleteSuggestions(
  query: string,
  cursorPosition: number,
  schema?: SchemaInfo | null
): AutocompleteItem[] {
  const textBeforeCursor = query.substring(0, cursorPosition);
  const words = textBeforeCursor.split(/[\s,()[\]{}:]+/);
  const currentWord = words[words.length - 1]?.toUpperCase() || '';
  
  const suggestions: AutocompleteItem[] = [];
  
  // Empty query - show templates
  if (!textBeforeCursor.trim()) {
    return QUERY_TEMPLATES;
  }
  
  // After colon - suggest labels or relationship types
  if (textBeforeCursor.endsWith(':')) {
    // Check if we're in a relationship pattern
    const isInRelationship = /\[\s*\w*:$/.test(textBeforeCursor);
    
    if (isInRelationship && schema) {
      // Suggest relationship types
      schema.relationships.forEach(rel => {
        suggestions.push({
          label: rel.type,
          type: 'relType',
          description: `${rel.count} 个关系`
        });
      });
    } else if (schema) {
      // Suggest node labels
      schema.labels.forEach(label => {
        suggestions.push({
          label: label.label,
          type: 'label',
          description: `${label.count} 个节点`
        });
      });
    }
    return suggestions;
  }
  
  // After dot - suggest properties
  if (/\w+\.$/.test(textBeforeCursor) && schema) {
    const allProperties = new Set<string>();
    schema.labels.forEach(l => l.properties.forEach(p => allProperties.add(p)));
    schema.relationships.forEach(r => r.properties.forEach(p => allProperties.add(p)));
    
    allProperties.forEach(prop => {
      suggestions.push({
        label: prop,
        type: 'property',
        description: '属性'
      });
    });
    return suggestions;
  }
  
  // Filter keywords and functions by current word
  if (currentWord.length > 0) {
    // Keywords
    CYPHER_KEYWORDS.forEach(kw => {
      if (kw.label.toUpperCase().startsWith(currentWord)) {
        suggestions.push(kw);
      }
    });
    
    // Functions
    CYPHER_FUNCTIONS.forEach(fn => {
      if (fn.label.toUpperCase().startsWith(currentWord)) {
        suggestions.push(fn);
      }
    });
    
    // Labels from schema
    if (schema) {
      schema.labels.forEach(label => {
        if (label.label.toUpperCase().startsWith(currentWord)) {
          suggestions.push({
            label: label.label,
            type: 'label',
            description: `${label.count} 个节点`
          });
        }
      });
      
      schema.relationships.forEach(rel => {
        if (rel.type.toUpperCase().startsWith(currentWord)) {
          suggestions.push({
            label: rel.type,
            type: 'relType',
            description: `${rel.count} 个关系`
          });
        }
      });
    }
  } else {
    // Show common keywords
    suggestions.push(...CYPHER_KEYWORDS.filter(kw => kw.type === 'clause'));
  }
  
  return suggestions;
}

/**
 * 获取关键字高亮信息
 */
export function getCypherTokens(query: string): Array<{ start: number; end: number; type: string }> {
  const tokens: Array<{ start: number; end: number; type: string }> = [];
  
  // Keywords regex
  const keywordPattern = /\b(MATCH|OPTIONAL|WHERE|RETURN|WITH|CREATE|MERGE|DELETE|DETACH|SET|REMOVE|ORDER|BY|LIMIT|SKIP|UNION|ALL|UNWIND|CALL|FOREACH|LOAD|CSV|AS|AND|OR|NOT|XOR|IN|IS|NULL|STARTS|ENDS|CONTAINS|DISTINCT|ASC|DESC|TRUE|FALSE|CASE|WHEN|THEN|ELSE|END|EXISTS|ANY|NONE|SINGLE|YIELD|EXPLAIN|PROFILE)\b/gi;
  
  let match;
  while ((match = keywordPattern.exec(query)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'keyword'
    });
  }
  
  // Function pattern
  const functionPattern = /\b(count|sum|avg|min|max|collect|stDev|toString|toUpper|toLower|trim|replace|substring|split|reverse|size|toInteger|toFloat|abs|ceil|floor|round|sign|rand|sqrt|log|exp|head|tail|last|range|reduce|id|type|labels|keys|properties|nodes|relationships|length|startNode|endNode|date|datetime|time|timestamp|shortestPath|allShortestPaths)\s*\(/gi;
  
  while ((match = functionPattern.exec(query)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length - 1, // Exclude the opening paren
      type: 'function'
    });
  }
  
  // String literals
  const stringPattern = /'[^']*'|"[^"]*"/g;
  while ((match = stringPattern.exec(query)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'string'
    });
  }
  
  // Numbers
  const numberPattern = /\b\d+(\.\d+)?\b/g;
  while ((match = numberPattern.exec(query)) !== null) {
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'number'
    });
  }
  
  return tokens;
}
