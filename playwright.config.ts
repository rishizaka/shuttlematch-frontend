import { defineConfig, devices } from '@playwright/test'

// E2E の対象URL。既定はローカル(vite dev の 3000)。本番スモークは E2E_BASE_URL で差し替える。
//   ローカル: backend(8080) と `npm run dev`(3000) を起動してから `npm run e2e`
//   本番    : E2E_BASE_URL=https://s-match.net npm run e2e:prod
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const isLocal = !process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // ルームを作る副作用があるので直列で安定させる
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // ローカル対象のときだけ vite dev を自動起動する(backend は別途起動しておく)。
  webServer: isLocal
    ? {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
      }
    : undefined,
})
