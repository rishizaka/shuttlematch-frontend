import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    // `npm run dev:host` で LAN に公開してスマホ実機から見るとき用。ブラウザ側から
    // localhost:8080 には届かないので、/api を dev サーバー経由で backend に中継する
    // (本番の serve.mjs と同じ形)。PC の localhost からは api.ts が直叩きするので未使用。
    proxy: { '/api': 'http://localhost:8080' },
  },
})

export default config
