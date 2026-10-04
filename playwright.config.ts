import { defineConfig } from '@playwright/test';
const deployedUrl = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, workers: 2,
  timeout: 60_000, expect: { timeout: 12_000 },
  use: { baseURL: deployedUrl || 'http://127.0.0.1:4173', headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) },
  webServer: deployedUrl ? undefined : { command: 'npm run build && node tests/serve-production.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  reporter: 'list',
});
