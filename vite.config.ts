import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { buildSitemapXml } from './src/lib/sitemap'

/**
 * sitemap.xml をビルド時に生成してクライアント側の出力に置く。
 *
 * URL の一覧は src/lib/sitemap.ts が持っていて、リリースノートとミニゲームは
 * それぞれの原本(RELEASES / GAMES)から作る。記事やゲームを足せば自動で載るので、
 * sitemap の更新を忘れることがない。
 */
function sitemap(): Plugin {
  return {
    name: 'shuttlematch-sitemap',
    apply: 'build',
    // クライアント側のビルドでだけ出す(SSR 側でも走らせると二重に出力される)
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle() {
      const buildDate = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: buildSitemapXml(buildDate),
      })
    },
  }
}

/**
 * 各機能の src/features/(機能名)/index.ts(公開窓口)を「副作用なし」として扱わせる。
 *
 * Rollup は既定で窓口ファイルにも副作用があるとみなすので、ルートが窓口から1つ import しただけで
 * 窓口が re-export しているモジュールが全部ついてくる(2026-11-22、ミニゲームを features に移したら
 * 5本のコアが1つの 65KB チャンクにまとまり、各ゲームページと /game が全ゲーム分を読むようになった)。
 * 窓口が `export ... from` だけでできていることは src/test/architecture.test.ts が固定しているので、
 * この宣言は嘘にならない。
 */
function featureIndexHasNoSideEffects(): Plugin {
  const isFeatureIndex = /\/src\/features\/[^/]+\/index\.ts$/
  return {
    name: 'shuttlematch-feature-index-no-side-effects',
    transform(code, id) {
      if (!isFeatureIndex.test(id)) return null
      return { code, map: null, moduleSideEffects: false }
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact(), sitemap(), featureIndexHasNoSideEffects()],
  server: {
    // `npm run dev:host` で LAN に公開してスマホ実機から見るとき用。ブラウザ側から
    // localhost:8080 には届かないので、/api を dev サーバー経由で backend に中継する
    // (本番の serve.mjs と同じ形)。PC の localhost からは api.ts が直叩きするので未使用。
    // 別ポートで動かした backend に向けたいとき(E2E で作業ブランチを検証するなど)は
    // DEV_API_PROXY_TARGET で差し替える。
    proxy: { '/api': process.env.DEV_API_PROXY_TARGET ?? 'http://localhost:8080' },
  },
})

export default config
