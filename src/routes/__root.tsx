import { useEffect } from 'react'
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { ToastProvider } from '../components/ui/Toast'
import { SITE_JSON_LD, SITE_ORIGIN, defaultOgMeta } from '../lib/og'
import { ADSENSE_CLIENT_ID } from '../lib/ads'
import { WEB_ANALYTICS_TOKEN } from '../lib/analytics'
import { installPressFeedback } from '../lib/motion'

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
      // ページ側で head を持たないルート(ログインなど)の既定。
      { title: 'ShuttleMatch — バドミントンの試合表・ダブルスの組み合わせ作成' },
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
  // 正規URL。同じ中身が www・CloudFront の既定ドメイン・EC2 の IP でも 200 で返るため、
  // どこを見に来られても評価が s-match.net に集まるように宣言しておく。
  // クエリは落とす(?openExternalBrowser=1 が付いた URL を別ページ扱いさせない)。
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // AdSense のスクリプトは JSX(SSR/ハイドレーション対象)に置かず、マウント後に
  // 素の DOM 操作で <head> に足す。AdSense 自身のスクリプトが早いタイミングで
  // 自分のタグまわりの <head> を書き換えることがあり、React が SSR した内容と
  // 食い違って hydration mismatch(React error #418)を起こすのを確認したため
  // (2026-08-27 調査。ローカルで AdSense タグの有無だけを切り替えて再現/非再現を
  // 複数回確認済み、原因の DOM 差分そのものは特定できていない)。
  // ここに置けば React はこのタグの存在を最初から知らない(hydrate 対象外な)ので、
  // AdSense が何をしても React 側とは衝突しない。サイト確認・クロールに要る
  // 「<head> にタグが存在すること」は、マウント直後に足す形でも満たせる。
  // ボタン・カードの押し込み+波紋(マイクロインタラクション)。イベント委譲で全ページに効く。
  useEffect(() => installPressFeedback(), [])

  useEffect(() => {
    if (!import.meta.env.PROD) return
    if (document.querySelector('script[src*="pagead2.googlesyndication.com"]')) return
    const script = document.createElement('script')
    script.async = true
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`
    script.crossOrigin = 'anonymous'
    document.head.appendChild(script)
  }, [])

  return (
    <html lang="ja">
      <head>
        <HeadContent />
        <link rel="canonical" href={`${SITE_ORIGIN}${pathname}`} />
        {/* 構造化データ。検索結果で「何をする道具か」を機械可読で伝える。
            サイト全体の情報なので全ページの head に置く(ページ固有の情報は入れない)。 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }}
        />
        {/* AdSense のサイト確認・広告配信スクリプトは、下の useEffect で
            マウント後に足す(理由はそこのコメントを参照)。
            広告そのものは /game の AdSlot にしか出さない(Auto ads は使わない方針、
            AdSense 管理画面でも Auto ads は無効のままにすること)。 */}
        {/* Cloudflare Web Analytics。Cookie を使わず個人を識別しないので同意バナーは不要
            (プライバシーポリシーには利用している旨を書いてある)。本番かつトークンが
            設定されているときだけ読み込む — 開発・E2E のアクセスを数えないため。
            このサイトは Cloudflare の Proxy を通していない(DNS only。CloudFront が
            TLS を終端する)ので、スニペットの自動注入は効かない。手動で置くこの1行が要る。
            type="module" は Cloudflare が配布しているスニペットに合わせている。 */}
        {import.meta.env.PROD && WEB_ANALYTICS_TOKEN ? (
          <script
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: WEB_ANALYTICS_TOKEN })}
          />
        ) : null}
      </head>
      {/* フッターを常に最下部へ落とすため、body を縦フレックスにして main を伸ばす。
          高さは dvh(表示中のビューポート)。スマホのアドレスバーぶん 100vh が実際の表示領域より
          大きくなり、コンテンツが短いページで不要なスクロールが出るのを避ける。 */}
      <body className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
        <ToastProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            {/* ページが切り替わるたびに中身をふわっと出す(key で再マウントしてアニメを再生)。 */}
            <div key={pathname} className="animate-page-in">
              {children}
            </div>
          </main>
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
