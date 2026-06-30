import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

// テスト専用の Vite 設定。
// 本番用 vite.config.ts は TanStack Start(SSR) プラグインを含むため、
// jsdom 上のユニットテストでは React プラグインのみの軽量構成を使う。
export default defineConfig({
  plugins: [viteReact()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
