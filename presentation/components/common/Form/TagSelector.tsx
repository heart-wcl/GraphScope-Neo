/**
 * TagSelector 组件 - DDD 架构表现层
 * 标签选择器组件
 * 
 * 解决问题：项目中 6+ 处重复的标签/按钮选择器代码
 */

import React, { useCallback } from 'react';

export interface TagSelectorProps<T extends string = string> {
  /** 可选项列表 */
  items: T[];
  /** 已选中的项 */
  selectedItems: T[];
  /** 选择变化回调 */
  onChange: (selected: T[]) => void;
  /** 是否允许多选 */
  multiple?: boolean;
  /** 自定义渲染标签内容 */
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 标签类名 */
  tagClassName?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 空状态文本 */
  emptyText?: string;
}

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base'
};

/**
 * 标签选择器
 * 
 * @example
 * ```tsx
 * // 单选
 * <TagSelector
 *   items={['Person', 'Movie', 'Company']}
 *   selectedItems={[selectedLabel]}
 *   onChange={(selected) => setSelectedLabel(selected[0])}
 *   multiple={false}
 * />
 * 
 * // 多选
 * <TagSelector
 *   items={labels}
 *   selectedItems={selectedLabels}
 *   onChange={setSelectedLabels}
 *   multiple
 * />
 * 
 * // 自定义渲染
 * <TagSelector
 *   items={items}
 *   selectedItems={selected}
 *   onChange={setSelected}
 *   renderItem={(item, isSelected) => (
 *     <span>
 *       {isSelected && <Check className="w-3 h-3 mr-1" />}
 *       {item}
 *     </span>
 *   )}
 * />
 * ```
 */
export function TagSelector<T extends string = string>({
  items,
  selectedItems,
  onChange,
  multiple = true,
  renderItem,
  className = '',
  tagClassName = '',
  disabled = false,
  size = 'md',
  emptyText = '无可选项'
}: TagSelectorProps<T>): React.ReactElement {
  const handleToggle = useCallback((item: T) => {
    if (disabled) return;

    if (multiple) {
      // 多选模式
      if (selectedItems.includes(item)) {
        onChange(selectedItems.filter(i => i !== item));
      } else {
        onChange([...selectedItems, item]);
      }
    } else {
      // 单选模式
      if (selectedItems.includes(item)) {
        onChange([]);
      } else {
        onChange([item]);
      }
    }
  }, [selectedItems, onChange, multiple, disabled]);

  if (items.length === 0) {
    return (
      <div className={`text-neo-dim text-sm ${className}`}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {items.map(item => {
        const isSelected = selectedItems.includes(item);
        
        return (
          <button
            key={item}
            type="button"
            onClick={() => handleToggle(item)}
            disabled={disabled}
            className={`
              ${sizeClasses[size]}
              rounded-lg transition-colors
              ${isSelected
                ? 'bg-neo-primary text-black font-medium'
                : 'bg-neo-bg border border-neo-border text-neo-dim hover:border-neo-primary hover:text-white'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${tagClassName}
            `}
          >
            {renderItem ? renderItem(item, isSelected) : item}
          </button>
        );
      })}
    </div>
  );
}

export default TagSelector;
