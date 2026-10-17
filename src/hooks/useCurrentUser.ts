import { useSyncExternalStore } from 'react'
import { getCurrentUser, getRoomIds, setCurrentUser, subscribe } from '../lib/local-store'
import type { User } from '../lib/types'

/**
 * localStorage 上の現在ユーザーを購読する。
 * SSR 時はサーバスナップショットとして null を返し、ハイドレーション後に同期する。
 */
export function useCurrentUser() {
  const user = useSyncExternalStore<User | null>(
    subscribe,
    getCurrentUser,
    () => null,
  )

  return {
    user,
    login: setCurrentUser,
    logout: () => setCurrentUser(null),
    isAuthenticated: user != null,
  }
}

/** SSR 時に返す空の一覧。**毎回同じ配列を返すこと** —
    `() => []` のように都度作ると参照が変わり続け、React が
    「getServerSnapshot の結果はキャッシュせよ(無限ループの恐れ)」と警告する。 */
const NO_ROOM_IDS: string[] = []

/** 既知の room ID 一覧を購読する。 */
export function useKnownRoomIds(): string[] {
  return useSyncExternalStore(subscribe, getRoomIds, () => NO_ROOM_IDS)
}
