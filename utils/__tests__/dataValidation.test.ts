/**
 * 数据验证工具单元测试
 */

import {
  validateNode,
  validateRelationship,
  validateGraphData,
  sanitizeGraphData,
  generateNodeCoordinates,
  truncateGraphData,
} from '../utils/dataValidation';
import type { Neo4jNode, Neo4jRelationship, GraphData } from '../types';

describe('数据验证工具', () => {
  describe('validateNode', () => {
    it('应该验证有效的节点', () => {
      const node: any = {
        id: '1',
        labels: ['Person'],
        properties: { name: 'John' },
      };

      const result = validateNode(node);

      expect(result.isValid).toBe(true);
      expect(result.node).toEqual(node);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝缺少id的节点', () => {
      const node: any = {
        labels: ['Person'],
        properties: { name: 'John' },
      };

      const result = validateNode(node, { requireId: true });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('节点缺少 id 字段');
    });

    it('应该拒绝缺少labels的节点', () => {
      const node: any = {
        id: '1',
        properties: { name: 'John' },
      };

      const result = validateNode(node, { requireLabels: true });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('节点缺少 labels 字段或 labels 不是数组');
    });

    it('应该拒绝labels不是数组的节点', () => {
      const node: any = {
        id: '1',
        labels: 'Person' as any,
        properties: { name: 'John' },
      };

      const result = validateNode(node, { requireLabels: true });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('节点缺少 labels 字段或 labels 不是数组');
    });

    it('应该拒绝properties不是对象的节点', () => {
      const node: any = {
        id: '1',
        labels: ['Person'],
        properties: 'John' as any,
      };

      const result = validateNode(node);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('节点的 properties 字段不是对象');
    });
  });

  describe('validateRelationship', () => {
    it('应该验证有效的关系', () => {
      const relationship: any = {
        id: 'r1',
        type: 'KNOWS',
        startNode: '1',
        endNode: '2',
        properties: { since: '2020' },
      };

      const result = validateRelationship(relationship);

      expect(result.isValid).toBe(true);
      expect(result.relationship).toEqual(relationship);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝缺少id的关系', () => {
      const relationship: any = {
        type: 'KNOWS',
        startNode: '1',
        endNode: '2',
      };

      const result = validateRelationship(relationship);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('关系缺少 id 字段');
    });

    it('应该拒绝缺少type的关系', () => {
      const relationship: any = {
        id: 'r1',
        startNode: '1',
        endNode: '2',
      };

      const result = validateRelationship(relationship);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('关系缺少 type 字段');
    });

    it('应该拒绝缺少startNode的关系', () => {
      const relationship: any = {
        id: 'r1',
        type: 'KNOWS',
        endNode: '2',
      };

      const result = validateRelationship(relationship);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('关系缺少 startNode 字段');
    });

    it('应该拒绝缺少endNode的关系', () => {
      const relationship: any = {
        id: 'r1',
        type: 'KNOWS',
        startNode: '1',
      };

      const result = validateRelationship(relationship);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('关系缺少 endNode 字段');
    });

    it('应该拒绝properties不是对象的关系', () => {
      const relationship: any = {
        id: 'r1',
        type: 'KNOWS',
        startNode: '1',
        endNode: '2',
        properties: 'since' as any,
      };

      const result = validateRelationship(relationship);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('关系的 properties 字段不是对象');
    });
  });

  describe('validateGraphData', () => {
    it('应该验证有效的图数据', () => {
      const data: any = {
        nodes: [
          {
            id: '1',
            labels: ['Person'],
            properties: { name: 'John' },
          },
          {
            id: '2',
            labels: ['Person'],
            properties: { name: 'Jane' },
          },
        ],
        links: [
          {
            id: 'r1',
            type: 'KNOWS',
            startNode: '1',
            endNode: '2',
            properties: { since: '2020' },
          },
        ],
      };

      const result = validateGraphData(data);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.data?.nodes).toHaveLength(2);
      expect(result.data?.links).toHaveLength(1);
    });

    it('应该拒绝节点数超过限制的图数据', () => {
      const data: any = {
        nodes: Array.from({ length: 10001 }, (_, i) => ({
          id: `${i}`,
          labels: ['Person'],
          properties: { name: `Person ${i}` },
        })),
        links: [],
      };

      const result = validateGraphData(data, { maxNodes: 10000 });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('节点数量 (10001) 超过最大限制 (10000)');
    });

    it('应该拒绝关系数超过限制的图数据', () => {
      const data: any = {
        nodes: [
          {
            id: '1',
            labels: ['Person'],
            properties: { name: 'John' },
          },
          {
            id: '2',
            labels: ['Person'],
            properties: { name: 'Jane' },
          },
        ],
        links: Array.from({ length: 20001 }, (_, i) => ({
          id: `r${i}`,
          type: 'KNOWS',
          startNode: '1',
          endNode: '2',
        })),
      };

      const result = validateGraphData(data, { maxRelationships: 20000 });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('关系数量 (20001) 超过最大限制 (20000)');
    });

    it('应该检测孤立节点', () => {
      const data: any = {
        nodes: [
          {
            id: '1',
            labels: ['Person'],
            properties: { name: 'John' },
          },
          {
            id: '2',
            labels: ['Person'],
            properties: { name: 'Jane' },
          },
        ],
        links: [
          {
            id: 'r1',
            type: 'KNOWS',
            startNode: '1',
            endNode: '2',
          },
        ],
      };

      const result = validateGraphData(data);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('发现 1 个孤立节点（没有任何关系）');
    });
  });

  describe('sanitizeGraphData', () => {
    it('应该清理有效的图数据', () => {
      const data: any = {
        nodes: [
          {
            id: '1',
            labels: ['Person'],
            properties: { name: 'John' },
          },
          {
            id: '2',
            labels: ['Person'],
            properties: { name: 'Jane' },
          },
        ],
        links: [
          {
            id: 'r1',
            type: 'KNOWS',
            startNode: '1',
            endNode: '2',
            properties: { since: '2020' },
          },
        ],
      };

      const result = sanitizeGraphData(data);

      expect(result.nodes).toHaveLength(2);
      expect(result.links).toHaveLength(1);
    });

    it('应该返回空数据当输入无效时', () => {
      const data: any = {
        nodes: 'invalid' as any,
        links: [],
      };

      const result = sanitizeGraphData(data);

      expect(result.nodes).toHaveLength(0);
      expect(result.links).toHaveLength(0);
    });
  });

  describe('generateNodeCoordinates', () => {
    it('应该为已有坐标的节点保留坐标', () => {
      const nodes: Neo4jNode[] = [
        {
          id: '1',
          labels: ['Person'],
          properties: { name: 'John' },
          x: 100,
          y: 200,
        },
        {
          id: '2',
          labels: ['Person'],
          properties: { name: 'Jane' },
          x: 300,
          y: 400,
        },
      ];

      const result = generateNodeCoordinates(nodes, 800, 600);

      expect(result[0].x).toBe(100);
      expect(result[0].y).toBe(200);
      expect(result[1].x).toBe(300);
      expect(result[1].y).toBe(400);
    });

    it('应该为没有坐标的节点生成随机坐标', () => {
      const nodes: Neo4jNode[] = [
        {
          id: '1',
          labels: ['Person'],
          properties: { name: 'John' },
        },
        {
          id: '2',
          labels: ['Person'],
          properties: { name: 'Jane' },
        },
      ];

      const result = generateNodeCoordinates(nodes, 800, 600);

      expect(result[0].x).toBeDefined();
      expect(result[0].y).toBeDefined();
      expect(result[1].x).toBeDefined();
      expect(result[1].y).toBeDefined();

      // 检查坐标在画布范围内
      expect(result[0].x).toBeGreaterThanOrEqual(0);
      expect(result[0].x).toBeLessThanOrEqual(800);
      expect(result[0].y).toBeGreaterThanOrEqual(0);
      expect(result[0].y).toBeLessThanOrEqual(600);
    });

    it('应该在画布中心附近生成随机坐标', () => {
      const nodes: Neo4jNode[] = [
        {
          id: '1',
          labels: ['Person'],
          properties: { name: 'John' },
        },
      ];

      const result = generateNodeCoordinates(nodes, 800, 600);

      // 检查坐标在画布中心附近（400, 300）
      const centerX = 400;
      const centerY = 300;
      const radius = Math.min(800, 600) / 4;

      const distance = Math.sqrt(
        Math.pow(result[0].x! - centerX, 2) +
        Math.pow(result[0].y! - centerY, 2)
      );

      expect(distance).toBeLessThanOrEqual(radius);
    });
  });

  describe('truncateGraphData', () => {
    it('应该截断超过限制的节点', () => {
      const data: GraphData = {
        nodes: Array.from({ length: 1500 }, (_, i) => ({
          id: `${i}`,
          labels: ['Person'],
          properties: { name: `Person ${i}` },
          x: Math.random() * 800,
          y: Math.random() * 600,
        })),
        links: Array.from({ length: 1499 }, (_, i) => ({
          id: `r${i}`,
          type: 'KNOWS',
          startNode: `${i}`,
          endNode: `${i + 1}`,
        })),
      };

      const result = truncateGraphData(data, 1000, 2000);

      expect(result.nodes).toHaveLength(1000);
      expect(result.links).toBeLessThanOrEqual(2000);
    });

    it('应该保留未超过限制的数据', () => {
      const data: GraphData = {
        nodes: Array.from({ length: 500 }, (_, i) => ({
          id: `${i}`,
          labels: ['Person'],
          properties: { name: `Person ${i}` },
          x: Math.random() * 800,
          y: Math.random() * 600,
        })),
        links: Array.from({ length: 499 }, (_, i) => ({
          id: `r${i}`,
          type: 'KNOWS',
          startNode: `${i}`,
          endNode: `${i + 1}`,
        })),
      };

      const result = truncateGraphData(data, 1000, 2000);

      expect(result.nodes).toHaveLength(500);
      expect(result.links).toHaveLength(499);
    });

    it('应该只保留与保留节点相关的关系', () => {
      const data: GraphData = {
        nodes: Array.from({ length: 5 }, (_, i) => ({
          id: `${i}`,
          labels: ['Person'],
          properties: { name: `Person ${i}` },
        })),
        links: [
          {
            id: 'r1',
            type: 'KNOWS',
            startNode: '0',
            endNode: '1',
          },
          {
            id: 'r2',
            type: 'KNOWS',
            startNode: '3', // 超出范围
            endNode: '4', // 超出范围
          },
        ],
      };

      const result = truncateGraphData(data, 2, 2);

      expect(result.nodes).toHaveLength(2);
      expect(result.links).toHaveLength(1);
      expect(result.links[0].startNode).toBe('0');
      expect(result.links[0].endNode).toBe('1');
    });
  });
});
