/**
 * 運営者が代理追加する遅刻者・ビジターの既定名。
 * この名前の枠は「まだ本人が埋めていない予約枠」とみなし、本人が「番号を指定」で
 * 自分の番号として当てはめられるようにする。
 */
export const VISITOR_PLACEHOLDER = '遅刻者・ビジター'

/**
 * 運営者が「番号とユーザーの紐付けを解いた」フリー枠の名前。
 * 早退とは別に、誰でも自由にそのコート枠に入れる在席枠として残す。
 */
export const FREE_SLOT = 'フリー'

/**
 * 「番号を指定」で名前を付けて(rename して)よい空き枠か。
 * 番号だけ(名前なし)の枠、運営者が用意した「遅刻者・ビジター」の予約枠、
 * 運営者が紐付けを解いた「フリー」枠を対象にする。
 * 実名で参加済みの枠は名簿を上書きしない(選ぶこと自体はでき、端末の紐付けだけ行う)。
 */
export function isClaimableSlot(guestName: string | null | undefined): boolean {
  if (!guestName) return true
  const t = guestName.trim()
  return /^\d+$/.test(t) || t === VISITOR_PLACEHOLDER || t === FREE_SLOT
}

/**
 * 名簿に出す表示名。番号のまま(まだ誰も名乗っていない)なら「空き」と表示する。
 * <p>
 * 「参加する」(QuickJoinBanner)は名前を空欄で押すと実際に guestName="ゲスト" として
 * 保存される。番号のままの未クレーム枠をここで「ゲスト」と表示してしまうと、
 * 「本当は誰かが名乗らずに参加した(guestName="ゲスト")」のか「まだ誰もこの番号を
 * 選んでいない(番号のまま)」のかが運営者から見分けられなくなる
 * (2026-09 に「2番が埋まらずゲストのまま」という報告があり、実際には見分けが
 * つかなかっただけ、というのがこの関数を作った経緯)。
 */
export function displayGuestName(guestName: string | null | undefined): string {
  const t = guestName?.trim() ?? ''
  if (!t || /^\d+$/.test(t)) return '空き'
  return t
}
