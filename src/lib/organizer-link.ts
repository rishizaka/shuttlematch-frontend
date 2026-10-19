/**
 * 運営者用リンク(別の端末・共同運営者に運営権を渡すリンク)の組み立てと読み取り。
 *
 * 形は `/rooms/{roomId}/matches#organizer={運営者トークン}`。トークンを `#` 以降(フラグメント)に
 * 置くのは、ブラウザがフラグメントをサーバーへ送らないため。アクセスログやプロキシに
 * トークンが残らない。共有リンク(/r/{code})にトークンを足す形にしなかったのも同じ理由で、
 * 参加者向けのリンクと見た目からはっきり分ける意味もある。
 */

const KEY = 'organizer'

/** 運営者用リンクの URL。origin は shareOrigin() を渡す。 */
export function organizerLinkUrl(origin: string, roomId: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/rooms/${roomId}/matches#${KEY}=${encodeURIComponent(token)}`
}

/** location.hash から運営者トークンを取り出す。無ければ null。 */
export function readOrganizerTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const token = params.get(KEY)?.trim()
  return token ? token : null
}
