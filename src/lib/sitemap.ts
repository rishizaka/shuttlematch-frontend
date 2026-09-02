import { GAMES } from '../components/game/catalog'
import { GUIDES } from './guides'
import { GYMS } from './gyms'
import { RELEASES } from './releases'

/** 公開サイトのオリジン。sitemap は絶対URLでなければならない。 */
export const SITE_ORIGIN = 'https://s-match.net'

type Entry = {
  path: string
  /** 'YYYY-MM-DD'。無ければ出力しない(嘘の更新日を書くくらいなら省く)。 */
  lastmod?: string
  /** 0.0〜1.0。サイト内での相対的な重み。 */
  priority: number
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

/**
 * sitemap に載せる URL の一覧。
 *
 * **試合表(/rooms/{id}/matches)は載せない。** 中身が番号の並びだけで読み物としての
 * 実体が無く、練習会のたびに増え続けるため、大量に載せるとサイト全体の評価を下げうる。
 * 過去の試合表は /past からリンクしてあるので、クロール自体はそこから辿れる。
 *
 * 認証や個人の端末に紐づくページ(/organizer/rooms/new、/join/{id}、/r/{code}、
 * /login、/signup)も載せない。検索から来ても意味が無いか、他人のルームに入る導線になる。
 */
export function sitemapEntries(buildDate: string): Entry[] {
  const latestRelease = RELEASES[0]?.date

  return [
    { path: '/', priority: 1.0, changefreq: 'daily' },
    { path: '/about', priority: 0.9, changefreq: 'monthly' },
    { path: '/past', priority: 0.6, changefreq: 'daily' },
    { path: '/game', priority: 0.8, changefreq: 'monthly' },
    ...GAMES.map((g): Entry => ({ path: g.to, priority: 0.7, changefreq: 'monthly' })),
    { path: '/guide', priority: 0.8, changefreq: 'monthly' },
    ...GUIDES.map((g): Entry => ({
      path: `/guide/${g.id}`,
      lastmod: g.date,
      priority: 0.7,
      changefreq: 'monthly',
    })),
    { path: '/gym', priority: 0.7, changefreq: 'monthly' },
    ...GYMS.map((g): Entry => ({
      path: `/gym/${g.id}`,
      lastmod: g.date,
      priority: 0.6,
      changefreq: 'monthly',
    })),
    { path: '/releases', lastmod: latestRelease, priority: 0.6, changefreq: 'weekly' },
    ...RELEASES.map((r): Entry => ({
      path: `/release/${r.id}`,
      lastmod: r.date,
      priority: 0.5,
      changefreq: 'yearly',
    })),
    { path: '/privacy', lastmod: buildDate, priority: 0.3, changefreq: 'yearly' },
    { path: '/terms', lastmod: buildDate, priority: 0.3, changefreq: 'yearly' },
  ]
}

/** sitemap.xml の中身を組み立てる。buildDate は 'YYYY-MM-DD'。 */
export function buildSitemapXml(buildDate: string): string {
  const urls = sitemapEntries(buildDate)
    .map((e) => {
      const lines = [`    <loc>${SITE_ORIGIN}${e.path}</loc>`]
      if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`)
      lines.push(`    <changefreq>${e.changefreq}</changefreq>`)
      lines.push(`    <priority>${e.priority.toFixed(1)}</priority>`)
      return `  <url>\n${lines.join('\n')}\n  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
