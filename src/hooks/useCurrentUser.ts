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

/** 既知の room ID 一覧を購読する。 */
export function useKnownRoomIds(): string[] {
  return useSyncExternalStore(subscribe, getRoomIds, () => [])
}
