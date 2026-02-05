import { test as base } from '@playwright/test';
import { Page } from '@playwright/test';

/**
 * 基础测试工具
 * 参考：https://playwright.dev/docs/api/class-fixtures
 */

type PageFixtures = {
  page: Page;
};

export const test = base.extend<PageFixtures>({
  page: async ({ page }, use) => {
    // 清空浏览器存储
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await use(page);
  },
});
