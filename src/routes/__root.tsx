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
      // ロゴのシャトル部分を切り出したアイコン。ico はタブ用(16/32/48)。
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48 32x32 16x16' },
      { rel: 'icon', type: 'image/png', href: '/icon.png', sizes: '512x512' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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
