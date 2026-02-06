/**
 * 错误处理工具 - DDD 架构共享层
 * 统一错误处理逻辑
 */

/**
 * 格式化错误消息
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error occurred';
}

/**
 * 创建带前缀的错误处理器
 */
export function createErrorHandler(prefix: string) {
  return (error: unknown): string => {
    const message = formatError(error);
    console.error(`[${prefix}]`, message);
    return `${prefix}: ${message}`;
  };
}

/**
 * 安全执行函数，捕获错误
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('[safeExecute] Error:', formatError(error));
    return defaultValue;
  }
}

/**
 * 带重试的安全执行
 */
export async function safeExecuteWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, retryDelay = 1000, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        onRetry?.(attempt, error);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * 错误类型判断
 */
export function isNetworkError(error: unknown): boolean {
  const message = formatError(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('econnrefused')
  );
}

export function isAuthError(error: unknown): boolean {
  const message = formatError(error).toLowerCase();
  return (
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('credentials')
  );
}

export function isNotFoundError(error: unknown): boolean {
  const message = formatError(error).toLowerCase();
  return (
    message.includes('not found') ||
    message.includes('does not exist') ||
    message.includes('no such')
  );
}
