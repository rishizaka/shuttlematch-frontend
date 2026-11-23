import { defineConfig } from '@playwright/test'

// UI 回帰テスト(e2e/ui/)。backend の代わりにモック API(e2e/ui/mock-api.mjs)を立て、
// 本番と同じビルド(serve.mjs)を固定データで開いて、見た目と UX の性質を確かめる。
// backend が要らず副作用も無いので CI で毎回走る(`npm run e2e:ui`)。
//
// スクショの基準画像は Linux(CI)で作ったものだけをコミットする(フォント描画が OS で違うため)。
// 見た目を意図して変えたら、PR の CI が落ちて差分画像が artifact に出る → 基準画像の更新は
// GitHub Actions の「UI regression」を手動実行(update_snapshots)して作り直す。手順は docs/feature-map.md。
const PORT = 4173
const MOCK_API_PORT = 8099

export default defineConfig({
  testDir: './e2e/ui',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    // 許容は既定(違う画素 0 個・画素ごとの色差 0.2)。以前は画素の 0.2% まで許していたが、
    // 小さな文字の色の変化(約300px)を見逃したため外した。基準画像は CI と同じ Linux で作るので揺れない。
  },
  workers: 1,
  retries: 0, // 揺れを retry で隠さない。揺れたらテストかデータを直す
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
      },
    },
  ],
  webServer: [
    {
      command: `MOCK_API_PORT=${MOCK_API_PORT} node e2e/ui/mock-api.mjs`,
      url: `http://localhost:${MOCK_API_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      // dist は `npm run e2e:ui` が VITE_API_BASE_URL をモックに向けてビルドしたもの。
      command: `PORT=${PORT} API_PROXY_TARGET=http://localhost:${MOCK_API_PORT} node serve.mjs`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
