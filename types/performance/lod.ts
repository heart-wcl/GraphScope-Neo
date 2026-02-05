/**
 * Level of Detail (LOD) Types
 * 用于细节层次优化
 */

export type RenderMode = 'dots' | 'simple' | 'with-labels' | 'full';

export interface LODThresholds {
  DOT_MODE: number;      // 点模式阈值
  SIMPLE_MODE: number;   // 简化模式阈值
  LABEL_MODE: number;    // 标签显示阈值
  MIN_ZOOM: number;      // 最小缩放
  MAX_ZOOM: number;      // 最大缩放
}

export interface LODConfig {
  thresholds: LODThresholds;
  nodeSize: {
    dot: number;
    simple: number;
    labeled: number;
    full: number;
  };
  labelConfig: {
    enabled: boolean;
    maxLength: number;
    fontSize: {
      short: number;
      full: number;
    };
  };
}

export const DEFAULT_LOD_CONFIG: LODConfig = {
  thresholds: {
    DOT_MODE: 0.2,
    SIMPLE_MODE: 0.5,
    LABEL_MODE: 1.0,
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 8.0
  },
  nodeSize: {
    dot: 2,
    simple: 5,
    labeled: 8,
    full: 10
  },
  labelConfig: {
    enabled: true,
    maxLength: 15,
    fontSize: {
      short: 8,
      full: 10
    }
  }
};

/**
 * 获取当前缩放级别对应的渲染模式
 */
export function getRenderMode(zoom: number, config: LODConfig = DEFAULT_LOD_CONFIG): RenderMode {
  if (zoom < config.thresholds.DOT_MODE) return 'dots';
  if (zoom < config.thresholds.SIMPLE_MODE) return 'simple';
  if (zoom < config.thresholds.LABEL_MODE) return 'with-labels';
  return 'full';
}

/**
 * 获取当前渲染模式对应的节点大小
 */
export function getNodeSize(mode: RenderMode, config: LODConfig = DEFAULT_LOD_CONFIG): number {
  switch (mode) {
    case 'dots':
      return config.nodeSize.dot;
    case 'simple':
      return config.nodeSize.simple;
    case 'with-labels':
      return config.nodeSize.labeled;
    case 'full':
      return config.nodeSize.full;
  }
}

/**
 * 获取当前渲染模式是否应该显示标签
 */
export function shouldShowLabels(mode: RenderMode, config: LODConfig = DEFAULT_LOD_CONFIG): boolean {
  return config.labelConfig.enabled && (
    mode === 'with-labels' || mode === 'full'
  );
}

/**
 * 获取当前渲染模式对应的字体大小
 */
export function getLabelFontSize(mode: RenderMode, config: LODConfig = DEFAULT_LOD_CONFIG): number {
  if (!shouldShowLabels(mode, config)) return 0;
  return mode === 'full' 
    ? config.labelConfig.fontSize.full 
    : config.labelConfig.fontSize.short;
}
