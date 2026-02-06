/**
 * Plugin System - 插件系统
 * 支持动态加载和扩展功能
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
  dependencies?: string[];
  permissions?: string[];
  configSchema?: any;
}

export interface PluginContext {
  eventBus: any;
  diContainer: any;
  config: Record<string, any>;
  registerHook: (hookName: string, handler: Function) => void;
  registerCommand: (command: PluginCommand) => void;
}

export interface PluginCommand {
  id: string;
  name: string;
  description: string;
  handler: (...args: any[]) => any;
}

export interface PluginHookPoint {
  name: string;
  description: string;
  handlers: Function[];
}

export interface Plugin {
  manifest: PluginManifest;
  instance: any;
  isEnabled: boolean;
  hooks: Map<string, Function[]>;
  commands: Map<string, PluginCommand>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hookPoints: Map<string, PluginHookPoint> = new Map();
  private commands: Map<string, PluginCommand> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * 加载插件
   */
  async loadPlugin(manifestUrl: string): Promise<void> {
    try {
      // 加载插件清单
      const response = await fetch(manifestUrl);
      const manifest: PluginManifest = await response.json();

      // 加载插件代码
      const module = await import(manifest.main);

      // 初始化插件
      const pluginInstance = new module.default(this.context);

      // 注册插件
      const plugin: Plugin = {
        manifest,
        instance: pluginInstance,
        isEnabled: false,
        hooks: new Map(),
        commands: new Map()
      };

      this.plugins.set(manifest.id, plugin);

      // 调用插件的 onRegister
      if (pluginInstance.onRegister) {
        await pluginInstance.onRegister(this.createPluginAPI(plugin));
      }

      console.log(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      console.error(`Failed to load plugin from ${manifestUrl}:`, error);
      throw error;
    }
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    try {
      // 调用插件的 onUnregister
      if (plugin.instance.onUnregister) {
        await plugin.instance.onUnregister();
      }

      // 清理钩子
      plugin.hooks.forEach((handlers, hookName) => {
        const hookPoint = this.hookPoints.get(hookName);
        if (hookPoint) {
          hookPoint.handlers = hookPoint.handlers.filter(
            h => !handlers.includes(h)
          );
        }
      });

      // 清理命令
      plugin.commands.forEach((command, commandId) => {
        this.commands.delete(commandId);
      });

      // 删除插件
      this.plugins.delete(pluginId);

      console.log(`Plugin unloaded: ${plugin.manifest.name}`);
    } catch (error) {
      console.error(`Failed to unload plugin "${pluginId}":`, error);
      throw error;
    }
  }

  /**
   * 启用插件
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    if (plugin.instance.onEnable) {
      await plugin.instance.onEnable();
    }

    plugin.isEnabled = true;
    console.log(`Plugin enabled: ${plugin.manifest.name}`);
  }

  /**
   * 禁用插件
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    if (plugin.instance.onDisable) {
      await plugin.instance.onDisable();
    }

    plugin.isEnabled = false;
    console.log(`Plugin disabled: ${plugin.manifest.name}`);
  }

  /**
   * 执行钩子
   */
  async executeHook<T = any>(hookName: string, payload: T): Promise<any> {
    const hookPoint = this.hookPoints.get(hookName);
    if (!hookPoint) {
      return payload;
    }

    let result = payload;

    for (const handler of hookPoint.handlers) {
      try {
        const handlerResult = await handler(result);
        if (handlerResult !== undefined) {
          result = handlerResult;
        }
      } catch (error) {
        console.error(`Error in hook "${hookName}":`, error);
      }
    }

    return result;
  }

  /**
   * 注册钩子点
   */
  registerHookPoint(name: string, description: string): void {
    this.hookPoints.set(name, { name, description, handlers: [] });
  }

  /**
   * 执行命令
   */
  async executeCommand(commandId: string, ...args: any[]): Promise<any> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command "${commandId}" not found`);
    }

    return await command.handler(...args);
  }

  /**
   * 获取插件列表
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取启用的插件
   */
  getEnabledPlugins(): Plugin[] {
    return this.getPlugins().filter(p => p.isEnabled);
  }

  /**
   * 获取命令列表
   */
  getCommands(): PluginCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * 获取钩子点列表
   */
  getHookPoints(): PluginHookPoint[] {
    return Array.from(this.hookPoints.values());
  }

  /**
   * 创建插件 API
   */
  private createPluginAPI(plugin: Plugin): any {
    return {
      // 钩子注册
      registerHook: (hookName: string, handler: Function) => {
        const hookPoint = this.hookPoints.get(hookName);
        if (!hookPoint) {
          this.registerHookPoint(hookName, `Hook for ${hookName}`);
        }

        hookPoint.handlers.push(handler);
        plugin.hooks.set(hookName, [
          ...(plugin.hooks.get(hookName) || []),
          handler
        ]);
      },

      // 命令注册
      registerCommand: (command: PluginCommand) => {
        this.commands.set(command.id, command);
        plugin.commands.set(command.id, command);
      },

      // 事件总线
      eventBus: this.context.eventBus,

      // DI 容器
      diContainer: this.context.diContainer,

      // 配置
      config: this.context.config,

      // 插件信息
      plugin: plugin.manifest,
    };
  }
}

// 预定义的钩子点
export const HOOK_POINTS = {
  // 查询钩子
  QUERY_BEFORE_EXECUTE: 'query:before:execute',
  QUERY_AFTER_EXECUTE: 'query:after:execute',
  QUERY_ERROR: 'query:error',

  // 数据钩子
  NODE_BEFORE_CREATE: 'node:before:create',
  NODE_AFTER_CREATE: 'node:after:create',
  NODE_BEFORE_DELETE: 'node:before:delete',
  NODE_AFTER_DELETE: 'node:after:delete',

  // 渲染钩子
  RENDER_BEFORE_FRAME: 'render:before:frame',
  RENDER_AFTER_FRAME: 'render:after:frame',
  RENDER_ERROR: 'render:error',

  // 性能钩子
  PERFORMANCE_BEFORE_MEASURE: 'performance:before:measure',
  PERFORMANCE_AFTER_MEASURE: 'performance:after:measure',
} as const;

export type HookPoint = typeof HOOK_POINTS[keyof typeof HOOK_POINTS];

export default PluginManager;
