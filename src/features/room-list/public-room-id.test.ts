import { describe, expect, it } from 'vitest'
import { publicRoomId, publicRoomIdMap } from './public-room-id'

// backend の PublicRoomIdTest と同じ値を持つ。どちらかの式が変わると照合が全て外れ、
// TOP から自分のルームに入れなくなるので、両側で同じ期待値を固定しておく。
const ROOM_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const PUBLIC_ID = 'c7aa09cd25da8b6a'

describe('publicRoomId', () => {
  it('backend と同じ公開IDを返す', async () => {
    expect(await publicRoomId(ROOM_ID)).toBe(PUBLIC_ID)
  })

  it('公開IDから roomId を引く表を作る', async () => {
    const map = await publicRoomIdMap([ROOM_ID])
    expect(map.get(PUBLIC_ID)).toBe(ROOM_ID)
    expect(map.get('0000000000000000')).toBeUndefined()
  })
})
