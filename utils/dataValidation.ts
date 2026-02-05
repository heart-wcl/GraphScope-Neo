/**
 * 数据验证工具
 *
 * 功能：
 * - 验证节点和关系数据的有效性
 * - 提供数据清理和修复
 * - 处理边界情况
 *
 * 设计原则：
 * - 不依赖具体的渲染方式（Canvas、SVG、WebGL等）
 * - 提供纯函数的数据验证
 * - 支持自定义验证规则
 */

import type { Neo4jNode, Neo4jRelationship, GraphData } from '../types';

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: GraphData;
}

/**
 * 验证节点
 */
export interface NodeValidationResult {
  isValid: boolean;
  errors: string[];
  node?: Neo4jNode;
}

/**
 * 验证关系
 */
export interface RelationshipValidationResult {
  isValid: boolean;
  errors: string[];
  relationship?: Neo4jRelationship;
}

/**
 * 验证选项
 */
export interface ValidationOptions {
  maxNodes?: number;
  maxRelationships?: number;
  requireLabels?: boolean;
  requireId?: boolean;
  requireCoordinates?: boolean;
}

/**
 * 默认验证选项
 */
const DEFAULT_VALIDATION_OPTIONS: Required<ValidationOptions> = {
  maxNodes: 10000,
  maxRelationships: 20000,
  requireLabels: true,
  requireId: true,
  requireCoordinates: false,
};

/**
 * 验证节点数据
 */
export function validateNode(
  node: any,
  options: ValidationOptions = {}
): NodeValidationResult {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  const errors: string[] = [];

  // 检查必需字段
  if (opts.requireId && !node.id) {
    errors.push('节点缺少 id 字段');
  }

  if (opts.requireLabels && (!node.labels || !Array.isArray(node.labels))) {
    errors.push('节点缺少 labels 字段或 labels 不是数组');
  }

  // 检查属性
  if (node.properties && typeof node.properties !== 'object') {
    errors.push('节点的 properties 字段不是对象');
  }

  // 检查坐标
  if (opts.requireCoordinates) {
    if (node.x === undefined || node.y === undefined) {
      errors.push('节点缺少坐标 (x, y)');
    } else if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      errors.push('节点坐标 (x, y) 不是数字');
    }
  }

  // 检查半径
  if (node.radius !== undefined && typeof node.radius !== 'number') {
    errors.push('节点的 radius 字段不是数字');
  }

  // 检查颜色
  if (node.color !== undefined && typeof node.color !== 'string') {
    errors.push('节点的 color 字段不是字符串');
  }

  return {
    isValid: errors.length === 0,
    errors,
    node: errors.length === 0 ? node : undefined,
  };
}

/**
 * 验证关系数据
 */
export function validateRelationship(
  relationship: any,
  options: ValidationOptions = {}
): RelationshipValidationResult {
  const errors: string[] = [];

  // 检查必需字段
  if (!relationship.id) {
    errors.push('关系缺少 id 字段');
  }

  if (!relationship.type) {
    errors.push('关系缺少 type 字段');
  }

  if (!relationship.startNode) {
    errors.push('关系缺少 startNode 字段');
  }

  if (!relationship.endNode) {
    errors.push('关系缺少 endNode 字段');
  }

  // 检查属性
  if (relationship.properties && typeof relationship.properties !== 'object') {
    errors.push('关系的 properties 字段不是对象');
  }

  return {
    isValid: errors.length === 0,
    errors,
    relationship: errors.length === 0 ? relationship : undefined,
  };
}

/**
 * 验证图数据
 */
