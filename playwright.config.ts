import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Playwright 配置
 * 参考：https://playwright.dev/docs/test-configuration
 */

export default defineConfig({
  testDir: resolve(__dirname, './e2e'),

  /* 并发运行测试 */
  fullyParallel: true,

  /* 失败时重试 */
  retries: process.env.CI ? 2 : 0,

  /* 超时时间 */
  timeout: 30 * 1000,

  /* 期望配置 */
  expect: {
    /* 超时时间 */
    timeout: 5 * 1000
  },

  /* 使用配置 */
  use: {
    /* 基础 URL */
    baseURL: 'http://localhost:3000',

    /* 跟踪配置 */
    trace: 'on-first-retry',

    /* 截图配置 */
    screenshot: 'only-on-failure',

    /* 视频配置 */
    video: 'retain-on-failure',

    /* 测试报告 */
    actionTimeout: 10 * 1000,
    navigationTimeout: 15 * 1000,
  },

  /* 项目配置 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* 开发服务器（可选） */
  webServer: {
    command: 'npm run dev',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: true,
  },
});
