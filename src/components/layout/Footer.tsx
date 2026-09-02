import { Link } from '@tanstack/react-router'
import { SITE_NAME } from '../../lib/og'

/**
 * サイト共通フッター。
 * プライバシーポリシーと利用規約は全ページから 1 クリックで到達できる必要があるため
 * (広告配信事業者の審査要件でもある)、ヘッダーのドロワーではなくフッターに常設する。
 */
/**
 * 表示年は JST で求める。SSR するサーバーは UTC、閲覧者の端末は JST なので、
 * ローカル時刻で年を出すと年またぎの数時間だけ両者がずれてハイドレーション不一致になる。
 */
function currentYearJst(): number {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCFullYear()
}

export function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <FooterLink to="/about">ShuttleMatch について</FooterLink>
          <FooterLink to="/guide">使い方ガイド</FooterLink>
          <FooterLink to="/gym">体育館レビュー</FooterLink>
          <FooterLink to="/releases">リリースノート</FooterLink>
          <FooterLink to="/privacy">プライバシーポリシー</FooterLink>
          <FooterLink to="/terms">利用規約</FooterLink>
        </nav>
        <p className="text-xs text-slate-400">
          © {currentYearJst()} {SITE_NAME}
        </p>
      </div>
    </footer>
  )
}

function FooterLink({
  to,
  children,
}: {
  to: '/about' | '/guide' | '/gym' | '/releases' | '/privacy' | '/terms'
  children: React.ReactNode
}) {
  return (
    <Link to={to} className="text-xs font-medium text-slate-500 transition hover:text-brand-600">
      {children}
    </Link>
  )
}