export function validateGraphData(
  data: any,
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查数据结构
  if (!data || typeof data !== 'object') {
    errors.push('数据不是对象');
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  if (!Array.isArray(data.nodes)) {
    errors.push('nodes 字段不是数组');
  }

  if (!Array.isArray(data.links)) {
    errors.push('links 字段不是数组');
  }

  // 检查节点数量
  if (data.nodes && data.nodes.length > opts.maxNodes) {
    errors.push(
      `节点数量 (${data.nodes.length}) 超过最大限制 (${opts.maxNodes})`
    );
  }

  if (data.links && data.links.length > opts.maxRelationships) {
    errors.push(
      `关系数量 (${data.links.length}) 超过最大限制 (${opts.maxRelationships})`
    );
  }

  // 验证节点
  const validNodes: Neo4jNode[] = [];
  if (data.nodes) {
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      const result = validateNode(node, options);

      if (result.isValid) {
        validNodes.push(result.node!);
      } else {
        errors.push(`节点 ${i} 无效: ${result.errors.join(', ')}`);
      }
    }
  }

  // 验证关系
  const validRelationships: Neo4jRelationship[] = [];
  const nodeIdSet = new Set(validNodes.map((n) => n.id));

  if (data.links) {
    for (let i = 0; i < data.links.length; i++) {
      const link = data.links[i];
      const result = validateRelationship(link, options);

      if (result.isValid) {
        const rel = result.relationship!;

        // 检查节点是否存在
        if (!nodeIdSet.has(rel.startNode)) {
          warnings.push(
            `关系 ${i}: 起始节点 ${rel.startNode} 不存在，将被忽略`
          );
        } else if (!nodeIdSet.has(rel.endNode)) {
          warnings.push(
            `关系 ${i}: 终止节点 ${rel.endNode} 不存在，将被忽略`
          );
        } else {
          validRelationships.push(rel);
        }
      } else {
        errors.push(`关系 ${i} 无效: ${result.errors.join(', ')}`);
      }
    }
  }

  // 检查孤立节点
  const connectedNodeIds = new Set([
    ...validRelationships.map((r) => r.startNode),
    ...validRelationships.map((r) => r.endNode),
  ]);

  const isolatedNodes = validNodes.filter((n) => !connectedNodeIds.has(n.id));

  if (isolatedNodes.length > 0) {
    warnings.push(
      `发现 ${isolatedNodes.length} 个孤立节点（没有任何关系）`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    data: {
      nodes: validNodes,
      links: validRelationships,
    },
  };
}

/**
 * 清理和修复图数据
 */
export function sanitizeGraphData(
  data: any,
  options: ValidationOptions = {}
): GraphData {
  const validation = validateGraphData(data, options);

  if (!validation.isValid || !validation.data) {
    // 返回空数据
    return {
      nodes: [],
      links: [],
    };
  }

  return validation.data;
}

/**
 * 生成随机节点坐标（用于没有坐标的节点）
 */
export function generateNodeCoordinates(
  nodes: Neo4jNode[],
  width: number,
  height: number
): Neo4jNode[] {
  return nodes.map((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      return node;
    }

    // 在画布中心附近随机生成坐标
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;

    return {
      ...node,
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
    };
  });
}

/**
 * 截断大型数据集（用于处理超大数据集）
 */
export function truncateGraphData(
  data: GraphData,
  maxNodes: number = 1000,
  maxRelationships: number = 2000
): GraphData {
  if (data.nodes.length <= maxNodes && data.links.length <= maxRelationships) {
    return data;
  }

  // 保留前 maxNodes 个节点
  const truncatedNodes = data.nodes.slice(0, maxNodes);
  const nodeIdSet = new Set(truncatedNodes.map((n) => n.id));

  // 只保留与保留节点相关的关系
  const truncatedLinks = data.links.filter(
    (link) =>
      nodeIdSet.has(link.startNode) && nodeIdSet.has(link.endNode)
  );

  // 如果关系仍然过多，进一步截断
  const finalLinks =
    truncatedLinks.length > maxRelationships
      ? truncatedLinks.slice(0, maxRelationships)
      : truncatedLinks;

  return {
    nodes: truncatedNodes,
    links: finalLinks,
  };
}
