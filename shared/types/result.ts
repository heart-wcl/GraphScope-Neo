/**
 * 通用结果类型 - DDD 架构共享层
 * 用于统一所有操作的返回值格式
 */

/**
 * 通用操作结果
 */
export interface Result<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 验证结果
 */
export interface ValidationResult<T = void> {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  data?: T;
}

/**
 * 异步操作状态
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// ============= 工厂函数 =============

/**
 * Result 工厂函数
 */
export const Result = {
  /**
   * 创建成功结果
   */
  success: <T>(data?: T): Result<T> => ({
    success: true,
    data
  }),

  /**
   * 创建失败结果
   */
  failure: (error: string, warnings?: string[]): Result<never> => ({
    success: false,
    error,
    warnings
  }),

  /**
   * 从错误对象创建失败结果
   */
  fromError: (error: unknown): Result<never> => ({
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  }),

  /**
   * 检查是否成功
   */
  isSuccess: <T>(result: Result<T>): result is Result<T> & { data: T } => {
    return result.success && result.data !== undefined;
  },

  /**
   * 检查是否失败
   */
  isFailure: <T>(result: Result<T>): result is Result<T> & { error: string } => {
    return !result.success && result.error !== undefined;
  }
};

/**
 * ValidationResult 工厂函数
 */
export const Validation = {
  /**
   * 创建有效结果
   */
  valid: <T>(data?: T): ValidationResult<T> => ({
    isValid: true,
    errors: [],
    data
  }),

  /**
   * 创建无效结果
   */
  invalid: (errors: string[], warnings?: string[]): ValidationResult<never> => ({
    isValid: false,
    errors,
    warnings
  }),

  /**
   * 合并多个验证结果
   */
  merge: <T>(...results: ValidationResult<T>[]): ValidationResult<T[]> => {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const allData: T[] = [];

    for (const result of results) {
      allErrors.push(...result.errors);
      if (result.warnings) {
        allWarnings.push(...result.warnings);
      }
      if (result.data !== undefined) {
        allData.push(result.data);
      }
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      data: allData
    };
  }
};

/**
 * PaginatedResult 工厂函数
 */
export const Paginated = {
  /**
   * 创建分页结果
   */
  create: <T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number
  ): PaginatedResult<T> => ({
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total
  }),

  /**
   * 创建空分页结果
   */
  empty: <T>(page = 1, pageSize = 10): PaginatedResult<T> => ({
    items: [],
    total: 0,
    page,
    pageSize,
    hasMore: false
  })
};
