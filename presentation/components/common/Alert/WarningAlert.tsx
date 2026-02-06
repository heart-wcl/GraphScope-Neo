/**
 * WarningAlert 组件 - DDD 架构表现层
 * 警告提示组件
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface WarningAlertProps {
  /** 警告消息 */
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
 * 警告提示组件
 * 
 * @example
 * ```tsx
 * <WarningAlert message="This action cannot be undone" />
 * ```
 */
export const WarningAlert: React.FC<WarningAlertProps> = ({
  message,
  className = '',
  dismissible = false,
  onDismiss,
  icon,
  title
}) => {
  if (!message) return null;

  return (
    <div className={`p-4 bg-yellow-500/10 border-b border-neo-border flex items-start gap-3 text-yellow-400 ${className}`}>
      <div className="flex-shrink-0 mt-0.5">
        {icon || <AlertTriangle className="w-4 h-4" />}
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
          className="flex-shrink-0 text-yellow-400/70 hover:text-yellow-400 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default WarningAlert;
