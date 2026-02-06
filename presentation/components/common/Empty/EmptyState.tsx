/**
 * EmptyState 组件 - DDD 架构表现层
 * 空状态展示组件
 * 
 * 解决问题：项目中 8+ 处重复的空状态显示代码
 */

import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  /** 自定义图标 */
  icon?: React.ReactNode;
  /** 标题 */
  title?: string;
  /** 描述文本 */
  description?: string;
  /** 操作按钮/内容 */
  action?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 图标尺寸 */
  iconSize?: 'sm' | 'md' | 'lg';
}

const iconSizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16'
};

/**
 * 空状态组件
 * 
 * @example
 * ```tsx
 * // 基础用法
 * {items.length === 0 && <EmptyState />}
 * 
 * // 自定义内容
 * <EmptyState
 *   icon={<Database className="w-12 h-12 text-neo-dim" />}
 *   title="No databases found"
 *   description="Create a new database to get started"
 *   action={
 *     <button onClick={handleCreate}>
 *       Create Database
 *     </button>
 *   }
 * />
 * 
 * // 搜索无结果
 * <EmptyState
 *   icon={<Search className="w-12 h-12 text-neo-dim" />}
 *   title="No results found"
 *   description="Try adjusting your search criteria"
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = '暂无数据',
  description,
  action,
  className = '',
  iconSize = 'md'
}) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex justify-center mb-4">
        {icon || (
          <Inbox className={`${iconSizeClasses[iconSize]} text-neo-dim`} />
        )}
      </div>
      <p className="text-neo-dim font-medium">{title}</p>
      {description && (
        <p className="text-neo-dim/70 text-sm mt-1 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
