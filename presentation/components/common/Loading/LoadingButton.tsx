/**
 * LoadingButton 组件 - DDD 架构表现层
 * 带加载状态的按钮组件
 * 
 * 解决问题：项目中 10+ 处重复的加载按钮代码
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * 按钮变体
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

/**
 * 按钮尺寸
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface LoadingButtonProps {
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击事件 */
  onClick?: (e?: any) => void;
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset';
  /** 变体 */
  variant?: ButtonVariant;
  /** 尺寸 */
  size?: ButtonSize;
  /** 图标 */
  icon?: React.ReactNode;
  /** 加载时显示的文本 */
  loadingText?: string;
  /** 按钮内容 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 是否占满宽度 */
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-neo-primary text-black hover:bg-neo-primary/90 focus:ring-neo-primary/50',
  secondary: 'bg-neo-bg border border-neo-border text-white hover:border-neo-primary hover:text-neo-primary',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
  success: 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20',
  ghost: 'bg-transparent text-neo-dim hover:text-white hover:bg-white/5'
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base'
};

/**
 * 带加载状态的按钮
 * 
 * @example
 * ```tsx
 * <LoadingButton
 *   loading={isSubmitting}
 *   onClick={handleSubmit}
 *   icon={<Save className="w-4 h-4" />}
 * >
 *   Save Changes
 * </LoadingButton>
 * 
 * <LoadingButton
 *   loading={isDeleting}
 *   variant="danger"
 *   loadingText="Deleting..."
 * >
 *   Delete
 * </LoadingButton>
 * ```
 */
export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  icon,
  loadingText,
  children,
  className = '',
  fullWidth = false
}) => {
  const isDisabled = loading || disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        rounded-lg font-medium transition-all
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neo-bg
        ${className}
      `}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText || children}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

export default LoadingButton;
