import type { Room } from './types'

/**
 * OGP の絶対 URL 生成に使うサイトのオリジン。
 * og:image / og:url は絶対 URL が必須のため、本番ビルドでは
 * VITE_SITE_ORIGIN(例: https://xxxx.cloudfront.net)を設定する。
 */
export const SITE_ORIGIN: string =
  (import.meta.env?.VITE_SITE_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? ''

export const SITE_NAME = 'ShuttleMatch'
export const SITE_DESCRIPTION = 'バドミントンの試合表をかんたん作成・共有'

/** サイト共通の OGP / Twitter カードメタタグ(ルートに置く)。 */
export function defaultOgMeta() {
  return [
    { name: 'description', content: SITE_DESCRIPTION },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: SITE_NAME },
    { property: 'og:description', content: SITE_DESCRIPTION },
    { property: 'og:image', content: `${SITE_ORIGIN}/og-image.png` },
    { name: 'twitter:card', content: 'summary_large_image' },
  ]
}

/**
 * ルーム系ページの動的 OGP メタタグ。
 * クローラーは JS を実行しないため、route の loader で取得した room を
 * head() から渡して SSR の HTML に含めること。
 */
export function roomOgMeta(room: Room, path: string, suffix: string) {
  const title = `${room.title} | ${SITE_NAME}`
  const description = `参加者${room.participantCount}人・コート${room.courtCount ?? 1}面の${suffix}`
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: `${SITE_ORIGIN}${path}` },
  ]
}
