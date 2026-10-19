/**
 * 管理者トークン(運営者本人が全ランダム表を閲覧するための秘密)の保管。
 *
 * サーバー側の `APP_ADMIN_TOKEN` と同じ値を `/admin` で一度貼ると、この端末に保存され、
 * 以降は一覧 API に `X-Admin-Token` として付く。トークンが合っていると一覧に roomId が
 * 載るので、自分が作成・参加していないランダム表も開けるようになる。
 *
 * **できるのは閲覧だけ**。削除や試合表の変更には効かない(サーバー側で見ていない)。
 * localStorage に平文で置くので、共有端末では使わないこと。
 */
const KEY = 'shuttlematch.adminToken'

/** 保存されている管理者トークン。SSR やブラウザ外では null。 */
export function getAdminToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(KEY)
  } catch {
    // プライベートブラウジングなどで localStorage が使えない環境。
    return null
  }
}

export function setAdminToken(token: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, token)
  } catch {
    /* 保存できない環境では管理者モードを使わない、で構わない */
  }
}

export function clearAdminToken(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 同上 */
  }
}
