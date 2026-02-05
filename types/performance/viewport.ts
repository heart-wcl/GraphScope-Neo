/**
 * Viewport and Culling Types
 * 用于视锥体裁剪优化
 */

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface CullingConfig {
  padding: number; // 边缘缓冲区，单位：像素
  minZoom: number; // 最小缩放级别
  maxZoom: number; // 最大缩放级别
}

export const DEFAULT_CULLING_CONFIG: CullingConfig = {
  padding: 50,
  minZoom: 0.1,
  maxZoom: 8.0
};
