/**
 * ErrorAlert 组件 - DDD 架构表现层
 * 错误提示组件
 * 
 * 解决问题：项目中 15+ 处重复的错误显示代码
 */

import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface ErrorAlertProps {
  /** 错误消息 */
  message: string | null | undefined;
  /** 自定义类名 */
  className?: string;
  /** 是否可关闭 */
  dismissible?: boolean;
  /** 关闭回调 */
  onDismiss?: () => void;
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 标题 */
  title?: string;
}

/**
 * 错误提示组件
 * 
 * @example
 * ```tsx
 * // 基础用法
 * <ErrorAlert message={error} />
 * 
 * // 可关闭
 * <ErrorAlert
 *   message={error}
 *   dismissible
 *   onDismiss={() => setError(null)}
 * />
 * 
 * // 带标题
 * <ErrorAlert
 *   title="Connection Failed"
 *   message="Unable to connect to the database"
 * />
 * ```
 */
export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  className = '',
  dismissible = false,
  onDismiss,
  icon,
  title
}) => {
  if (!message) return null;

  return (
    <div className={`p-4 bg-red-500/10 border-b border-neo-border flex items-start gap-3 text-red-400 ${className}`}>
      <div className="flex-shrink-0 mt-0.5">
        {icon || <AlertCircle className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <div className="font-medium text-sm mb-1">{title}</div>
        )}
        <span className="text-sm break-words">{message}</span>
      </div>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-red-400/70 hover:text-red-400 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default ErrorAlert;
