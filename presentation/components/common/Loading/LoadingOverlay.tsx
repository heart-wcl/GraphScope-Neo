/**
 * LoadingOverlay 组件 - DDD 架构表现层
 * 全屏加载遮罩组件
 * 
 * 解决问题：项目中 8+ 处重复的加载遮罩代码
 */

import React from 'react';

export interface LoadingOverlayProps {
  /** 是否显示 */
  visible?: boolean;
  /** 加载文本 */
  text?: string;
  /** 是否透明背景 */
  transparent?: boolean;
  /** 自定义类名 */
  className?: string;
  /** Spinner 大小 */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-8 h-8 border-2',
  md: 'w-12 h-12 border-4',
  lg: 'w-16 h-16 border-4'
};

/**
 * 全屏加载遮罩
 * 
 * @example
 * ```tsx
 * <LoadingOverlay visible={loading} text="Loading data..." />
 * 
 * <LoadingOverlay
 *   visible={isSaving}
 *   text="Saving changes..."
 *   size="sm"
 * />
 * ```
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible = true,
  text = '加载中...',
  transparent = false,
  className = '',
  size = 'md'
}) => {
  if (!visible) return null;

  return (
    <div
      className={`
        fixed inset-0 flex items-center justify-center z-[100]
        ${transparent ? 'bg-black/30' : 'bg-black/50'}
        ${className}
      `}
      style={{ zIndex: 100 }}
    >
      <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4">
        <div
          className={`
            ${sizeClasses[size]}
            border-neo-primary border-t-transparent
            rounded-full animate-spin
          `}
        />
        {text && (
          <span className="text-white font-medium">{text}</span>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay;
