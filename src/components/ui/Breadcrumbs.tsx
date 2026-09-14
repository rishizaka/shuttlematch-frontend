import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { SITE_ORIGIN } from '../../lib/og'

/**
 * 中間の項目はサイト内の固定パスにしか張らない(型安全なLinkのtoで表現できる範囲に絞る)。
 * 最後の項目は現在地なのでリンクを持たない。
 */
export type BreadcrumbItem =
  | { label: string; to: '/' | '/guide' | '/gym' | '/releases' }
  | { label: string }

/**
 * パンくずナビゲーション + BreadcrumbList構造化データ。
 *
 * 表示用のnavと検索エンジン向けのJSON-LDを1つのコンポーネントにまとめてあるのは、
 * 画面に出す文言と構造化データの文言がずれる(片方だけ更新し忘れる)事故を防ぐため。
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...('to' in item ? { item: `${SITE_ORIGIN}${item.to}` } : {}),
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="パンくずリスト">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-1">
              {i > 0 ? <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden /> : null}
              {'to' in item ? (
                <Link to={item.to} className="hover:text-brand-600 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-slate-700">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}
