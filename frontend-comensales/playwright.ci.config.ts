import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['junit', { outputFile: 'test-results/ci-junit.xml' }]],
  use: {
    baseURL: process.env.CI_FRONTEND_URL || 'http://127.0.0.1:43010',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.CI_CHROMIUM_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.CI_CHROMIUM_EXECUTABLE_PATH } } : {})
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
