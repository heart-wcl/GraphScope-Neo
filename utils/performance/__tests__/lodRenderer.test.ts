/**
 * LOD 渲染工具单元测试
 */

import {
  getRenderMode,
  getNodeSize,
  shouldShowLabels,
  renderNodeByLOD,
  renderRelationshipByLOD,
} from '../lodRenderer';
import * as d3 from 'd3';
import type { CullingConfig, LODConfig } from '../../../types/performance';
import type { Neo4jNode, Neo4jRelationship } from '../../../types';

// Mock Canvas context
const createMockContext = () => {
  let path: any = '';
  const context: any = {
    _path: '',
    beginPath: jest.fn(function() {
      context._path = '';
    }),
    moveTo: jest.fn(function(x: number, y: number) {
      context._path = `M${x},${y}`;
    }),
    lineTo: jest.fn(function(x: number, y: number) {
      context._path = `L${x},${y}`;
    }),
    closePath: jest.fn(function() {
      context._path += 'Z';
    }),
    arc: jest.fn(function(x: number, y: number, r: number, startAngle: number, endAngle: number) {
      context._path = `A${x},${y},${r},${startAngle},${endAngle}`;
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    fill: jest.fn(function() {}),
    stroke: jest.fn(function() {}),
    fillText: jest.fn(function() {}),
  };
  return context;
};

describe('LOD 渲染工具', () => {
  describe('getRenderMode', () => {
    it('应该在缩放级别 1.0 返回 DOT_MODE', () => {
      const zoom = 1.0;
      const config = { DOT_MODE: 0.5, SIMPLE_MODE: 0.3, LABEL_MODE: 0.2 };
      const mode = getRenderMode(zoom, config);

      expect(mode).toBe('DOT_MODE');
    });

    it('应该在低缩放级别返回 SIMPLE_MODE', () => {
      const zoom = 0.2;
      const config = { DOT_MODE: 0.5, SIMPLE_MODE: 0.3, LABEL_MODE: 0.2 };
      const mode = getRenderMode(zoom, config);

      expect(mode).toBe('SIMPLE_MODE');
    });

    it('应该在高缩放级别返回 LABEL_MODE', () => {
      const zoom = 0.6;
      const config = { DOT_MODE: 0.5, SIMPLE_MODE: 0.3, LABEL_MODE: 0.2 };
      const mode = getRenderMode(zoom, config);

      expect(mode).toBe('LABEL_MODE');
    });

    it('应该处理缩放级别在阈值边界', () => {
      const config = { DOT_MODE: 0.5, SIMPLE_MODE: 0.3, LABEL_MODE: 0.2 };
      
      const mode1 = getRenderMode(0.5, config);
      const mode2 = getRenderMode(0.5 + 0.001, config);

      expect(mode1).not.toBe(mode2);
    });
  });

  describe('getNodeSize', () => {
    const node: Neo4jNode = {
      id: '1',
      labels: ['Person'],
      properties: { name: 'John' },
      radius: 20,
    };

    it('应该在 DOT_MODE 返回正常大小', () => {
      const size = getNodeSize(node, 'DOT_MODE', {});
      expect(size).toBe(20);
    });

    it('应该在 SIMPLE_MODE 返回较小的节点', () => {
      const size = getNodeSize(node, 'SIMPLE_MODE', {});
      expect(size).toBeLessThan(20);
      expect(size).toBeGreaterThan(10);
    });

    it('应该在 LABEL_MODE 返回较大的节点', () => {
      const size = getNodeSize(node, 'LABEL_MODE', {});
      expect(size).toBeGreaterThanOrEqual(20);
    });

    it('应该使用默认半径当节点没有半径时', () => {
      const nodeWithoutRadius: any = {
        id: '1',
        labels: ['Person'],
        properties: { name: 'John' },
      };

      const size = getNodeSize(nodeWithoutRadius, 'DOT_MODE', {});
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('shouldShowLabels', () => {
    it('应该在 DOT_MODE 返回 false', () => {
      const show = shouldShowLabels('DOT_MODE', {});
      expect(show).toBe(false);
    });

    it('应该在 LABEL_MODE 返回 true', () => {
      const show = shouldShowLabels('LABEL_MODE', {});
      expect(show).toBe(true);
    });

    it('应该在 SIMPLE_MODE 根据配置返回', () => {
      const config = { SIMPLE_MODE: false };
      const show = shouldShowLabels('SIMPLE_MODE', config);
      expect(show).toBe(false);
    });
  });

  describe('renderNodeByLOD', () => {
    let mockContext: any;

    beforeEach(() => {
      mockContext = createMockContext();
    });

    it('应该在 DOT_MODE 渲染节点（圆形）', () => {
      const node: Neo4jNode = {
        id: '1',
        labels: ['Person'],
        properties: { name: 'John' },
        x: 100,
        y: 100,
        radius: 20,
        color: '#00F0FF',
      };

      renderNodeByLOD(mockContext, node, 'DOT_MODE', {});

      expect(mockContext.arc).toHaveBeenCalledWith(100, 100, 20, 0, Math.PI * 2);
      expect(mockContext.fill).toHaveBeenCalled();
    });

    it('应该在 SIMPLE_MODE 渲染节点（较小的圆形）', () => {
      const node: Neo4jNode = {
        id: '1',
        labels: ['Person'],
        properties: { name: 'John' },
        x: 100,
        y: 100,
        radius: 20,
        color: '#00F0FF',
      };

      renderNodeByLOD(mockContext, node, 'SIMPLE_MODE', {});

      const callArgs = mockContext.arc.mock.calls[0];
      expect(callArgs[3]).toBeLessThan(20); // 半径小于 20
      expect(mockContext.fill).toHaveBeenCalled();
    });

    it('应该正确设置节点颜色', () => {
      const node: Neo4jNode = {
        id: '1',
        labels: ['Person'],
        properties: { name: 'John' },
        x: 100,
        y: 100,
        radius: 20,
        color: '#FF00FF',
      };

      renderNodeByLOD(mockContext, node, 'DOT_MODE', {});

      expect(mockContext.fillStyle).toBe('#FF00FF');
    });
  });

  describe('renderRelationshipByLOD', () => {
    let mockContext: any;
    const sourceNode: Neo4jNode = {
      id: '1',
      labels: ['Person'],
      properties: { name: 'John' },
      x: 100,
      y: 100,
    };
    const targetNode: Neo4jNode = {
      id: '2',
      labels: ['Person'],
      properties: { name: 'Jane' },
      x: 200,
      y: 200,
    };

    beforeEach(() => {
      mockContext = createMockContext();
    });

    it('应该在 DOT_MODE 渲染关系（线条）', () => {
      const relationship: Neo4jRelationship = {
        id: 'r1',
        type: 'KNOWS',
        startNode: '1',
        endNode: '2',
        properties: {},
      };

      renderRelationshipByLOD(mockContext, relationship, sourceNode, targetNode, 'DOT_MODE', {});

      expect(mockContext.moveTo).toHaveBeenCalledWith(100, 100);
      expect(mockContext.lineTo).toHaveBeenCalledWith(200, 200);
      expect(mockContext.stroke).toHaveBeenCalled();
    });

    it('应该在 SIMPLE_MODE 渲染关系（较细的线条）', () => {
      const relationship: Neo4jRelationship = {
        id: 'r1',
        type: 'KNOWS',
        startNode: '1',
        endNode: '2',
        properties: {},
      };

      renderRelationshipByLOD(mockContext, relationship, sourceNode, targetNode, 'SIMPLE_MODE', {});

      const lineWidth = parseFloat(mockContext.lineWidth);
      expect(lineWidth).toBeGreaterThan(0);
      expect(lineWidth).toBeLessThan(2);
    });

    it('应该正确设置关系颜色', () => {
      const relationship: Neo4jRelationship = {
        id: 'r1',
        type: 'KNOWS',
        startNode: '1',
        endNode: '2',
        properties: {},
        color: '#00FF88',
      };

      renderRelationshipByLOD(mockContext, relationship, sourceNode, targetNode, 'DOT_MODE', {});

      expect(mockContext.strokeStyle).toBe('#00FF88');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内渲染大量节点', () => {
      const nodes: Neo4jNode[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        labels: ['Person'],
        properties: { name: `Person ${i}` },
        x: Math.random() * 800,
        y: Math.random() * 600,
        radius: 20,
        color: '#00F0FF',
      }));

      const mockContext = createMockContext();

      const startTime = performance.now();
      nodes.forEach(node => {
        renderNodeByLOD(mockContext, node, 'DOT_MODE', {});
      });
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // 应该在 100ms 内完成
    });

    it('应该在合理时间内渲染大量关系', () => {
      const links: Neo4jRelationship[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `link${i}`,
        type: 'CONNECTS',
        startNode: `${i}`,
        endNode: `${(i + 1) % 1000}`,
        properties: {},
      }));

      const sourceNodes = new Map<string, Neo4jNode>();
      const targetNodes = new Map<string, Neo4jNode>();

      for (let i = 0; i < 1000; i++) {
        sourceNodes.set(`${i}`, {
          id: `${i}`,
          labels: ['Person'],
          properties: { name: `Person ${i}` },
          x: Math.random() * 800,
          y: Math.random() * 600,
        });
        targetNodes.set(`${(i + 1) % 1000}`, {
          id: `${(i + 1) % 1000}`,
          labels: ['Person'],
          properties: { name: `Person ${(i + 1) % 1000}` },
          x: Math.random() * 800,
          y: Math.random() * 600,
        });
      }

      const mockContext = createMockContext();

      const startTime = performance.now();
      links.forEach((link, index) => {
        const source = sourceNodes.get(link.startNode)!;
        const target = targetNodes.get(link.endNode)!;
        renderRelationshipByLOD(mockContext, link, source, target, 'DOT_MODE', {});
      });
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // 应该在 100ms 内完成
    });
  });
});
