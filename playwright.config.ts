import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL, trace: 'retain-on-failure' },
  // ponytail: one browser is enough for a student project; add firefox/webkit if a persona uses them
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true },
});
