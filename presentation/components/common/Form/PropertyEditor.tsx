/**
 * PropertyEditor 组件 - DDD 架构表现层
 * 属性编辑器组件（配合 usePropertyList 使用）
 * 
 * 解决问题：AddNodeModal, AddRelationshipModal 等中重复的属性编辑 UI
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Property, UsePropertyListResult } from '../../../hooks';

export interface PropertyEditorProps {
  /** usePropertyList 返回的结果 */
  propertyList: UsePropertyListResult;
  /** 键名占位符 */
  keyPlaceholder?: string;
  /** 值占位符 */
  valuePlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示添加按钮 */
  showAddButton?: boolean;
  /** 添加按钮文本 */
  addButtonText?: string;
  /** 自定义类名 */
  className?: string;
  /** 最小行数 */
  minRows?: number;
}

/**
 * 属性编辑器
 * 
 * @example
 * ```tsx
 * const propertyList = usePropertyList();
 * 
 * <PropertyEditor
 *   propertyList={propertyList}
 *   keyPlaceholder="Property name"
 *   valuePlaceholder="Property value"
 * />
 * 
 * // 提交时获取属性对象
 * const handleSubmit = () => {
 *   const props = propertyList.toRecord();
 *   console.log(props); // { name: 'Alice', age: 25 }
 * };
 * ```
 */
export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  propertyList,
  keyPlaceholder = '属性名',
  valuePlaceholder = '属性值',
  disabled = false,
  showAddButton = true,
  addButtonText = '添加属性',
  className = '',
  minRows = 1
}) => {
  const {
    properties,
    addProperty,
    removeProperty,
    updateProperty
  } = propertyList;

  const canRemove = properties.length > minRows;

  return (
    <div className={`space-y-3 ${className}`}>
      {properties.map((prop, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={prop.key}
            onChange={(e) => updateProperty(index, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            disabled={disabled}
            className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-sm text-white placeholder-neo-dim focus:ring-1 focus:ring-neo-primary outline-none disabled:opacity-50"
          />
          <input
            type="text"
            value={prop.value}
            onChange={(e) => updateProperty(index, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            disabled={disabled}
            className="flex-1 bg-neo-bg border border-neo-border rounded-lg px-3 py-2 text-sm text-white placeholder-neo-dim focus:ring-1 focus:ring-neo-primary outline-none disabled:opacity-50"
          />
          {canRemove && (
            <button
              type="button"
              onClick={() => removeProperty(index)}
              disabled={disabled}
              className="p-2 text-neo-dim hover:text-red-400 transition-colors disabled:opacity-50"
              title="删除属性"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      
      {showAddButton && (
        <button
          type="button"
          onClick={addProperty}
          disabled={disabled}
          className="flex items-center gap-2 text-neo-dim hover:text-neo-primary transition-colors text-sm disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {addButtonText}
        </button>
      )}
    </div>
  );
};

export default PropertyEditor;
