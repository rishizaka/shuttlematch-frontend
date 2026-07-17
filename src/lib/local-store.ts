import type { User } from './types'

// MVP の暫定ストア。
// バックエンドにはまだ認証 (Cognito) と一覧取得エンドポイントが無いため、
// ・現在のユーザー identity
// ・作成/参加した circle / room の ID 一覧
// をブラウザの localStorage に保持してダッシュボードを成立させる。
// 認証導入後は currentUser を Cognito 由来に、ID 一覧をサーバの一覧 API に置き換える。
//
// useSyncExternalStore から参照されるため、各 getter はキャッシュした
// 不変スナップショットを返し、write 時のみ新しい参照に差し替える。

const KEYS = {
  currentUser: 'shuttlematch.currentUser',
  roomIds: 'shuttlematch.roomIds',
} as const

type Listener = () => void
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l()
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readRaw<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

interface Cache {
  currentUser: User | null
  roomIds: string[]
}

let cache: Cache | null = null

function ensureCache(): Cache {
  if (cache == null) {
    cache = {
      currentUser: readRaw<User | null>(KEYS.currentUser, null),
      roomIds: readRaw<string[]>(KEYS.roomIds, []),
    }
  }
  return cache
}

function persist(key: string, value: unknown) {
  if (isBrowser()) {
    window.localStorage.setItem(key, JSON.stringify(value))
  }
  emit()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ---- current user ----

export function getCurrentUser(): User | null {
  return ensureCache().currentUser
}

export function setCurrentUser(user: User | null) {
  ensureCache().currentUser = user
  persist(KEYS.currentUser, user)
}

// ---- known room ids ----

export function getRoomIds(): string[] {
  return ensureCache().roomIds
}

export function addRoomId(id: string) {
  const c = ensureCache()
  if (!c.roomIds.includes(id)) {
    c.roomIds = [id, ...c.roomIds]
    persist(KEYS.roomIds, c.roomIds)
  }
}

export function removeRoomId(id: string) {
  const c = ensureCache()
  c.roomIds = c.roomIds.filter((x) => x !== id)
  persist(KEYS.roomIds, c.roomIds)
}

// ---- self participant (試合表で「自分の番号」を覚える) ----
// ルームごとに「自分が何番か」を保存する任意設定。試合表で自分の試合を
// 強調表示するためだけに使い、サーバー(DB)には送らない。
// あくまでローカルの見やすさ設定なので、他の参加者と番号が重複しても構わない。

const SELF_PREFIX = 'shuttlematch.self.'

export interface SelfParticipant {
  participantId?: string
}

export function getSelfParticipant(roomId: string): SelfParticipant | null {
  return readRaw<SelfParticipant | null>(SELF_PREFIX + roomId, null)
}

export function setSelfParticipant(roomId: string, participantId: string) {
  if (isBrowser()) {
    window.localStorage.setItem(SELF_PREFIX + roomId, JSON.stringify({ participantId }))
  }
  emit()
}

export function removeSelfParticipant(roomId: string) {
  if (isBrowser()) {
    window.localStorage.removeItem(SELF_PREFIX + roomId)
  }
  emit()
}
