/**
 * ルームの「公開ID」の算出。roomId の SHA-256 の先頭16桁(hex)。
 *
 * 一覧 API (`GET /api/v1/rooms`) は roomId を返さない。認証がまだ無く、roomId が割れると
 * 誰でもそのルームを削除・改変できてしまうため。かわりにサーバーはこの公開IDを返すので、
 * 「作成した」「参加した」などで既に roomId を知っている端末だけが、手元の roomId を
 * 同じ式でハッシュして突き合わせ、一致した行にリンクを張れる。
 *
 * backend の `PublicRoomId.java` と同じ式。**変えると照合が全て外れる**ので固定とみなすこと。
 *
 * crypto.subtle は secure context (https / localhost) でしか使えない。それ以外の環境では
 * 照合ができないため、リンクの無い一覧として表示にとどめる(null を返す)。
 */
const LENGTH = 16

export async function publicRoomId(roomId: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const bytes = new TextEncoder().encode(roomId)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, LENGTH)
}

/** roomId の一覧から「公開ID → roomId」の対応表を作る。照合に使う。 */
export async function publicRoomIdMap(roomIds: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    roomIds.map(async (id) => [await publicRoomId(id), id] as const),
  )
  const map = new Map<string, string>()
  for (const [publicId, id] of entries) {
    if (publicId) map.set(publicId, id)
  }
  return map
}
