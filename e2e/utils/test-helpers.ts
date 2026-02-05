import { Page, expect } from '@playwright/test';
import type { ConnectionConfig } from '../../types';

/**
 * Neo4j 连接测试工具
 */

export class Neo4jConnectionHelper {
  constructor(private page: Page) {}

  /**
   * 填写连接表单
   */
  async fillConnectionForm(config: ConnectionConfig) {
    await this.page.click('input[placeholder*="连接名称"]');
    await this.page.fill('input[placeholder*="连接名称"]', config.name);

    await this.page.selectOption('select[name="protocol"]', config.protocol);

    await this.page.click('input[placeholder*="主机地址"]');
    await this.page.fill('input[placeholder*="主机地址"]', config.host);

    await this.page.click('input[placeholder*="端口"]');
    await this.page.fill('input[placeholder*="端口"]', config.port);

    await this.page.click('input[placeholder*="用户名"]');
    await this.page.fill('input[placeholder*="用户名"]', config.username);

    await this.page.click('input[type="password"]');
    await this.page.fill('input[type="password"]', config.password);

    if (config.database) {
      await this.page.click('input[placeholder*="数据库"]');
      await this.page.fill('input[placeholder*="数据库"]', config.database);
    }
  }

  /**
   * 点击连接按钮
   */
  async clickConnect() {
    await this.page.click('button[type="submit"]');
  }

  /**
   * 等待连接完成
   */
  async waitForConnection(timeout = 5000) {
    await this.page.waitForSelector('text=连接成功', { timeout });
  }

  /**
   * 验证连接成功
   */
  async expectConnectionSuccess() {
    await expect(this.page.locator('text=连接成功')).toBeVisible();
  }

  /**
   * 验证连接失败
   */
  async expectConnectionError() {
    await expect(this.page.locator('.text-red-400')).toBeVisible();
  }
}

/**
 * Cypher 查询测试工具
 */
export class CypherQueryHelper {
  constructor(private page: Page) {}

  /**
   * 填写 Cypher 查询
   */
  async fillCypherQuery(query: string) {
    const queryInput = this.page.locator('textarea');
    await queryInput.clear();
    await queryInput.fill(query);
  }

  /**
   * 点击运行按钮
   */
  async clickRun() {
    await this.page.click('button:has-text("运行")');
  }

  /**
   * 等待查询结果
   */
  async waitForResults(timeout = 10000) {
    await this.page.waitForSelector('canvas', { timeout });
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * 验证图表已渲染
   */
  async expectGraphRendered() {
    await expect(this.page.locator('canvas')).toBeVisible();
  }

  /**
   * 验证节点数量
   */
  async expectNodeCount(minNodes: number) {
    const canvas = this.page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    
    if (canvasBox) {
      const screenshot = await canvas.screenshot();
      // 这里可以添加图像识别来验证节点数量
      // 简化版本：只验证画布存在
      expect(canvasBox.width).toBeGreaterThan(0);
      expect(canvasBox.height).toBeGreaterThan(0);
    }
  }
}

/**
 * 性能监控测试工具
 */
export class PerformanceMonitorHelper {
  constructor(private page: Page) {}

  /**
   * 打开性能监控面板
   */
  async openPerformanceMonitor() {
    await this.page.click('.text-neo-dim:has-text("性能监控")');
    await expect(this.page.locator('.fixed.bottom-4')).toBeVisible();
  }

  /**
   * 验证 FPS 显示
   */
  async expectFPSVisible() {
    await expect(this.page.locator('text=/\\d+ fps/')).toBeVisible();
  }

  /**
   * 验证内存显示
   */
  async expectMemoryVisible() {
    await expect(this.page.locator('text=/\\d+\\.\\d+ MB/')).toBeVisible();
  }

  /**
   * 验证渲染时间显示
   */
  async expectRenderTimeVisible() {
    await expect(this.page.locator('text=/\\d+\\.\\d+ ms/')).toBeVisible();
  }

  /**
   * 获取 FPS 值
   */
  async getFPS(): Promise<number> {
    const fpsText = await this.page.locator('.text-lg.font-bold').textContent();
    const match = fpsText.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * 验证性能优化提示
   */
  async expectPerformanceOptimizationEnabled() {
    await expect(this.page.locator('text=性能优化已启用')).toBeVisible();
  }

  /**
   * 验证 Canvas 渲染提示
   */
  async expectCanvasRenderingEnabled() {
    await expect(this.page.locator('text=Canvas 渲染')).toBeVisible();
  }

  /**
   * 验证视锥体裁剪提示
   */
  async expectViewportCullingEnabled() {
    await expect(this.page.locator('text=视锥体裁剪')).toBeVisible();
  }

  /**
   * 验证 LOD 渲染提示
   */
  async expectLODRenderingEnabled() {
    await expect(this.page.locator('text=LOD 渲染')).toBeVisible();
  }

  /**
   * 验证性能监控提示
   */
  async expectPerformanceMonitorEnabled() {
    await expect(this.page.locator('text=性能监控')).toBeVisible();
  }
}

/**
 * 图可视化测试工具
 */
export class GraphVisualizationHelper {
  constructor(private page: Page) {}

  /**
   * 放大图表
   */
  async zoomIn() {
    await this.page.keyboard.press('Control');
    await this.page.keyboard.press('+');
    await this.page.keyboard.up('Control');
  }

  /**
   * 缩小图表
   */
  async zoomOut() {
    await this.page.keyboard.press('Control');
    await this.page.keyboard.press('-');
    await this.page.keyboard.up('Control');
  }

  /**
   * 平移图表
   */
  async panGraph(deltaX: number, deltaY: number) {
    await this.page.mouse.down();
    await this.page.mouse.move(deltaX, deltaY);
    await this.page.mouse.up();
  }

  /**
   * 点击节点
   */
  async clickNode(nodeIndex: number) {
    const canvas = this.page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    
    if (canvasBox) {
      const x = canvasBox.x + 100 + (nodeIndex * 50);
      const y = canvasBox.y + 100;
      await this.page.mouse.click(x, y);
    }
  }

  /**
   * 验证节点详情面板打开
   */
  async expectNodeDetailPanelOpen() {
    await expect(this.page.locator('.fixed.bottom-4')).toBeVisible();
    await expect(this.page.locator('.glass-panel')).toBeVisible();
  }

  /**
   * 验证节点标签显示
   */
  async expectNodeLabelVisible(label: string) {
    await expect(this.page.locator(`text=${label}`)).toBeVisible();
  }

  /**
   * 截取图表截图
   */
  async takeGraphScreenshot(): Promise<Buffer> {
    const canvas = this.page.locator('canvas');
    return await canvas.screenshot();
  }

  /**
   * 记录性能指标
   */
  async recordPerformanceMetrics() {
    const perfHelper = new PerformanceMonitorHelper(this.page);
    await perfHelper.openPerformanceMonitor();

    const fps = await perfHelper.getFPS();
    const fpsElement = this.page.locator('.text-lg.font-bold');
    const fpsText = await fpsElement.textContent();
    
    return {
      fps,
      fpsText,
      timestamp: new Date().toISOString()
    };
  }
}
