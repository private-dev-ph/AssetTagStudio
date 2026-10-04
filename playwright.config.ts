import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', fullyParallel: true, workers: 2, timeout: 60_000, expect: { timeout: 12_000 }, use: { baseURL: 'http://127.0.0.1:4173', headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }, webServer: { command: 'npm run build && node tests/serve-production.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false }, reporter: 'list' });


