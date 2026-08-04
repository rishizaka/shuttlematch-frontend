import type { Room } from './types'

/**
 * サイトの正規オリジン。og:url の絶対 URL と共有リンクの生成に使う。
 * 既定は本番ドメイン。別ホストへ向けたいときだけ VITE_SITE_ORIGIN で上書きする。
 */
export const SITE_ORIGIN: string =
  (import.meta.env?.VITE_SITE_ORIGIN as string | undefined)?.replace(/\/$/, '') ??
  'https://s-match.net'

/**
 * 共有リンクの基点。
 * 本番は必ず正規ドメインを使う(CloudFront の既定ドメインや EC2 の IP で開いていても、
 * 配る URL は s-match.net に揃える)。開発中は今開いているオリジンを使う。
 */
export function shareOrigin(): string {
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    return window.location.origin
  }
  return SITE_ORIGIN
}

export const SITE_NAME = 'ShuttleMatch'
export const SITE_DESCRIPTION = 'バドミントンの試合表をかんたん作成・共有'

/** サイト共通の OGP / Twitter カードメタタグ(ルートに置く)。画像は使わない。 */
export function defaultOgMeta() {
  return [
    { name: 'description', content: SITE_DESCRIPTION },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: SITE_NAME },
    { property: 'og:description', content: SITE_DESCRIPTION },
  ]
}

/**
 * リリースノート詳細ページの OGP メタタグ。
 *
 * サイト共通(defaultOgMeta)では og:image を出さない方針だが、リリース告知は
 * 共有されて嬉しいページなので、見出し画像があるときだけカード画像を付ける。
 * og:image は絶対 URL でないとクローラーが解決できない。
 */
export function releaseOgMeta(
  release: { id: string; title: string; summary: string; hero?: { src: string; width: number; height: number } },
) {
  const title = `${release.title} — ${SITE_NAME} リリースノート`
  const meta: Array<Record<string, string>> = [
    { title },
    { name: 'description', content: release.summary },
    { property: 'og:type', content: 'article' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: release.summary },
    { property: 'og:url', content: `${SITE_ORIGIN}/release/${release.id}` },
  ]
  if (release.hero) {
    meta.push(
      { property: 'og:image', content: `${SITE_ORIGIN}${release.hero.src}` },
      { property: 'og:image:width', content: String(release.hero.width) },
      { property: 'og:image:height', content: String(release.hero.height) },
      { name: 'twitter:card', content: 'summary_large_image' },
    )
  }
  return meta
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
