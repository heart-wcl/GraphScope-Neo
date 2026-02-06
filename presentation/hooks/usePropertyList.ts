/**
 * usePropertyList Hook - DDD 架构表现层
 * 统一管理属性列表（key-value 对）的状态
 * 
 * 解决问题：AddNodeModal, AddRelationshipModal 等组件中重复的属性管理代码
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * 属性项
 */
export interface Property {
  key: string;
  value: string;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

/**
 * 属性列表 Hook 返回值
 */
export interface UsePropertyListResult {
  /** 属性列表 */
  properties: Property[];
  /** 添加新属性 */
  addProperty: () => void;
  /** 删除属性 */
  removeProperty: (index: number) => void;
  /** 更新属性字段 */
  updateProperty: (index: number, field: keyof Property, value: string) => void;
  /** 设置整个属性列表 */
  setProperties: (properties: Property[]) => void;
  /** 重置为初始状态 */
  reset: () => void;
  /** 清空所有属性 */
  clear: () => void;
  /** 转换为 Record 对象（自动解析值类型） */
  toRecord: () => Record<string, any>;
  /** 从 Record 对象导入 */
  fromRecord: (record: Record<string, any>) => void;
  /** 验证属性列表 */
  validate: () => { isValid: boolean; errors: string[] };
  /** 是否有有效属性 */
  hasValidProperties: boolean;
  /** 有效属性数量 */
  validCount: number;
}

/**
 * 配置选项
 */
export interface UsePropertyListOptions {
  /** 初始属性列表 */
  initialProperties?: Property[];
  /** 最小属性数量 */
  minCount?: number;
  /** 最大属性数量 */
  maxCount?: number;
  /** 是否允许空值 */
  allowEmptyValues?: boolean;
  /** 是否允许重复键名 */
  allowDuplicateKeys?: boolean;
}

/**
 * 属性列表管理 Hook
 * 
 * @example
 * ```tsx
 * const {
 *   properties,
 *   addProperty,
 *   removeProperty,
 *   updateProperty,
 *   toRecord
 * } = usePropertyList();
 * 
 * const handleSubmit = () => {
 *   const props = toRecord();
 *   console.log(props); // { name: 'Alice', age: 25 }
 * };
 * 
 * return (
 *   <form onSubmit={handleSubmit}>
 *     {properties.map((prop, index) => (
 *       <div key={index}>
 *         <input
 *           value={prop.key}
 *           onChange={(e) => updateProperty(index, 'key', e.target.value)}
 *           placeholder="Key"
 *         />
 *         <input
 *           value={prop.value}
 *           onChange={(e) => updateProperty(index, 'value', e.target.value)}
 *           placeholder="Value"
 *         />
 *         <button type="button" onClick={() => removeProperty(index)}>
 *           Remove
 *         </button>
 *       </div>
 *     ))}
 *     <button type="button" onClick={addProperty}>Add Property</button>
 *     <button type="submit">Submit</button>
 *   </form>
 * );
 * ```
 */
export function usePropertyList(options: UsePropertyListOptions = {}): UsePropertyListResult {
  const {
    initialProperties = [{ key: '', value: '' }],
    minCount = 0,
    maxCount = Infinity,
    allowEmptyValues = true,
    allowDuplicateKeys = false
  } = options;

  const [properties, setProperties] = useState<Property[]>(initialProperties);

  const addProperty = useCallback(() => {
    if (properties.length >= maxCount) return;
    setProperties(prev => [...prev, { key: '', value: '' }]);
  }, [properties.length, maxCount]);

  const removeProperty = useCallback((index: number) => {
    if (properties.length <= minCount) return;
    setProperties(prev => prev.filter((_, i) => i !== index));
  }, [properties.length, minCount]);

  const updateProperty = useCallback(
    (index: number, field: keyof Property, value: string) => {
      setProperties(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const reset = useCallback(() => {
    setProperties(initialProperties);
  }, [initialProperties]);

  const clear = useCallback(() => {
    setProperties([{ key: '', value: '' }]);
  }, []);

  const toRecord = useCallback((): Record<string, any> => {
    const record: Record<string, any> = {};
    
    properties.forEach(({ key, value, type }) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) return;
      
      // 根据类型或自动检测解析值
      let parsedValue: any = value;
      
      if (type) {
        // 使用指定类型
        switch (type) {
          case 'number':
            parsedValue = Number(value);
            break;
          case 'boolean':
            parsedValue = value.toLowerCase() === 'true';
            break;
          case 'array':
          case 'object':
            try {
              parsedValue = JSON.parse(value);
            } catch {
              parsedValue = value;
            }
            break;
        }
      } else {
        // 自动检测类型
        // 尝试解析为 JSON (数字、布尔值、数组、对象)
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // 保持为字符串
          parsedValue = value;
        }
      }
      
      record[trimmedKey] = parsedValue;
    });
    
    return record;
  }, [properties]);

  const fromRecord = useCallback((record: Record<string, any>) => {
    const newProperties: Property[] = Object.entries(record).map(([key, value]) => {
      let stringValue: string;
      let type: Property['type'];
      
      if (typeof value === 'string') {
        stringValue = value;
        type = 'string';
      } else if (typeof value === 'number') {
        stringValue = String(value);
        type = 'number';
      } else if (typeof value === 'boolean') {
        stringValue = String(value);
        type = 'boolean';
      } else if (Array.isArray(value)) {
        stringValue = JSON.stringify(value);
        type = 'array';
      } else {
        stringValue = JSON.stringify(value);
        type = 'object';
      }
      
      return { key, value: stringValue, type };
    });
    
    setProperties(newProperties.length > 0 ? newProperties : [{ key: '', value: '' }]);
  }, []);

  const validate = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const keys = new Set<string>();
    
    properties.forEach((prop, index) => {
      const trimmedKey = prop.key.trim();
      
      // 检查空键名
      if (trimmedKey && !allowEmptyValues && !prop.value.trim()) {
        errors.push(`Property ${index + 1}: Value cannot be empty`);
      }
      
      // 检查重复键名
      if (trimmedKey) {
        if (!allowDuplicateKeys && keys.has(trimmedKey)) {
          errors.push(`Property ${index + 1}: Duplicate key "${trimmedKey}"`);
        }
        keys.add(trimmedKey);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, [properties, allowEmptyValues, allowDuplicateKeys]);

  const hasValidProperties = useMemo(() => {
    return properties.some(prop => prop.key.trim() !== '');
  }, [properties]);

  const validCount = useMemo(() => {
    return properties.filter(prop => prop.key.trim() !== '').length;
  }, [properties]);

  return {
    properties,
    addProperty,
    removeProperty,
    updateProperty,
    setProperties,
    reset,
    clear,
    toRecord,
    fromRecord,
    validate,
    hasValidProperties,
    validCount
  };
}

export default usePropertyList;
