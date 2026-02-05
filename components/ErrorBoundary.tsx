import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * 错误边界组件
 *
 * 功能：
 * - 捕获子组件中的JavaScript错误
 * - 显示友好的错误界面
 * - 提供重试机制
 *
 * 设计原则：
 * - 不依赖具体的渲染方式（Canvas、SVG、WebGL等）
 * - 提供可自定义的错误显示
 * - 支持错误上报
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  resetKeys?: Array<any>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 错误边界组件
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<ErrorFallback />}
 *   onError={(error, errorInfo) => {
 *     console.error('Error caught:', error, errorInfo);
 *     // 上报错误到监控系统
 *   }}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // 调用错误回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 默认的错误日志
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { error: currentError, hasError } = this.state;

    // 如果存在 resetKeys，检查是否需要重置
    if (hasError && currentError) {
      const { resetKeys } = this.props;
      const { resetKeys: prevResetKeys } = prevProps;

      // 如果 resetKeys 发生变化，重置错误状态
      if (prevResetKeys && resetKeys) {
        const hasChanged =
          prevResetKeys.length !== resetKeys.length ||
          prevResetKeys.some((key, index) => key !== resetKeys[index]);

        if (hasChanged) {
          this.reset();
        }
      }
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, enableRetry = true } = this.props;

    if (!hasError) {
      return children;
    }

    // 如果提供了自定义的 fallback，使用它
    if (fallback) {
      return fallback;
    }

    // 默认的错误显示
    return (
      <div className="flex items-center justify-center min-h-screen bg-neo-bg text-neo-text p-4">
        <div className="max-w-lg w-full bg-neo-panel rounded-xl border border-neo-border p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
              <svg
                className="w-6 h-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">出现错误</h2>
              <p className="text-sm text-neo-dim">
                应用遇到了一个错误，请尝试刷新页面
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <p className="text-sm text-red-400 font-medium mb-2">
                {error.message || '未知错误'}
              </p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-neo-dim cursor-pointer hover:text-white">
                    查看错误详情
                  </summary>
                  <pre className="mt-2 p-3 bg-neo-bg rounded-lg text-xs font-mono text-neo-dim overflow-x-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {enableRetry && (
              <button
                onClick={this.reset}
                className="flex-1 py-2 px-4 bg-neo-primary hover:bg-white text-black font-medium rounded-lg transition-colors"
              >
                重试
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2 px-4 bg-neo-panel hover:bg-neo-bg text-neo-text border border-neo-border font-medium rounded-lg transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * HOC: withErrorBoundary
 *
 * 为组件添加错误边界的便捷方式
 *
 * @example
 * ```tsx
 * const MyComponent = withErrorBoundary(() => {
 *   return <div>...</div>;
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedWithErrorBoundary = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };

  WrappedWithErrorBoundary.displayName = `withErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return WrappedWithErrorBoundary;
}

export default ErrorBoundary;
