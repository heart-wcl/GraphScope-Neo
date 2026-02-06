/**
 * SearchInput 组件 - DDD 架构表现层
 * 搜索输入框组件
 * 
 * 解决问题：项目中 8+ 处重复的搜索输入框代码
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps {
  /** 搜索值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 占位符 */
  placeholder?: string;
  /** 自定义类名 */
  className?: string;
  /** 是否显示清除按钮 */
  showClearButton?: boolean;
  /** 防抖延迟（毫秒） */
  debounceDelay?: number;
  /** 回车回调 */
  onSubmit?: (value: string) => void;
  /** 是否自动聚焦 */
  autoFocus?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 输入框尺寸 */
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'py-1.5 pl-8 pr-3 text-xs',
  md: 'py-2 pl-10 pr-4 text-sm',
  lg: 'py-3 pl-12 pr-5 text-base'
};

const iconSizeClasses = {
  sm: 'w-3 h-3 left-2.5',
  md: 'w-4 h-4 left-3',
  lg: 'w-5 h-5 left-4'
};

/**
 * 搜索输入框组件
 * 
 * @example
 * ```tsx
 * const [search, setSearch] = useState('');
 * 
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search nodes..."
 *   showClearButton
 * />
 * 
 * // 带防抖
 * <SearchInput
 *   value={search}
 *   onChange={handleSearch}
 *   debounceDelay={300}
 * />
 * ```
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = '搜索...',
  className = '',
  showClearButton = true,
  debounceDelay = 0,
  onSubmit,
  autoFocus = false,
  disabled = false,
  size = 'md'
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部值
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // 自动聚焦
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);

    if (debounceDelay > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceDelay);
    } else {
      onChange(newValue);
    }
  }, [onChange, debounceDelay]);

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(internalValue);
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  }, [internalValue, onSubmit, handleClear]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <Search
        className={`absolute top-1/2 -translate-y-1/2 text-neo-dim ${iconSizeClasses[size]}`}
      />
      <input
        ref={inputRef}
        type="text"
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full bg-neo-bg border border-neo-border rounded-lg
          text-white placeholder-neo-dim
          focus:ring-1 focus:ring-neo-primary focus:border-neo-primary outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${sizeClasses[size]}
          ${showClearButton && internalValue ? 'pr-8' : ''}
        `}
      />
      {showClearButton && internalValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neo-dim hover:text-white transition-colors p-1"
          aria-label="Clear search"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
