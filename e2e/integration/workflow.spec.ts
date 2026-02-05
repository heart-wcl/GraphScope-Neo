import { test, expect } from '@playwright/test';
import { Neo4jConnectionHelper, CypherQueryHelper } from '../utils/test-helpers';

/**
 * 集成测试
 */

test.describe('集成测试', () => {
  let page;
  let connHelper: Neo4jConnectionHelper;
  let queryHelper: CypherQueryHelper;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    connHelper = new Neo4jConnectionHelper(p);
    queryHelper = new CypherQueryHelper(p);
  });

  test('完整的工作流程：连接 -> 查询 -> 可视化', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 验证工作区显示
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();

    // 3. 执行查询
    const query = 'MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100';
    await queryHelper.fillCypherQuery(query);
    await queryHelper.clickRun();

    // 4. 等待结果
    await queryHelper.waitForResults();

    // 5. 验证图表渲染
    await queryHelper.expectGraphRendered();
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('完整的工作流程：创建节点', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 点击添加节点按钮
    await page.click('button:has-text("添加节点")');

    // 3. 填写节点信息
    await page.fill('input[placeholder*="节点标签"]', 'Person');
    await page.fill('input[placeholder*="key"]', 'name');
    await page.fill('input[placeholder*="value"]', 'Alice');

    // 4. 点击创建
    await page.click('button[type="submit"]:has-text("创建节点")');
    await page.waitForTimeout(1000);

    // 5. 验证节点已创建
    await page.click('text=添加节点');
    await expect(page.locator('text=Alice')).toBeVisible();
  });

  test('完整的工作流程：创建关系', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行查询
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 点击节点
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      await page.mouse.click(canvasBox.x + 200, canvasBox.y + 200);
    }

    // 4. 等待节点详情
    await page.waitForTimeout(500);

    // 5. 点击添加关系按钮
    await page.click('button:has-text("添加节点")');
    await page.waitForTimeout(500);

    // 6. 填写关系信息
    await page.fill('input[placeholder*="关系类型"]', 'FRIEND_OF');
    await page.click('input[placeholder*="目标节点"]');

    // 7. 选择第一个节点
    await page.click('div:has-text("Person"):first');

    // 8. 点击创建
    await page.click('button[type="submit"]:has-text("创建关系")');
    await page.waitForTimeout(1000);

    // 9. 验证关系已创建
    await queryHelper.clickRun();
    await queryHelper.waitForResults();
  });

  test('完整的工作流程：性能优化验证', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 执行大数据集查询
    await queryHelper.fillCypherQuery('MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 500');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();

    // 3. 等待性能稳定
    await page.waitForTimeout(3000);

    // 4. 打开性能监控
    await page.click('.text-neo-dim:has-text("性能监控")');

    // 5. 验证性能指标
    await expect(page.locator('.text-lg.font-bold')).toBeVisible();
    await expect(page.locator('.fixed.bottom-4')).toBeVisible();

    // 6. 验证性能优化提示
    await expect(page.locator('text=性能优化已启用')).toBeVisible();
    await expect(page.locator('text=Canvas 渲染')).toBeVisible();
    await expect(page.locator('text=视锥体裁剪')).toBeVisible();
    await expect(page.locator('text=LOD 渲染')).toBeVisible();
    await expect(page.locator('text=性能监控')).toBeVisible();
  });

  test('完整的工作流程：主题切换', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 验证默认主题（暗色）
    let htmlElement = await page.locator('html').first();
    let theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('dark');

    // 3. 切换主题
    await page.click('button:has(.text-neo-dim):has(.w-6)');
    await page.waitForTimeout(500);

    // 4. 验证主题已切换（亮色）
    htmlElement = await page.locator('html').first();
    theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('light');

    // 5. 再次切换主题
    await page.click('button:has(.text-neo-dim):has(.w-6)');
    await page.waitForTimeout(500);

    // 6. 验证主题已切换回暗色
    htmlElement = await page.locator('html').first();
    theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('完整的工作流程：响应式设计验证', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await connHelper.clickConnect();
    await connHelper.waitForConnection();

    // 2. 桌面端
    await page.setViewportSize({ width: 1280, height: 720 });
    await queryHelper.fillCypherQuery('MATCH (n) RETURN n LIMIT 100');
    await queryHelper.clickRun();
    await queryHelper.waitForResults();
    await expect(page.locator('canvas')).toBeVisible();

    // 3. 平板端
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // 4. 移动端
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('aside')).toHaveCSS({ width: '100%' });
  });
});
