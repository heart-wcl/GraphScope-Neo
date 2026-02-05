/**
 * LOD Renderer Utility
 * 细节层次渲染 - 根据缩放级别动态调整渲染细节
 */

import * as d3 from 'd3';
import type { RenderMode, LODConfig, Neo4jNode, Neo4jRelationship } from '../../types';

// 重新导出类型和常量
export type { RenderMode, LODConfig, Neo4jNode, Neo4jRelationship } from '../../types';

// 重新导出 LOD 工具函数（从 types 导入并重新导出）
export {
  getRenderMode,
  getNodeSize,
  shouldShowLabels,
  DEFAULT_LOD_CONFIG
} from '../../types/performance/lod';

/**
 * 渲染 LOD 模式下的节点（简洁现代风格）
 */
export function renderNodeByLOD(
  ctx: CanvasRenderingContext2D,
  node: Neo4jNode,
  mode: RenderMode,
  config: LODConfig
): void {
  const { x, y } = node;
  if (x === undefined || y === undefined) return;

  const size = node.radius || 20;
  const color = node.color || '#00F2FF';

  switch (mode) {
    case 'dots':
      // 简单实心点
      ctx.beginPath();
      ctx.arc(x, y, config.nodeSize.dot, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      break;

    case 'simple':
      // 带边框的圆点
      ctx.beginPath();
      ctx.arc(x, y, config.nodeSize.simple, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0E14'; // 背景色填充，遮挡线条
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(x, y, config.nodeSize.simple, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // 亮色边框
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;

    case 'with-labels':
      // 简洁标签模式
      // 背景遮挡
      ctx.beginPath();
      ctx.arc(x, y, config.nodeSize.labeled, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0E14';
      ctx.fill();

      // 主体
      ctx.beginPath();
      ctx.arc(x, y, config.nodeSize.labeled, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha(color, 0.2); // 半透明填充
      ctx.fill();
      
      // 边框
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 内部实心圆
      ctx.beginPath();
      ctx.arc(x, y, config.nodeSize.labeled - 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (config.labelConfig.enabled) {
        renderShortLabel(ctx, node, x, y, config);
      }
      break;

    case 'full':
      // 完整模式：清晰的图标和标签
      // 背景遮挡（避免连线穿过节点内部）
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0E14';
      ctx.fill();

      // 1. 外部光环（仅一点点，增加层次）
      ctx.beginPath();
      ctx.arc(x, y, size + 2, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(color, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. 节点主体背景 (深色玻璃感)
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha(color, 0.1);
      ctx.fill();

      // 3. 节点边框 (高亮)
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 4. 内部装饰圈
      ctx.beginPath();
      ctx.arc(x, y, size - 3, 0, Math.PI * 2);
      ctx.strokeStyle = colorWithAlpha(color, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();

      // 绘制图标
      renderNodeIcon(ctx, node, x, y, size, '#FFFFFF'); // 图标始终白色，保证清晰

      // 完整标签
      if (config.labelConfig.enabled) {
        renderFullLabel(ctx, node, x, y, size, config);
      }
      break;
  }
}

/**
 * 渲染光晕效果 - 已移除，保持画面干净
 */
function renderGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  intensity: number
): void {
  // 留空或移除
}

/**
 * 颜色加亮
 */
function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `rgb(${R}, ${G}, ${B})`;
}

/**
 * 颜色加透明度
 */
function colorWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const num = parseInt(color.replace('#', ''), 16);
    const R = (num >> 16) & 0xFF;
    const G = (num >> 8) & 0xFF;
    const B = num & 0xFF;
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
  }
  return color;
}

/**
 * 渲染简短标签（简洁版）
 */
function renderShortLabel(
  ctx: CanvasRenderingContext2D,
  node: Neo4jNode,
  x: number,
  y: number,
  config: LODConfig
): void {
  const label = getShortLabel(node, config.labelConfig.maxLength);
  if (!label) return;

  const fontSize = config.labelConfig.fontSize.short;
  ctx.font = `500 ${fontSize}px "Inter", system-ui, sans-serif`;
  
  // 无阴影，纯色
  ctx.fillStyle = '#E2E8F0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y + config.nodeSize.labeled + 6);
}

/**
 * 渲染完整标签（简洁版）
 */
function renderFullLabel(
  ctx: CanvasRenderingContext2D,
  node: Neo4jNode,
  x: number,
  y: number,
  radius: number,
  config: LODConfig
): void {
  const name = getNodeLabel(node);
  const typeLabel = node.labels[0] || '';
  
  // 类型标签（小字）
  ctx.font = `400 9px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  const color = node.color || '#00F2FF';
  ctx.fillStyle = colorWithAlpha(color, 0.8);
  ctx.fillText(typeLabel, x, y + radius + 6);
  
  // 名称标签（正常字）
  if (name) {
    ctx.font = `500 ${config.labelConfig.fontSize.full}px "Inter", system-ui, sans-serif`;
    
    // 简单的深色描边保证在任何背景可见
    ctx.strokeStyle = '#0B0E14';
    ctx.lineWidth = 2;
    ctx.strokeText(name, x, y + radius + 18);
    
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(name, x, y + radius + 18);
  }
}

/**
 * 渲染节点图标（优化版 - 使用 SVG 路径绘制矢量图标）
 */
function renderNodeIcon(
  ctx: CanvasRenderingContext2D,
  node: Neo4jNode,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const label = node.labels[0]?.toLowerCase() || '';
  const iconSize = size * 0.5;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(iconSize / 12, iconSize / 12);
  
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (label.includes('person') || label.includes('user') || label.includes('employee') || label.includes('customer')) {
    // 人物图标
    ctx.beginPath();
    ctx.arc(0, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 8);
    ctx.quadraticCurveTo(-6, 2, 0, 2);
    ctx.quadraticCurveTo(6, 2, 6, 8);
    ctx.fill();
  } else if (label.includes('movie') || label.includes('film')) {
    // 电影图标
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 12, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, -2);
    ctx.lineTo(-3, 2);
    ctx.lineTo(2, 0);
    ctx.closePath();
    ctx.fill();
  } else if (label.includes('product')) {
    // 产品/盒子图标
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(8, -3);
    ctx.lineTo(8, 5);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-8, -3);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 10);
    ctx.moveTo(-8, -3);
    ctx.lineTo(8, -3);
    ctx.stroke();
  } else if (label.includes('order') || label.includes('invoice')) {
    // 订单/文档图标
    ctx.beginPath();
    ctx.roundRect(-6, -8, 12, 16, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, -4);
    ctx.lineTo(3, -4);
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.moveTo(-3, 4);
    ctx.lineTo(1, 4);
    ctx.stroke();
  } else if (label.includes('category') || label.includes('tag')) {
    // 分类/标签图标
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(0, -8);
    ctx.lineTo(8, -2);
    ctx.lineTo(8, 6);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (label.includes('company') || label.includes('organization') || label.includes('supplier')) {
    // 公司/组织图标
    ctx.beginPath();
    ctx.roundRect(-7, -6, 14, 14, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(-4, -3, 3, 3, 0.5);
    ctx.roundRect(1, -3, 3, 3, 0.5);
    ctx.roundRect(-4, 2, 3, 3, 0.5);
    ctx.roundRect(1, 2, 3, 3, 0.5);
    ctx.fill();
  } else if (label.includes('location') || label.includes('city') || label.includes('region') || label.includes('territory')) {
    // 位置图标
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(-8, 0, -8, -3);
    ctx.arc(0, -3, 8, Math.PI, 0, false);
    ctx.quadraticCurveTo(8, 0, 0, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -3, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (label.includes('time') || label.includes('date') || label.includes('shipper')) {
    // 时间/快递图标
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 0);
    ctx.lineTo(4, 3);
    ctx.stroke();
  } else {
    // 默认六边形图标
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const px = Math.cos(angle) * 7;
      const py = Math.sin(angle) * 7;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * 渲染 LOD 模式下的关系（简洁版 + 流光效果）
 */
export function renderRelationshipByLOD(
  ctx: CanvasRenderingContext2D,
  relationship: Neo4jRelationship,
  sourceNode: Neo4jNode,
  targetNode: Neo4jNode,
  mode: RenderMode,
  config: LODConfig,
  time: number = 0 // 添加时间参数
): void {
  const { x: x1, y: y1 } = sourceNode;
  const { x: x2, y: y2 } = targetNode;

  if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return;

  // 计算从节点边缘开始的线段
  const sourceRadius = sourceNode.radius || 20;
  const targetRadius = targetNode.radius || 20;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  const startX = x1 + Math.cos(angle) * (sourceRadius + 3);
  const startY = y1 + Math.sin(angle) * (sourceRadius + 3);
  const endX = x2 - Math.cos(angle) * (targetRadius + 6);
  const endY = y2 - Math.sin(angle) * (targetRadius + 6);

  // 1. 绘制基础连线
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  // 使用较暗的灰色作为连线，不抢眼
  ctx.strokeStyle = '#334155'; // Slate-700
  ctx.lineWidth = mode === 'dots' ? 1 : 1.5;
  ctx.stroke();

  // 2. 绘制流动粒子 (仅在非 dots 模式下)
  if (mode !== 'dots') {
    // 基于 ID 生成随机偏移，使不同连线的流动不同步
    const idNum = parseInt(relationship.id) || 0;
    const offset = (idNum % 100) / 100;
    const speed = 0.5; // 速度
    const progress = (time * speed + offset) % 1;
    
    const particleX = startX + (endX - startX) * progress;
    const particleY = startY + (endY - startY) * progress;

    // 绘制流光粒子（使用径向渐变制作细腻的泛光效果）
    const glowRadius = 5;
    const gradient = ctx.createRadialGradient(particleX, particleY, 0, particleX, particleY, glowRadius);
    
    // 核心高亮
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    // 中间过渡
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    // 边缘消散
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(particleX, particleY, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // 在非点模式下绘制箭头
  if (mode !== 'dots') {
    renderArrow(ctx, startX, startY, endX, endY, '#475569'); // Slate-600
  }

  // 在标签模式下绘制关系类型标签
  if (mode === 'with-labels' || mode === 'full') {
    renderRelationshipLabel(ctx, relationship, startX, startY, endX, endY, '#94A3B8'); // Slate-400
  }
}

/**
 * 渲染箭头（简洁锐利版）
 */
function renderArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowLength = 8; // 稍微变小

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - arrowLength * Math.cos(angle - Math.PI / 6),
    y2 - arrowLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - arrowLength * Math.cos(angle + Math.PI / 6),
    y2 - arrowLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * 渲染关系类型标签（极简版）
 */
function renderRelationshipLabel(
  ctx: CanvasRenderingContext2D,
  relationship: Neo4jRelationship,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
): void {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const text = relationship.type;
  ctx.font = '9px "Inter", system-ui, sans-serif';
  const metrics = ctx.measureText(text);
  const paddingX = 4;
  const height = 12;
  const width = metrics.width + paddingX * 2;

  // 纯色背景，无边框
  ctx.fillStyle = '#0B0E14';
  ctx.fillRect(midX - width / 2, midY - height / 2, width, height);

  // 文本
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, midX, midY);
}

/**
 * 获取简短标签
 */
function getShortLabel(node: Neo4jNode, maxLength: number): string {
  const label = getNodeLabel(node);
  if (!label) return node.labels[0] || '';
  return label.length > maxLength ? label.slice(0, maxLength) + '...' : label;
}

/**
 * 获取节点标签
 */
function getNodeLabel(node: Neo4jNode): string {
  const nameProp = Object.keys(node.properties).find(k =>
    k.toLowerCase().includes('name') ||
    k.toLowerCase().includes('title') ||
    k.toLowerCase().includes('email')
  );
  return nameProp ? String(node.properties[nameProp]) : '';
}
