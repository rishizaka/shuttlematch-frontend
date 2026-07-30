import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { ToastProvider } from '../components/ui/Toast'
import { defaultOgMeta } from '../lib/og'
import { ADSENSE_CLIENT_ID } from '../lib/ads'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ShuttleMatch — バドミントンの試合表をかんたん作成・共有' },
      ...defaultOgMeta(),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // タブ用の favicon(16/32/48)だけをグローバルに置く。
      // 大きい PNG アイコン(icon.png 512 / apple-touch-icon 180)は、LINE 等が
      // og:image 不在時に「リンクカードのサムネイル」として拾ってしまうため head には出さない
      // (試合表をリンクで多用するので画像はノイズになる)。favicon.ico は小さすぎてカード画像には使われない。
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48 32x32 16x16' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
        {/* AdSense のサイト確認・広告配信スクリプト。全ページの head に置く必要がある
            (Google が所有権確認のためにクロールする)。本番ビルドでだけ読み込む
            (import.meta.env.DEV は Vite がビルド時に静的展開するので、ここで判定を
            忘れても開発サーバーに実広告のスクリプトが載ることはない)。
            広告そのものは /game の AdSlot にしか出さない(Auto ads は使わない方針、
            AdSense 管理画面でも Auto ads は無効のままにすること)。 */}
        {import.meta.env.PROD ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      {/* フッターを常に最下部へ落とすため、body を縦フレックスにして main を伸ばす。
          高さは dvh(表示中のビューポート)。スマホのアドレスバーぶん 100vh が実際の表示領域より
          大きくなり、コンテンツが短いページで不要なスクロールが出るのを避ける。 */}
      <body className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
        <ToastProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
          <Footer />
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        </ToastProvider>
        <Scripts />
      </body>
    </html>
  )
}
