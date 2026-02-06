/**
 * SuccessAlert 组件 - DDD 架构表现层
 * 成功提示组件
 */

import React from 'react';
import { CheckCircle, X } from 'lucide-react';

export interface SuccessAlertProps {
  /** 成功消息 */
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
  /** 自动消失时间（毫秒，0 表示不自动消失） */
  autoHideDuration?: number;
}

/**
 * 成功提示组件
 * 
 * @example
 * ```tsx
 * <SuccessAlert message="Node created successfully!" />
 * 
 * <SuccessAlert
 *   message={success}
 *   dismissible
 *   onDismiss={() => setSuccess(null)}
 *   autoHideDuration={3000}
 * />
 * ```
 */
export const SuccessAlert: React.FC<SuccessAlertProps> = ({
  message,
  className = '',
  dismissible = false,
  onDismiss,
  icon,
  title,
  autoHideDuration = 0
}) => {
  React.useEffect(() => {
    if (message && autoHideDuration > 0 && onDismiss) {
      const timer = setTimeout(onDismiss, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [message, autoHideDuration, onDismiss]);

  if (!message) return null;

  return (
    <div className={`p-4 bg-green-500/10 border-b border-neo-border flex items-start gap-3 text-green-400 ${className}`}>
      <div className="flex-shrink-0 mt-0.5">
        {icon || <CheckCircle className="w-4 h-4" />}
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
          className="flex-shrink-0 text-green-400/70 hover:text-green-400 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SuccessAlert;
