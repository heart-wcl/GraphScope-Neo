/**
 * Viewport Culling Utility
 * 视锥体裁剪 - 只渲染可见区域内的元素
 */

import type { Viewport, CullingConfig, Neo4jNode, Neo4jRelationship } from '../../types';

/**
 * 获取当前视口信息（基于 D3 zoom transform）
 */
export function getViewport(
  svgWidth: number,
  svgHeight: number,
  transform: { x: number; y: number; k: number }
): Viewport {
  return {
    x: -transform.x / transform.k,
    y: -transform.y / transform.k,
    width: svgWidth / transform.k,
    height: svgHeight / transform.k,
    zoom: transform.k
  };
}

/**
 * 判断节点是否在视口可见区域内
 */
export function isNodeVisible(
  node: Neo4jNode,
  viewport: Viewport,
  config: CullingConfig = { padding: 50, minZoom: 0.1, maxZoom: 8.0 }
): boolean {
  const { x, y } = node;
  if (x === undefined || y === undefined) return false;

  const padding = config.padding;

  return (
    x >= viewport.x - padding &&
    x <= viewport.x + viewport.width + padding &&
    y >= viewport.y - padding &&
    y <= viewport.y + viewport.height + padding
  );
}

/**
 * 过滤可见节点
 */
export function filterVisibleNodes(
  nodes: Neo4jNode[],
  viewport: Viewport,
  config?: CullingConfig
): Neo4jNode[] {
  return nodes.filter(node => isNodeVisible(node, viewport, config));
}

/**
 * 判断关系是否可见（至少有一个端点可见）
 */
export function isRelationshipVisible(
  relationship: Neo4jRelationship,
  visibleNodeIds: Set<string>
): boolean {
  return visibleNodeIds.has(relationship.startNode) && 
         visibleNodeIds.has(relationship.endNode);
}

/**
 * 过滤可见关系
 */
export function filterVisibleRelationships(
  relationships: Neo4jRelationship[],
  visibleNodeIds: Set<string>
): Neo4jRelationship[] {
  return relationships.filter(rel => 
    isRelationshipVisible(rel, visibleNodeIds)
  );
}

/**
 * 过滤可见元素（节点和关系）
 * 性能优化：一次遍历完成节点过滤，然后过滤关系
 */
export function filterVisibleElements(
  nodes: Neo4jNode[],
  relationships: Neo4jRelationship[],
  viewport: Viewport,
  config?: CullingConfig
): { nodes: Neo4jNode[]; relationships: Neo4jRelationship[] } {
  // 先过滤节点
  const visibleNodes = filterVisibleNodes(nodes, viewport, config);
  
  // 构建可见节点 ID 集合（O(1) 查找）
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  
  // 过滤关系
  const visibleRelationships = filterVisibleRelationships(
    relationships,
    visibleNodeIds
  );
  
  return { nodes: visibleNodes, relationships: visibleRelationships };
}

/**
 * 计算裁剪率（用于性能监控）
 */
export function calculateCullRate(
  totalNodes: number,
  visibleNodes: number
): number {
  if (totalNodes === 0) return 0;
  return 1 - (visibleNodes / totalNodes);
}

/**
 * 获取视口中心点
 */
export function getViewportCenter(viewport: Viewport): { x: number; y: number } {
  return {
    x: viewport.x + viewport.width / 2,
    y: viewport.y + viewport.height / 2
  };
}

/**
 * 判断视口是否发生变化（用于优化渲染触发）
 */
export function hasViewportChanged(
  prev: Viewport,
  current: Viewport,
  threshold: number = 1 // 像素阈值
): boolean {
  return (
    Math.abs(prev.x - current.x) > threshold ||
    Math.abs(prev.y - current.y) > threshold ||
    Math.abs(prev.width - current.width) > threshold ||
    Math.abs(prev.height - current.height) > threshold ||
    Math.abs(prev.zoom - current.zoom) > 0.01
  );
}
