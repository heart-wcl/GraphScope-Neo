/**
 * Event Bus - 事件总线
 * 提供组件间松耦合通信
 */

type EventHandler<T = any> = (payload: T) => void;
type EventMatcher = (event: string) => boolean;

class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private onceListeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * 订阅事件
   */
  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // 返回取消订阅函数
    return () => this.off(event, handler);
  }

  /**
   * 订阅一次（触发后自动取消）
   */
  once<T = any>(event: string, handler: EventHandler<T>): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler);
  }

  /**
   * 取消订阅
   */
  off(event: string, handler?: EventHandler): void {
    if (handler) {
      this.listeners.get(event)?.delete(handler);
      this.onceListeners.get(event)?.delete(handler);
    } else {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    }
  }

  /**
   * 发布事件
   */
  emit<T = any>(event: string, payload?: T): void {
    // 触发普通监听器
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    });

    // 触发一次性监听器
    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers?.size) {
      onceHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in once handler for "${event}":`, error);
        }
      });
      this.onceListeners.delete(event);
    }
  }

  /**
   * 订阅模式（使用正则表达式）
   */
  onPattern<T = any>(pattern: RegExp, handler: EventHandler<T>): () => void {
    const matcher: EventMatcher = (event: string) => pattern.test(event);

    // 收集所有匹配的事件
    const matchingEvents = Array.from(this.listeners.keys()).filter(matcher);

    const unsubscribers = matchingEvents.map(event => {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event)!.add(handler);

      return () => this.off(event, handler);
    });

    // 返回取消所有订阅的函数
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
    this.onceListeners.clear();
  }

  /**
   * 获取监听器数量
   */
  listenerCount(event?: string): number {
    if (event) {
      return (this.listeners.get(event)?.size || 0) + 
             (this.onceListeners.get(event)?.size || 0);
    }
    return Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0) +
           Array.from(this.onceListeners.values()).reduce((sum, set) => sum + set.size, 0);
  }
}

// 全局单例
export const globalEventBus = new EventBus();

// 事件类型常量
export const EVENT_TYPES = {
  // 图形事件
  NODE_CLICKED: 'node:clicked',
  NODE_HOVERED: 'node:hovered',
  NODE_SELECTED: 'node:selected',
  NODE_DESELECTED: 'node:deselected',
  RELATION_CLICKED: 'relation:clicked',
  GRAPH_ZOOMED: 'graph:zoomed',
  GRAPH_PANNED: 'graph:panned',

  // 查询事件
  QUERY_STARTED: 'query:started',
  QUERY_COMPLETED: 'query:completed',
  QUERY_FAILED: 'query:failed',
  QUERY_CLEARED: 'query:cleared',

  // 数据事件
  DATA_LOADED: 'data:loaded',
  DATA_CLEARED: 'data:cleared',
  NODE_CREATED: 'node:created',
  NODE_UPDATED: 'node:updated',
  NODE_DELETED: 'node:deleted',
  RELATION_CREATED: 'relation:created',
  RELATION_UPDATED: 'relation:updated',
  RELATION_DELETED: 'relation:deleted',

  // 性能事件
  PERFORMANCE_METRICS: 'performance:metrics',
  VIEWPORT_CHANGED: 'viewport:changed',
  LOD_CHANGED: 'lod:changed',

  // UI 事件
  MODAL_OPENED: 'modal:opened',
  MODAL_CLOSED: 'modal:closed',
  SIDEBAR_TOGGLED: 'sidebar:toggled',
  THEME_CHANGED: 'theme:changed',
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

export default EventBus;
