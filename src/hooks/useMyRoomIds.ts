import { useEffect, useState } from 'react'
import { useKnownRoomIds } from './useCurrentUser'
import { publicRoomIdMap } from '../lib/public-room-id'

/**
 * 一覧の `publicId` から手元の roomId を引くための対応表を作る。
 *
 * 一覧 API は roomId を返さないため、「作成した」「参加した」で localStorage に貯めた
 * roomId をハッシュして突き合わせる。表に載っているルームだけがリンクになる。
 * ハッシュ計算は非同期なので、初回描画では空の表(＝リンクなし)を返し、計算後に差し替わる。
 */
export function useMyRoomIdByPublicId(): Map<string, string> {
  const roomIds = useKnownRoomIds()
  const [map, setMap] = useState<Map<string, string>>(() => new Map())

  useEffect(() => {
    let cancelled = false
    void publicRoomIdMap(roomIds).then((m) => {
      if (!cancelled) setMap(m)
    })
    return () => {
      cancelled = true
    }
  }, [roomIds])

  return map
}
