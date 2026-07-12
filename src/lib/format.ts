import type { Participant, RoomStatus } from './types'

/** ISO 日時を日本時間で「2026/06/30 19:00」形式に整形する。 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** ISO 日時を日本時間で「19:05」形式 (時:分) に整形する。 */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** datetime-local 入力 (ローカル時刻) を OffsetDateTime 形式に変換する。 */
export function toOffsetDateTime(localValue: string): string {
  // localValue 例: "2026-06-30T19:00" をローカルタイムゾーンとして解釈する。
  const date = new Date(localValue)
  return date.toISOString()
}

const SESSION_STATUS_LABELS: Record<RoomStatus, string> = {
  PREPARING: '準備中',
  OPEN: '参加受付中',
  GENERATED: '試合生成済み',
  CLOSED: '終了',
}

export function roomStatusLabel(status: RoomStatus): string {
  return SESSION_STATUS_LABELS[status] ?? status
}

/**
 * 参加者の表示名を返す。
 * 登録ユーザーは names マップ (userId -> 名前) から解決し、見つからなければ ID を短縮表示。
 * ゲストは guestName をそのまま使う。
 */
export function participantDisplayName(
  participant: Participant,
  names: ReadonlyMap<string, string> = new Map(),
): string {
  if (participant.guest) {
    return participant.guestName ?? 'ゲスト'
  }
  if (participant.userId) {
    return names.get(participant.userId) ?? shortId(participant.userId)
  }
  return shortId(participant.id)
}

/** UUID を先頭 8 文字に短縮する。 */
export function shortId(id: string): string {
  return id.slice(0, 8)
}

/**
 * ゲストがまだ自己申告しておらず、guestName が既定値(機械採番の数字)のままかどうかを判定する。
 * かんたん作成は連番の数字を仮名として振るため、「数字のみ(または空)の名前」を未申告とみなす。
 * 一覧内の位置(index)との一致で判定すると、途中の参加者を削除したときに
 * 位置がずれて誤判定する(例: 4番を削除すると「5」という名前がそのまま表示される)。
 */
export function isUnclaimedGuestName(participant: Participant): boolean {
  const name = (participant.guestName ?? '').trim()
  return participant.guest && (name === '' || /^\d+$/.test(name))
}

/**
 * 参加者の表示名を返す。未申告(番号のまま)のゲストは「ゲスト」と表示する。
 * コート表示・参加者一覧など、番号バッジと並べて名前を出す箇所向け。
 */
export function participantDisplayNameForList(
  participant: Participant,
  names: ReadonlyMap<string, string> = new Map(),
): string {
  return isUnclaimedGuestName(participant)
    ? 'ゲスト'
    : participantDisplayName(participant, names)
}

/**
 * 日本時間での「その日」の開始・終了(いずれもUTCの瞬間、ISO文字列)を返す。
 * from は当日0時(JST)以上、to は翌日0時(JST)未満として API の絞り込みに使う。
 * JST は UTC+9 固定(夏時間なし)。
 */
export function jstDayRange(now: Date = new Date()): { from: string; to: string } {
  const DAY_MS = 86_400_000
  const JST_OFFSET_MS = 9 * 3_600_000
  const dayStartJst = Math.floor((now.getTime() + JST_OFFSET_MS) / DAY_MS) * DAY_MS
  const fromMs = dayStartJst - JST_OFFSET_MS
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(fromMs + DAY_MS).toISOString(),
  }
}

/**
 * ルームタイトルの初期値。今日の日付 + 時間帯ラベル。
 * 〜15時: 昼練 / 15時台: 夕練 / 16時〜: 夜練。
 */
export function defaultRoomTitle(now: Date = new Date()): string {
  const label = now.getHours() < 15 ? '昼練' : now.getHours() < 16 ? '夕練' : '夜練'
  return `${now.getMonth() + 1}/${now.getDate()} ${label}`
}
