import { test, expect } from '@playwright/test';
import { Neo4jConnectionHelper, CypherQueryHelper } from '../utils/test-helpers';

/**
 * UI 功能 E2E 测试
 */

test.describe('UI 功能', () => {
  let page;
  let connHelper: Neo4jConnectionHelper;
  let queryHelper: CypherQueryHelper;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    connHelper = new Neo4jConnectionHelper(p);
    queryHelper = new CypherQueryHelper(p);
  });

  test('应该正确加载应用', async () => {
    // 1. 访问首页
    await page.goto('http://localhost:3000');

    // 2. 验证页面标题
    await expect(page).toHaveTitle(/Neo4j OmniVis/);

    // 3. 验证登录表单显示
    await expect(page.locator('text=安全图数据库连接网关')).toBeVisible();
    await expect(page.locator('text=Neo4j OmniVis')).toBeVisible();
  });

  test('应该显示登录表单', async () => {
    // 1. 访问首页
    await page.goto('http://localhost:3000');

    // 2. 验证所有字段显示
    await expect(page.locator('input[placeholder*="连接名称"]')).toBeVisible();
    await expect(page.locator('select[name="protocol"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="主机地址"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="端口"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="用户名"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('应该显示试用演示模式按钮', async () => {
    // 1. 访问首页
    await page.goto('http://localhost:3000');

    // 2. 验证演示模式按钮
    await expect(page.locator('text=试用演示模式（模拟数据）')).toBeVisible();
  });

  test('应该切换主题', async () => {
    // 1. 访问首页
    await page.goto('http://localhost:3000');

    // 2. 验证主题切换按钮
    await expect(page.locator('button:has(.text-neo-dim):has(.w-6)')).toBeVisible();

    // 3. 点击主题切换
    await page.click('button:has(.text-neo-dim):has(.w-6)');
    await page.waitForTimeout(500);

    // 4. 验证主题已切换
    const htmlElement = await page.locator('html').first();
    const theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('应该显示侧边栏', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await page.click('text=试用演示模式（模拟数据）');
    await page.waitForTimeout(2000);

    // 2. 验证侧边栏显示
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('text=新建连接')).toBeVisible();
  });

  test('应该显示工作区', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await page.click('text=试用演示模式（模拟数据）');
    await page.waitForTimeout(2000);

    // 2. 验证工作区显示
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('text=CYPHER 编辑器')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button:has-text("运行")')).toBeVisible();
  });

  test('应该显示 Cypher 编辑器', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await page.click('text=试用演示模式（模拟数据）');
    await page.waitForTimeout(2000);

    // 2. 验证 Cypher 编辑器
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('textarea')).toHaveValue(/MATCH.*LIMIT/);
  });

  test('应该显示添加节点按钮', async () => {
    // 1. 连接（使用演示模式）
    await page.goto('http://localhost:3000');
    await page.click('text=试用演示模式（模拟数据）');
    await page.waitForTimeout(2000);

    // 2. 验证添加节点按钮
    await expect(page.locator('button:has-text("添加节点")')).toBeVisible();
  });

  test('应该正确处理响应式设计', async () => {
    // 1. 设置视口大小（移动端）
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000');

    // 2. 验证移动端布局
    await expect(page.locator('aside')).toHaveCSS({ width: '100%' });

    // 3. 连接（使用演示模式）
    await page.click('text=试用演示模式（模拟数据）');
    await page.waitForTimeout(2000);

    // 4. 验证工作区在移动端正常显示
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();

    // 5. 恢复桌面视口
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
