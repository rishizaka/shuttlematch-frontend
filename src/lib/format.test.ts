import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  joinPolicyLabel,
  memberRoleLabel,
  participantDisplayName,
  sessionStatusLabel,
  shortId,
  toOffsetDateTime,
} from './format'
import type { Participant } from './types'

describe('formatDateTime', () => {
  it('UTC の ISO 文字列を日本時間で整形する', () => {
    // 2026-06-30T10:00:00Z は JST で 19:00。
    expect(formatDateTime('2026-06-30T10:00:00Z')).toBe('2026/06/30 19:00')
  })

  it('不正な日付はそのまま返す', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('toOffsetDateTime', () => {
  it('ローカル日時を ISO (UTC) に変換する', () => {
    const iso = toOffsetDateTime('2026-06-30T19:00')
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(new Date(iso).getTime()).toBe(new Date('2026-06-30T19:00').getTime())
  })
})

describe('ラベル変換', () => {
  it('セッションステータス', () => {
    expect(sessionStatusLabel('OPEN')).toBe('参加受付中')
    expect(sessionStatusLabel('GENERATED')).toBe('試合生成済み')
  })
  it('参加方式', () => {
    expect(joinPolicyLabel('OPEN')).toBe('自由参加')
    expect(joinPolicyLabel('APPROVAL')).toBe('承認制')
  })
  it('メンバー役割', () => {
    expect(memberRoleLabel('ORGANIZER')).toBe('オーガナイザー')
    expect(memberRoleLabel('PLAYER')).toBe('プレイヤー')
  })
})

describe('shortId', () => {
  it('UUID を先頭 8 文字に短縮する', () => {
    expect(shortId('abcdef12-3456-7890-abcd-ef1234567890')).toBe('abcdef12')
  })
})

describe('participantDisplayName', () => {
  const guest: Participant = { id: 'p1', userId: null, guestName: '花子', guest: true }
  const member: Participant = { id: 'p2', userId: 'u-100', guestName: null, guest: false }

  it('ゲストは guestName を返す', () => {
    expect(participantDisplayName(guest)).toBe('花子')
  })

  it('登録ユーザーは names マップから名前を解決する', () => {
    const names = new Map([['u-100', '太郎']])
    expect(participantDisplayName(member, names)).toBe('太郎')
  })

  it('名前が解決できない登録ユーザーは ID を短縮表示する', () => {
    expect(participantDisplayName(member)).toBe('u-100')
  })

  it('guestName が無いゲストは既定文言を返す', () => {
    expect(participantDisplayName({ ...guest, guestName: null })).toBe('ゲスト')
  })
})
