import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphData, Neo4jNode, Neo4jRelationship, PerformanceMetrics } from '../types';
import {
  getRenderMode,
  getNodeSize,
  shouldShowLabels,
  renderNodeByLOD,
  renderRelationshipByLOD
} from '../utils/performance/lodRenderer';
import {
  getViewport,
  filterVisibleElements,
  calculateCullRate
} from '../utils/performance/viewportCulling';
import {
  DEFAULT_CULLING_CONFIG,
  DEFAULT_LOD_CONFIG,
  type CullingConfig,
  type LODConfig
} from '../types/performance';
import { useTheme } from '../contexts/ThemeContext';
import PerformanceMonitor from './PerformanceMonitor';

interface OptimizedGraphCanvasProps {
  data: GraphData;
  onNodeClick: (node: Neo4jNode) => void;
  onRelationshipClick?: (relationship: Neo4jRelationship) => void;
  onAddRelationship?: (node: Neo4jNode) => void;
  width: number;
  height: number;
  isLoading?: boolean;
}

// 节点浮动状态
interface FloatState {
  offsetX: number;
  offsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  phase: number; // 动画相位
}

const OptimizedGraphCanvas: React.FC<OptimizedGraphCanvasProps> = ({
  data,
  onNodeClick,
  onRelationshipClick,
  onAddRelationship,
  width,
  height,
  isLoading = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [performanceMonitorVisible, setPerformanceMonitorVisible] = useState(true);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  const { theme } = useTheme();

  // 存储节点的基础位置和浮动状态
  const nodePositionsRef = useRef<Map<string, { baseX: number; baseY: number }>>(new Map());
  const floatStatesRef = useRef<Map<string, FloatState>>(new Map());
  const transformRef = useRef(d3.zoomIdentity);
  const draggedNodeRef = useRef<Neo4jNode | null>(null);
  const hoveredNodeRef = useRef<Neo4jNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const renderStartTimeRef = useRef(0);

  const updatePerformanceMetrics = useCallback((
    visibleNodes: Neo4jNode[],
    visibleLinks: Neo4jRelationship[],
    renderTime: number
  ) => {
    frameCountRef.current++;
    const now = Date.now();

    if (now - lastFpsUpdateRef.current >= 1000) {
      const fps = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;

      const memory = (performance as any).memory 
        ? (performance as any).memory.usedJSHeapSize / 1024 / 1024 
        : 100;

      setPerformanceMetrics({
        fps,
        renderTime,
        memory,
        visibleNodes: visibleNodes.length,
        visibleLinks: visibleLinks.length,
        totalNodes: data.nodes.length,
        totalLinks: data.links.length,
        cullRate: calculateCullRate(data.nodes.length, visibleNodes.length)
      });
    }
  }, [data.nodes.length, data.links.length]);

  useEffect(() => {
    if (!canvasRef.current || !data.nodes.length || width === 0 || height === 0) return;

    // 初始化节点位置（使用力导向布局计算初始位置，然后固定）
    const initializeNodePositions = () => {
      const existingPositions = nodePositionsRef.current;
      const needsInit = data.nodes.some(n => !existingPositions.has(n.id)) || existingPositions.size === 0;

      if (needsInit) {
        // 先给所有没有位置的节点分配随机初始位置
        data.nodes.forEach(node => {
          if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) {
            node.x = width / 2 + (Math.random() - 0.5) * 500;
            node.y = height / 2 + (Math.random() - 0.5) * 500;
          }
        });

        // 使用力导向模拟计算初始布局（稀疏的参数）
        const simulation = d3.forceSimulation<Neo4jNode>(data.nodes)
          .force('link', d3.forceLink<Neo4jNode, Neo4jRelationship>(data.links)
            .id(d => d.id)
            .distance(180)  // 显著增加链接距离 (85 -> 180)
            .strength(0.5)) // 降低链接拉力
          .force('charge', d3.forceManyBody().strength(-500)) // 大幅增加斥力 (-120 -> -500)
          .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05)) // 降低向心力
          .force('collide', d3.forceCollide().radius(d => (d.radius || 20) + 60)) // 大幅增加碰撞半径 (+15 -> +60)
          .force('x', d3.forceX(width / 2).strength(0.01)) // 极弱的水平聚拢
          .force('y', d3.forceY(height / 2).strength(0.01)) // 极弱的垂直聚拢
          .stop();

        // 运行模拟直到稳定
        for (let i = 0; i < 300; i++) {
          simulation.tick();
        }

        // 保存计算出的位置作为基础位置
        data.nodes.forEach(node => {
          const x = node.x !== undefined && !isNaN(node.x) ? node.x : width / 2;
          const y = node.y !== undefined && !isNaN(node.y) ? node.y : height / 2;
          
          nodePositionsRef.current.set(node.id, {
            baseX: x,
            baseY: y
          });
          
          // 初始化浮动状态
          if (!floatStatesRef.current.has(node.id)) {
            floatStatesRef.current.set(node.id, {
              offsetX: 0,
              offsetY: 0,
              targetOffsetX: (Math.random() - 0.5) * 6,
              targetOffsetY: (Math.random() - 0.5) * 6,
              phase: Math.random() * Math.PI * 2
            });
          }
        });
      }
    };

    initializeNodePositions();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 画布缩放和平移
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8.0])
      .filter((event) => {
        // 如果正在拖拽节点，禁用画布缩放/平移
        if (draggedNodeRef.current) return false;
        return true;
      })
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        setZoomLevel(event.transform.k);
      });

    d3.select(canvas).call(zoom);

    // 更新浮动动画
    const updateFloatAnimation = () => {
      const time = Date.now() / 1000;
      
      floatStatesRef.current.forEach((state, nodeId) => {
        // 缓慢移动到目标偏移
        state.offsetX += (state.targetOffsetX - state.offsetX) * 0.02;
        state.offsetY += (state.targetOffsetY - state.offsetY) * 0.02;

        // 添加轻微的正弦波动
        const sineOffset = Math.sin(time * 0.5 + state.phase) * 2;
        state.offsetX += sineOffset * 0.01;
        state.offsetY += Math.cos(time * 0.3 + state.phase) * 2 * 0.01;

        // 定期更新目标偏移（每隔一段时间随机改变方向）
        if (Math.random() < 0.005) {
          state.targetOffsetX = (Math.random() - 0.5) * 8;
          state.targetOffsetY = (Math.random() - 0.5) * 8;
        }
      });
    };

    // 获取节点的实际渲染位置（基础位置 + 浮动偏移）
    const getNodeRenderPosition = (node: Neo4jNode) => {
      let basePos = nodePositionsRef.current.get(node.id);
      
      // 如果没有基础位置，创建一个
      if (!basePos) {
        const x = node.x !== undefined && !isNaN(node.x) ? node.x : width / 2 + (Math.random() - 0.5) * 200;
        const y = node.y !== undefined && !isNaN(node.y) ? node.y : height / 2 + (Math.random() - 0.5) * 200;
        basePos = { baseX: x, baseY: y };
        nodePositionsRef.current.set(node.id, basePos);
        
        // 同时初始化浮动状态
        if (!floatStatesRef.current.has(node.id)) {
          floatStatesRef.current.set(node.id, {
            offsetX: 0,
            offsetY: 0,
            targetOffsetX: (Math.random() - 0.5) * 6,
            targetOffsetY: (Math.random() - 0.5) * 6,
            phase: Math.random() * Math.PI * 2
          });
        }
      }
      
      const floatState = floatStatesRef.current.get(node.id);

      // 如果节点正在被拖拽，使用拖拽位置（无浮动）
      if (draggedNodeRef.current?.id === node.id) {
        return { x: basePos.baseX, y: basePos.baseY };
      }

      return {
        x: basePos.baseX + (floatState?.offsetX || 0),
        y: basePos.baseY + (floatState?.offsetY || 0)
      };
    };

    const render = () => {
      renderStartTimeRef.current = performance.now();

      // 更新浮动动画
      updateFloatAnimation();

      // 清空 Canvas
      ctx.clearRect(0, 0, width, height);

      // 应用变换
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      // 获取当前视口
      const currentViewport = getViewport(width, height, transformRef.current);
      const lodConfig = DEFAULT_LOD_CONFIG;
      const cullingConfig = DEFAULT_CULLING_CONFIG;

      // 确定渲染模式（LOD）
      const renderMode = getRenderMode(currentViewport.zoom, lodConfig);

      // 更新节点的渲染位置
      data.nodes.forEach(node => {
        const pos = getNodeRenderPosition(node);
        node.x = pos.x;
        node.y = pos.y;
      });

      // 性能优化：视锥体裁剪（只渲染可见元素）
      const { nodes: visibleNodes, relationships: visibleLinks } = filterVisibleElements(
        data.nodes,
        data.links,
        currentViewport,
        cullingConfig
      );

      // 创建可见节点的 Map，用于快速查找
      const visibleNodeMap = new Map(visibleNodes.map(n => [n.id, n]));

      // 绘制关系
      const time = Date.now() / 1000;
      visibleLinks.forEach(link => {
        const sourceNode = visibleNodeMap.get(link.startNode) as Neo4jNode;
        const targetNode = visibleNodeMap.get(link.endNode) as Neo4jNode;

        if (sourceNode && targetNode) {
          renderRelationshipByLOD(
            ctx,
            link,
            sourceNode,
            targetNode,
            renderMode,
            lodConfig,
            time
          );
        }
      });

      // 绘制节点
      visibleNodes.forEach(node => {
        renderNodeByLOD(ctx, node, renderMode, lodConfig);

        // 绘制选中状态
        if (selectedNodeId === node.id) {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, (node.radius || 20) + 5, 0, Math.PI * 2);
          ctx.strokeStyle = '#00F2FF';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // 绘制悬停状态
        if (hoveredNodeRef.current?.id === node.id) {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, (node.radius || 20) + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // 绘制标签
      if (shouldShowLabels(renderMode, lodConfig)) {
        ctx.fillStyle = theme === 'dark' ? '#FFFFFF' : '#000000';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        visibleNodes.forEach(node => {
          const label = node.properties.name || node.labels[0];
          if (label) {
            ctx.fillText(String(label), node.x!, node.y! + (node.radius || 20) + 12);
          }
        });
      }

      ctx.restore();

      const renderTime = performance.now() - renderStartTimeRef.current;
      updatePerformanceMetrics(visibleNodes, visibleLinks, renderTime);

      // 继续动画循环
      animationFrameRef.current = requestAnimationFrame(render);
    };

    // 辅助函数：将屏幕坐标转换为画布坐标
    const screenToCanvas = (screenX: number, screenY: number) => {
      const transform = transformRef.current;
      return {
        x: (screenX - transform.x) / transform.k,
        y: (screenY - transform.y) / transform.k
      };
    };

    // 辅助函数：查找点击位置的节点
    const findNodeAtPosition = (canvasX: number, canvasY: number) => {
      return data.nodes.find(node => {
        const pos = getNodeRenderPosition(node);
        const dx = pos.x - canvasX;
        const dy = pos.y - canvasY;
        return Math.sqrt(dx * dx + dy * dy) < (node.radius || 20);
      });
    };

    // 鼠标事件处理
    let isDraggingNode = false;

    canvas.addEventListener('mousedown', (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const { x, y } = screenToCanvas(screenX, screenY);

      const clickedNode = findNodeAtPosition(x, y);

      if (clickedNode) {
        isDraggingNode = true;
        draggedNodeRef.current = clickedNode;
        canvas.style.cursor = 'grabbing';
        event.stopPropagation();
      }
    });

    canvas.addEventListener('mousemove', (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const { x, y } = screenToCanvas(screenX, screenY);

      if (isDraggingNode && draggedNodeRef.current) {
        // 更新被拖拽节点的基础位置
        const basePos = nodePositionsRef.current.get(draggedNodeRef.current.id);
        if (basePos) {
          basePos.baseX = x;
          basePos.baseY = y;
        }
        // 重置浮动偏移
        const floatState = floatStatesRef.current.get(draggedNodeRef.current.id);
        if (floatState) {
          floatState.offsetX = 0;
          floatState.offsetY = 0;
          floatState.targetOffsetX = 0;
          floatState.targetOffsetY = 0;
        }
      } else {
        // 检测悬停
        const hovered = findNodeAtPosition(x, y);
        hoveredNodeRef.current = hovered || null;
        canvas.style.cursor = hovered ? 'pointer' : 'grab';
      }
    });

    canvas.addEventListener('mouseup', (event: MouseEvent) => {
      if (isDraggingNode && draggedNodeRef.current) {
        // 拖拽结束，恢复浮动
        const floatState = floatStatesRef.current.get(draggedNodeRef.current.id);
        if (floatState) {
          floatState.targetOffsetX = (Math.random() - 0.5) * 6;
          floatState.targetOffsetY = (Math.random() - 0.5) * 6;
        }
      }
      isDraggingNode = false;
      draggedNodeRef.current = null;
      canvas.style.cursor = hoveredNodeRef.current ? 'pointer' : 'grab';
    });

    canvas.addEventListener('click', (event: MouseEvent) => {
      if (isDraggingNode) return; // 忽略拖拽结束时的点击

      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const { x, y } = screenToCanvas(screenX, screenY);

      const clickedNode = findNodeAtPosition(x, y);

      if (clickedNode) {
        setSelectedNodeId(clickedNode.id);
        onNodeClick(clickedNode);
      } else {
        setSelectedNodeId(null);
      }
    });

    canvas.addEventListener('mouseleave', () => {
      hoveredNodeRef.current = null;
      if (!isDraggingNode) {
        canvas.style.cursor = 'default';
      }
    });

    // 启动渲染循环
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [data, width, height, onNodeClick, updatePerformanceMetrics, theme, selectedNodeId]);

  return (
    <div className="relative w-full h-full bg-neo-bg overflow-hidden rounded-xl border border-neo-border shadow-inner">
      {/* 背景网格 */}
      <div
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--neo-border) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* Canvas 元素 */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />

      {/* 加载中 */}
      {isLoading && (
        <div className="absolute inset-0 bg-neo-bg/80 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-neo-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-neo-primary text-sm font-medium">执行 Cypher 查询中...</span>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && data.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3 text-neo-dim">
            <div className="w-16 h-16 rounded-full bg-neo-panel flex items-center justify-center border border-neo-border">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4m0-10L4 7" />
              </svg>
            </div>
            <span className="text-sm">未返回任何节点。请尝试其他查询。</span>
          </div>
        </div>
      )}

      {/* 缩放提示 */}
      <div className="absolute bottom-4 right-4 bg-neo-panel px-3 py-1 rounded-full text-xs text-neo-dim border border-neo-border">
        缩放：{Math.round(zoomLevel * 100)}%
      </div>

      {/* 性能监控面板 */}
      <PerformanceMonitor
        metrics={performanceMetrics}
        isVisible={performanceMonitorVisible}
        onToggle={() => setPerformanceMonitorVisible(!performanceMonitorVisible)}
      />

      {/* 性能优化提示（大图时显示） */}
      {data.nodes.length > 500 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-neo-panel/90 backdrop-blur-md px-4 py-2 rounded-lg border border-neo-primary/30 text-xs text-neo-primary z-10 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7" />
          </svg>
          <span className="font-medium">✨ 性能优化已启用</span>
          <span className="text-neo-dim ml-2">
            Canvas 渲染 • 视锥体裁剪 • LOD 渲染 • 性能监控
          </span>
        </div>
      )}
    </div>
  );
};

export default OptimizedGraphCanvas;
