import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { Header } from '../components/layout/Header'
import { ToastProvider } from '../components/ui/Toast'
import { defaultOgMeta } from '../lib/og'

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
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <ToastProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
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
