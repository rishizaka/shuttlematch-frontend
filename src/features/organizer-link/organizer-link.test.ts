import { describe, expect, it } from 'vitest'
import { organizerLinkUrl, readOrganizerTokenFromHash } from './organizer-link'

describe('運営者用リンク', () => {
  it('トークンはフラグメント(#)に入れる(サーバーへ送られない)', () => {
    const url = organizerLinkUrl('https://s-match.net/', 'room-1', 'abc_DEF-123')
    expect(url).toBe('https://s-match.net/rooms/room-1/matches#organizer=abc_DEF-123')
    expect(new URL(url).search).toBe('')
  })

  it('作ったリンクのフラグメントから同じトークンを読み戻せる', () => {
    const url = new URL(organizerLinkUrl('https://s-match.net', 'room-1', 'a+b/c='))
    expect(readOrganizerTokenFromHash(url.hash)).toBe('a+b/c=')
  })

  it('トークンが無い・空なら null', () => {
    expect(readOrganizerTokenFromHash('')).toBeNull()
    expect(readOrganizerTokenFromHash('#')).toBeNull()
    expect(readOrganizerTokenFromHash('#organizer=')).toBeNull()
    expect(readOrganizerTokenFromHash('#other=1')).toBeNull()
  })
})
