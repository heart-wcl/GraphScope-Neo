/**
 * 视锥体裁剪工具单元测试
 */

import {
  getViewport,
  filterVisibleElements,
  calculateCullRate,
} from '../viewportCulling';
import type { Neo4jNode, Neo4jRelationship } from '../../types';
import * as d3 from 'd3';

describe('视锥体裁剪工具', () => {
  describe('getViewport', () => {
    it('应该计算默认视口', () => {
      const width = 800;
      const height = 600;

      const viewport = getViewport(width, height, d3.zoomIdentity);

      expect(viewport.width).toBe(width);
      expect(viewport.height).toBe(height);
      expect(viewport.x).toBe(0);
      expect(viewport.y).toBe(0);
      expect(viewport.zoom).toBe(1);
    });

    it('应该计算变换后的视口', () => {
      const width = 800;
      const height = 600;
      const transform = d3.zoomIdentity.translate(100, 50).scale(2);

      const viewport = getViewport(width, height, transform);

      expect(viewport.x).toBe(100);
      expect(viewport.y).toBe(50);
      expect(viewport.zoom).toBe(2);
    });

    it('应该正确计算视口边界', () => {
      const width = 800;
      const height = 600;
      const transform = d3.zoomIdentity.translate(100, 50).scale(2);

      const viewport = getViewport(width, height, transform);

      const left = -viewport.x / viewport.zoom;
      const top = -viewport.y / viewport.zoom;
      const right = (width - viewport.x) / viewport.zoom;
      const bottom = (height - viewport.y) / viewport.zoom;

      expect(viewport.left).toBe(left);
      expect(viewport.top).toBe(top);
      expect(viewport.right).toBe(right);
      expect(viewport.bottom).toBe(bottom);
    });
  });

  describe('filterVisibleElements', () => {
    const createMockNodes = (count: number): Neo4jNode[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `${i}`,
        labels: ['Node'],
        properties: { name: `Node ${i}` },
        x: Math.random() * 800,
        y: Math.random() * 600,
        radius: 20,
      }));
    };

    const createMockLinks = (count: number): Neo4jRelationship[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `link${i}`,
        type: 'CONNECTS',
        startNode: `${i % (count / 2)}`,
        endNode: `${(i + 1) % (count / 2)}`,
        properties: {},
      }));
    };

    it('应该返回所有元素当视口包含所有节点时', () => {
      const nodes = createMockNodes(10);
      const links = createMockLinks(10);
      const viewport = getViewport(800, 600, d3.zoomIdentity);

      const result = filterVisibleElements(nodes, links, viewport, {
        padding: 50,
      });

      expect(result.nodes).toHaveLength(10);
      expect(result.links).toHaveLength(10);
      expect(result.culledCount).toBe(0);
    });

    it('应该剔除视口外的节点', () => {
      const nodes = [
        {
          id: '1',
          labels: ['Node'],
          properties: { name: 'Node 1' },
          x: -100, // 在视口外
          y: 300,
          radius: 20,
        },
        {
          id: '2',
          labels: ['Node'],
          properties: { name: 'Node 2' },
          x: 400, // 在视口内
          y: 300,
          radius: 20,
        },
      ];

      const links = [];
      const viewport = getViewport(800, 600, d3.zoomIdentity);

      const result = filterVisibleElements(nodes, links, viewport, {
        padding: 50,
      });

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('2');
      expect(result.culledCount).toBe(1);
    });

    it('应该只保留与可见节点相关的关系', () => {
      const nodes = [
        {
          id: '1',
          labels: ['Node'],
          properties: { name: 'Node 1' },
          x: 400,
          y: 300,
          radius: 20,
        },
        {
          id: '2',
          labels: ['Node'],
          properties: { name: 'Node 2' },
          x: 500, // 在视口内
          y: 300,
          radius: 20,
        },
      ];

      const links = [
        {
          id: 'link1',
          type: 'CONNECTS',
          startNode: '1',
          endNode: '2',
          properties: {},
        },
        {
          id: 'link2',
          type: 'CONNECTS',
          startNode: '1',
          endNode: '3', // 节点3不在视口内
          properties: {},
        },
      ];

      const viewport = getViewport(800, 600, d3.zoomIdentity);

      const result = filterVisibleElements(nodes, links, viewport, {
        padding: 50,
      });

      expect(result.nodes).toHaveLength(2);
      expect(result.links).toHaveLength(1);
      expect(result.links[0].id).toBe('link1');
      expect(result.culledLinksCount).toBe(1);
    });

    it('应该考虑视口的 padding', () => {
      const nodes = [
        {
          id: '1',
          labels: ['Node'],
          properties: { name: 'Node 1' },
          x: 51, // 在 padding 内
          y: 300,
          radius: 20,
        },
        {
          id: '2',
          labels: ['Node'],
          properties: { name: 'Node 2' },
          x: 750, // 在视口内（800-50=750）
          y: 300,
          radius: 20,
        },
      ];

      const links = [];
      const viewport = getViewport(800, 600, d3.zoomIdentity);

      const result = filterVisibleElements(nodes, links, viewport, {
        padding: 50,
      });

      expect(result.nodes).toHaveLength(2);
      expect(result.culledCount).toBe(0);
    });

    it('应该处理缩放后的视口', () => {
      const nodes = createMockNodes(10);
      const links = createMockLinks(10);
      const transform = d3.zoomIdentity.scale(0.5); // 缩小到 0.5x

      const viewport = getViewport(800, 600, transform);

      const result = filterVisibleElements(nodes, links, viewport, {
        padding: 50,
      });

      // 缩小后，视口变大，应该能看到更多节点
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.culledCount).toBeLessThan(10);
    });
  });

  describe('calculateCullRate', () => {
    it('应该计算 0% 剔除率当没有剔除时', () => {
      const total = 100;
      const visible = 100;

      const rate = calculateCullRate(total, visible);

      expect(rate).toBe(0);
    });

    it('应该计算 50% 剔除率', () => {
      const total = 100;
      const visible = 50;

      const rate = calculateCullRate(total, visible);

      expect(rate).toBe(0.5);
    });

    it('应该计算 100% 剔除率当没有可见节点时', () => {
      const total = 100;
      const visible = 0;

      const rate = calculateCullRate(total, visible);

      expect(rate).toBe(1);
    });

    it('应该处理零总数', () => {
      const total = 0;
      const visible = 0;

      const rate = calculateCullRate(total, visible);

      expect(rate).toBe(0);
    });

    it('应该限制在 0-1 范围内', () => {
      const rate1 = calculateCullRate(100, 0);
      const rate2 = calculateCullRate(100, 50);
      const rate3 = calculateCullRate(100, 100);

      expect(rate1).toBeGreaterThanOrEqual(0);
      expect(rate1).toBeLessThanOrEqual(1);
      expect(rate2).toBeGreaterThanOrEqual(0);
      expect(rate2).toBeLessThanOrEqual(1);
      expect(rate3).toBeGreaterThanOrEqual(0);
      expect(rate3).toBeLessThanOrEqual(1);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内处理大量节点', () => {
      const nodes = Array.from({ length: 10000 }, (_, i) => ({
        id: `${i}`,
        labels: ['Node'],
        properties: { name: `Node ${i}` },
        x: Math.random() * 800,
        y: Math.random() * 600,
        radius: 20,
      }));

      const links = [];
      const viewport = getViewport(800, 600, d3.zoomIdentity);

      const startTime = performance.now();
      const result = filterVisibleElements(nodes, links, viewport, {
        padding: 50,
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该在 100ms 内完成
    });
  });
});
