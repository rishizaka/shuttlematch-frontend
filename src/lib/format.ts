import type {
  JoinPolicy,
  MemberRole,
  Participant,
  SessionStatus,
  SessionVisibility,
} from './types'

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

const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  PREPARING: '準備中',
  OPEN: '参加受付中',
  GENERATED: '試合生成済み',
  CLOSED: '終了',
}

export function sessionStatusLabel(status: SessionStatus): string {
  return SESSION_STATUS_LABELS[status] ?? status
}

const VISIBILITY_LABELS: Record<SessionVisibility, string> = {
  PUBLIC: '公開',
  MEMBERS_ONLY: 'メンバー限定',
}

export function visibilityLabel(visibility: SessionVisibility): string {
  return VISIBILITY_LABELS[visibility] ?? visibility
}

const JOIN_POLICY_LABELS: Record<JoinPolicy, string> = {
  OPEN: '自由参加',
  APPROVAL: '承認制',
}

export function joinPolicyLabel(policy: JoinPolicy): string {
  return JOIN_POLICY_LABELS[policy] ?? policy
}

const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  ORGANIZER: 'オーガナイザー',
  PLAYER: 'プレイヤー',
}

export function memberRoleLabel(role: MemberRole): string {
  return MEMBER_ROLE_LABELS[role] ?? role
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
