import { test, expect } from '@playwright/test';
import { Neo4jConnectionHelper, CypherQueryHelper, PerformanceMonitorHelper, GraphVisualizationHelper } from '../utils/test-helpers';

/**
 * 性能优化功能 E2E 测试
 * 参考：https://playwright.dev/docs/writing-tests
 */

test.describe('性能优化功能', () => {
  let page;
  let connHelper: Neo4jConnectionHelper;
  let queryHelper: CypherQueryHelper;
  let perfHelper: PerformanceMonitorHelper;
  let graphHelper: GraphVisualizationHelper;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    connHelper = new Neo4jConnectionHelper(p);
    queryHelper = new CypherQueryHelper(p);
    perfHelper = new PerformanceMonitorHelper(p);
    graphHelper = new GraphVisualizationHelper(p);
  });

  test('应该显示性能优化提示', async () => {
    // 1. 使用演示模式连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行一个大数据集查询
    await queryHelper.fillCypherQuery('MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 500');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 验证性能优化提示显示
    await perfHelper.expectPerformanceOptimizationEnabled();
    await perfHelper.expectCanvasRenderingEnabled();
    await perfHelper.expectViewportCullingEnabled();
    await perfHelper.expectLODRenderingEnabled();
    await perfHelper.expectPerformanceMonitorEnabled();
  });

  test('应该显示性能监控面板', async () => {
    // 1. 使用演示模式连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 打开性能监控面板
    await perfHelper.openPerformanceMonitor();

    // 4. 验证性能指标显示
    await perfHelper.expectFPSVisible();
    await perfHelper.expectMemoryVisible();
    await perfHelper.expectRenderTimeVisible();
  });

  test('应该显示 Canvas 渲染', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 200');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 验证 Canvas 渲染
    await queryHelper.expectGraphRendered();

    // 4. 截图验证
    const screenshot = await graphHelper.takeGraphScreenshot();
    expect(screenshot).toBeTruthy();
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('应该支持缩放', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 记录初始 FPS
    await perfHelper.openPerformanceMonitor();
    const initialFPS = await perfHelper.getFPS();

    // 4. 放大
    await graphHelper.zoomIn();
    await page.waitForTimeout(500);

    // 5. 验证 FPS 改善
    const zoomedFPS = await perfHelper.getFPS();
    expect(zoomedFPS).toBeGreaterThanOrEqual(initialFPS);
  });

  test('应该支持平移', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 平移
    await graphHelper.panGraph(100, 100);
    await page.waitForTimeout(500);

    // 4. 验证图表仍然可见
    await queryHelper.expectGraphRendered();
  });

  test('应该支持点击节点', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 点击节点
    await graphHelper.clickNode(0);
    await page.waitForTimeout(500);

    // 4. 验证节点详情面板打开
    await graphHelper.expectNodeDetailPanelOpen();
  });

  test('应该在大数据集时保持流畅', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行大数据集查询
    await queryHelper.fillCypherQuery('MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 1000');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 等待性能稳定
    await page.waitForTimeout(3000);

    // 4. 验证 FPS 仍然流畅
    await perfHelper.openPerformanceMonitor();
    const fps = await perfHelper.getFPS();
    expect(fps).toBeGreaterThan(20);
  });

  test('应该正确显示性能指标', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 记录性能指标
    const metrics = await graphHelper.recordPerformanceMetrics();

    // 4. 验证性能指标
    expect(metrics.fps).toBeGreaterThan(0);
    expect(metrics.fpsText).toBeTruthy();
    expect(metrics.timestamp).toBeTruthy();
  });

  test('应该在不同缩放级别使用 LOD 渲染', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 500');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 缩小到最小级别（dots 模式）
    for (let i = 0; i < 5; i++) {
      await graphHelper.zoomOut();
      await page.waitForTimeout(200);
    }

    // 4. 放大（dots -> simple -> with-labels -> full）
    for (let i = 0; i < 10; i++) {
      await graphHelper.zoomIn();
      await page.waitForTimeout(200);
    }

    // 5. 验证 FPS 保持流畅
    await perfHelper.openPerformanceMonitor();
    const fps = await perfHelper.getFPS();
    expect(fps).toBeGreaterThan(15);
  });

  test('应该在视锥体外不渲染元素', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 平移到边缘
    await graphHelper.panGraph(500, 500);
    await page.waitForTimeout(1000);

    // 4. 记录性能
    const metricsBefore = await graphHelper.recordPerformanceMetrics();

    // 5. 平移回中心
    await graphHelper.panGraph(-500, -500);
    await page.waitForTimeout(1000);

    // 6. 记录性能
    const metricsAfter = await graphHelper.recordPerformanceMetrics();

    // 7. 验证视锥体裁剪有效
    expect(metricsAfter.fps).toBeGreaterThan(metricsBefore.fps);
  });

  test('应该显示错误信息', async () => {
    // 1. 填写无效的连接信息
    await connHelper.fillConnectionForm({
      name: 'Test Connection',
      protocol: 'bolt',
      host: 'invalid-host',
      port: '7687',
      username: 'neo4j',
      password: 'invalid',
      database: ''
    });

    // 2. 点击连接
    await connHelper.clickConnect();

    // 3. 验证错误信息显示
    await connHelper.expectConnectionError();
  });

  test('应该支持查询历史', async () => {
    // 1. 连接
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行多个查询
    const queries = [
      'MATCH (n) RETURN n LIMIT 100',
      'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 200',
      'MATCH (n:Person) RETURN n LIMIT 50'
    ];

    for (const query of queries) {
      await queryHelper.fillCypherQuery(query);
      await queryHelper.clickRun();
      await queryHelper.waitForResults();
    }

    // 3. 验证最后一个查询的结果
    await queryHelper.expectGraphRendered();
  });
});
