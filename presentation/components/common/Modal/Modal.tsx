/**
 * Modal 组件 - DDD 架构表现层
 * 通用模态框组件
 * 
 * 解决问题：项目中 10+ 处重复的 Modal 容器结构代码
 */

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

/**
 * Modal 尺寸
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';

/**
 * Modal Props
 */
export interface ModalProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题 */
  title: string;
  /** 描述文本 */
  description?: string;
  /** 标题图标 */
  icon?: React.ReactNode;
  /** 图标颜色类名 */
  iconColorClass?: string;
  /** 尺寸 */
  size?: ModalSize;
  /** Modal 内容 */
  children: React.ReactNode;
  /** 底部内容 */
  footer?: React.ReactNode;
  /** 是否显示关闭按钮 */
  showCloseButton?: boolean;
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
  /** 按 ESC 是否关闭 */
  closeOnEscape?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 内容区域自定义类名 */
  contentClassName?: string;
  /** 是否禁用滚动 */
  disableBodyScroll?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-[95vw]'
};

/**
 * Modal 组件
 * 
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Create Node"
 *   description="Add a new node to the graph"
 *   icon={<Plus className="w-5 h-5 text-neo-primary" />}
 *   size="lg"
 *   footer={
 *     <div className="flex justify-end gap-2">
 *       <button onClick={handleClose}>Cancel</button>
 *       <button onClick={handleSubmit}>Create</button>
 *     </div>
 *   }
 * >
 *   <form>...</form>
 * </Modal>
 * ```
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  iconColorClass = 'bg-neo-primary/10',
  size = '4xl',
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  contentClassName = '',
  disableBodyScroll = true
}) => {
  // ESC 键关闭
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      if (disableBodyScroll) {
        document.body.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (disableBodyScroll) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen, handleKeyDown, disableBodyScroll]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      style={{ zIndex: 100 }}
      onClick={handleOverlayClick}
    >
      <div
        className={`glass-panel rounded-2xl w-full ${sizeClasses[size]} max-h-[85vh] flex flex-col overflow-hidden animate-fade-in ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-neo-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`w-10 h-10 rounded-xl ${iconColorClass} flex items-center justify-center`}>
                {icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-white">{title}</h2>
              {description && (
                <p className="text-xs text-neo-dim">{description}</p>
              )}
            </div>
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-neo-dim hover:text-white p-2 transition-colors rounded-lg hover:bg-white/5"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-auto ${contentClassName}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 md:p-6 border-t border-neo-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
