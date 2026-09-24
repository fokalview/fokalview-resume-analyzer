import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: {baseURL:'http://127.0.0.1:8788', trace:'retain-on-failure'},
  workers: 1,
  webServer: {
    command: 'npm run dev:api',
    url: 'http://127.0.0.1:8788/api/health',
    reuseExistingServer: false,
    timeout: 90000,
    env: {WRANGLER_SEND_METRICS:'false'}
  }
});
