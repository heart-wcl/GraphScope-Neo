/**
 * LoadingSpinner 组件 - DDD 架构表现层
 * 内联加载指示器
 */

import React from 'react';

export interface LoadingSpinnerProps {
  /** 尺寸 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 颜色类名 */
  colorClass?: string;
  /** 自定义类名 */
  className?: string;
}

const sizeClasses = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-2'
};

/**
 * 内联加载指示器
 * 
 * @example
 * ```tsx
 * <LoadingSpinner />
 * <LoadingSpinner size="sm" colorClass="border-red-400" />
 * ```
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  colorClass = 'border-neo-primary',
  className = ''
}) => {
  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${colorClass}
        border-t-transparent
        rounded-full animate-spin
        ${className}
      `}
    />
  );
};

export default LoadingSpinner;
