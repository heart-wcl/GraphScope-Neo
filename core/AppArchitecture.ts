/**
 * Core Architecture Setup
 * 核心架构设置 - 初始化所有高可扩展性基础设施
 */

import { DIContainer, globalContainer } from './di/DIContainer';
import { PluginManager, globalEventBus, EVENT_TYPES } from './events/EventBus';
import { registerServices, SERVICE_IDS } from './services/ServiceRegistry';
import type { PerformanceConfig, ConnectionConfig } from '../types';

/**
 * 应用配置接口
 */
export interface AppConfig {
  // 连接配置
  connections: ConnectionConfig[];

  // 性能配置
  performance: PerformanceConfig;

  // 缓存配置
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };

  // 插件配置
  plugins: {
    enabled: boolean;
    autoLoad: string[]; // 自动加载的插件ID
    remoteManifests: string[]; // 远程插件清单URL
  };

  // 主题配置
  theme: {
    mode: 'dark' | 'light' | 'auto';
    customThemes: Record<string, any>;
  };
}

/**
 * 默认配置
 */
export const DEFAULT_APP_CONFIG: AppConfig = {
  connections: [],
  performance: {
    enableCulling: true,
    enableLOD: true,
    enableIncrementalLoad: true,
    cullingPadding: 50,
    lodThresholds: {
      DOT_MODE: 0.2,
      SIMPLE_MODE: 0.5,
      LABEL_MODE: 1.0
    }
  },
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5分钟
    maxSize: 100
  },
  plugins: {
    enabled: true,
    autoLoad: [],
    remoteManifests: []
  },
  theme: {
    mode: 'auto',
    customThemes: {}
  }
};

/**
 * 应用架构类
 */
export class AppArchitecture {
  private diContainer: DIContainer;
  private pluginManager: PluginManager;
  private config: AppConfig;
  private initialized: boolean = false;

  constructor(config: Partial<AppConfig> = {}) {
    this.config = { ...DEFAULT_APP_CONFIG, ...config };
    this.diContainer = globalContainer;
    this.pluginManager = new PluginManager({
      eventBus: globalEventBus,
      diContainer: this.diContainer,
      config: this.config,
      registerHook: this.registerHook.bind(this),
      registerCommand: this.registerCommand.bind(this)
    });
  }

  /**
   * 初始化架构
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('App already initialized');
      return;
    }

    console.log('🚀 Initializing Neo4j OmniVis Architecture...');

    try {
      // 1. 注册核心服务
      console.log('📦 Registering core services...');
      this.registerServices();

      // 2. 注册钩子点
      console.log('🎣 Registering hook points...');
      this.registerCoreHooks();

      // 3. 初始化事件总线
      console.log('📡 Initializing event bus...');
      this.initializeEventBus();

      // 4. 初始化插件管理器
      console.log('🔌 Initializing plugin manager...');
      await this.initializePlugins();

      // 5. 应用配置
      console.log('⚙️ Applying configuration...');
      this.applyConfiguration();

      // 6. 初始化性能监控
      console.log('📊 Starting performance monitoring...');
      this.startPerformanceMonitoring();

      this.initialized = true;

      console.log('✅ Architecture initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to initialize architecture:', error);
      throw error;
    }
  }

  /**
   * 注册核心服务
   */
  private registerServices(): void {
    registerServices(this.diContainer, {
      neo4j: { protocol: 'bolt', host: 'localhost', port: '7687', username: 'neo4j', password: 'neo4j123', database: 'neo4j' },
      performance: this.config.performance
    });
  }

  /**
   * 注册核心钩子点
   */
  private registerCoreHooks(): void {
    // 查询钩子
    this.pluginManager.registerHook('query:before:execute', 'Query Before Execute Hook');
    this.pluginManager.registerHook('query:after:execute', 'Query After Execute Hook');

    // 数据钩子
    this.pluginManager.registerHook('node:before:create', 'Node Before Create Hook');
    this.pluginManager.registerHook('node:after:create', 'Node After Create Hook');
    this.pluginManager.registerHook('node:before:delete', 'Node Before Delete Hook');
    this.pluginManager.registerHook('node:after:delete', 'Node After Delete Hook');

    // 渲染钩子
    this.pluginManager.registerHook('render:before:frame', 'Render Before Frame Hook');
    this.pluginManager.registerHook('render:after:frame', 'Render After Frame Hook');

    // 性能钩子
    this.pluginManager.registerHook('performance:before:measure', 'Performance Before Measure Hook');
    this.pluginManager.registerHook('performance:after:measure', 'Performance After Measure Hook');
  }

