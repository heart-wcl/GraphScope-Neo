/**
 * 颜色生成工具 - DDD 架构共享层
 * 统一颜色生成逻辑
 */

/**
 * 霓虹色调色板
 */
export const NEON_COLORS = [
  '#00F0FF', // Cyan
  '#FF00FF', // Magenta
  '#00FF88', // Neon Green
  '#FF6B00', // Neon Orange
  '#B388FF', // Purple
  '#FFEA00', // Yellow
  '#00FFEF', // Aqua
  '#FF4081', // Pink
  '#69F0AE', // Mint
  '#FFD740', // Amber
] as const;

/**
 * 根据标签生成一致的颜色
 * @param label - 标签字符串
 * @returns 颜色值
 */
export function generateColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NEON_COLORS[Math.abs(hash) % NEON_COLORS.length];
}

/**
 * 根据索引获取颜色
 * @param index - 索引
 * @returns 颜色值
 */
export function getColorByIndex(index: number): string {
  return NEON_COLORS[Math.abs(index) % NEON_COLORS.length];
}

/**
 * 获取颜色调色板
 * @returns 只读颜色数组
 */
export function getColorPalette(): readonly string[] {
  return NEON_COLORS;
}

/**
 * 生成颜色映射表
 * @param labels - 标签数组
 * @returns 标签到颜色的映射
 */
export function generateColorMap(labels: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  labels.forEach(label => {
    colorMap.set(label, generateColor(label));
  });
  return colorMap;
}

/**
 * 调整颜色亮度
 * @param color - 十六进制颜色
 * @param percent - 亮度百分比 (-100 到 100)
 * @returns 调整后的颜色
 */
export function adjustBrightness(color: string, percent: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const adjust = (value: number) => {
    const adjusted = value + (value * percent) / 100;
    return Math.min(255, Math.max(0, Math.round(adjusted)));
  };

  const newR = adjust(r).toString(16).padStart(2, '0');
  const newG = adjust(g).toString(16).padStart(2, '0');
  const newB = adjust(b).toString(16).padStart(2, '0');

  return `#${newR}${newG}${newB}`;
}

/**
 * 生成透明度颜色
 * @param color - 十六进制颜色
 * @param alpha - 透明度 (0-1)
 * @returns RGBA 颜色字符串
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