  /**
   * 初始化事件总线
   */
  private initializeEventBus(): void {
    // 监听主题变化
    globalEventBus.on(EVENT_TYPES.THEME_CHANGED, (payload: any) => {
      document.documentElement.setAttribute('data-theme', payload.value);
    });

    // 监听查询事件
    globalEventBus.on(EVENT_TYPES.QUERY_STARTED, (payload: any) => {
      console.log(`[Query] Started: ${payload.query}`);
    });

    globalEventBus.on(EVENT_TYPES.QUERY_COMPLETED, (payload: any) => {
      console.log(`[Query] Completed in ${payload.duration}ms`);
    });

    globalEventBus.on(EVENT_TYPES.QUERY_FAILED, (payload: any) => {
      console.error(`[Query] Failed: ${payload.error}`);
    });

    // 监听数据事件
    globalEventBus.on(EVENT_TYPES.DATA_LOADED, (payload: any) => {
      console.log(`[Data] Loaded: ${payload.key}`);
    });

    globalEventBus.on(EVENT_TYPES.NODE_CREATED, (payload: any) => {
      console.log(`[Node] Created: ${payload.nodeId}`);
    });

    // 监听性能事件
    globalEventBus.on(EVENT_TYPES.PERFORMANCE_METRICS, (payload: any) => {
      if (payload.metrics.fps < 30) {
        console.warn(`[Performance] Low FPS: ${payload.metrics.fps.toFixed(1)}`);
      }
      if (payload.metrics.memory > 500) {
        console.warn(`[Performance] High Memory: ${payload.metrics.memory.toFixed(1)}MB`);
      }
    });
  }

  /**
   * 初始化插件
   */
  private async initializePlugins(): Promise<void> {
    if (!this.config.plugins.enabled) {
      console.log('Plugins disabled');
      return;
    }

    // 加载自动加载的插件
    for (const manifestUrl of this.config.plugins.autoLoad) {
      try {
        await this.pluginManager.loadPlugin(manifestUrl);
      } catch (error) {
        console.error(`Failed to auto-load plugin from ${manifestUrl}:`, error);
      }
    }
  }

  /**
   * 应用配置
   */
  private applyConfiguration(): void {
    // 应用主题
    if (this.config.theme.mode !== 'auto') {
      document.documentElement.setAttribute('data-theme', this.config.theme.mode);
    }
  }

  /**
   * 开始性能监控
   */
  private startPerformanceMonitoring(): void {
    const monitor = this.diContainer.resolve(SERVICE_IDS.PERFORMANCE_MONITOR);
    if (monitor) {
      monitor.startMonitoring();
    }
  }

  /**
   * 注册钩子
   */
  private registerHook(hookName: string, handler: Function): void {
    globalEventBus.on(hookName, handler);
  }

  /**
   * 注册命令
   */
  private registerCommand(commandId: string, handler: Function): void {
    this.pluginManager.commands.set(commandId, {
      id: commandId,
      name: commandId,
      description: `Command: ${commandId}`,
      handler
    });
  }

  /**
   * 获取服务实例
   */
  getService<T = any>(serviceId: string): T {
    return this.diContainer.resolve<T>(serviceId);
  }

  /**
   * 获取插件管理器
   */
  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  /**
   * 获取事件总线
   */
  getEventBus(): typeof globalEventBus {
    return globalEventBus;
  }

  /**
   * 获取配置
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyConfiguration();
  }

  /**
   * 销毁架构
   */
  async destroy(): Promise<void> {
    console.log('🧹 Destroying Neo4j OmniVis Architecture...');

    // 停止性能监控
    const monitor = this.diContainer.resolve(SERVICE_IDS.PERFORMANCE_MONITOR);
    if (monitor) {
      monitor.stopMonitoring();
    }

    // 清理事件总线
    globalEventBus.clear();

    // 清理 DI 容器
    this.diContainer.clear();

    // 停止插件
    const plugins = this.pluginManager.getPlugins();
    for (const plugin of plugins) {
      await this.pluginManager.unloadPlugin(plugin.manifest.id);
    }

    this.initialized = false;

    console.log('✅ Architecture destroyed successfully!');
  }
}

/**
 * 创建应用架构实例
 */
export function createAppArchitecture(config?: Partial<AppConfig>): AppArchitecture {
  return new AppArchitecture(config);
}

export default AppArchitecture;
