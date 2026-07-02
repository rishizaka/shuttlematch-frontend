import type { User } from './types'

// MVP の暫定ストア。
// バックエンドにはまだ認証 (Cognito) と一覧取得エンドポイントが無いため、
// ・現在のユーザー identity
// ・作成/参加した circle / session の ID 一覧
// をブラウザの localStorage に保持してダッシュボードを成立させる。
// 認証導入後は currentUser を Cognito 由来に、ID 一覧をサーバの一覧 API に置き換える。
//
// useSyncExternalStore から参照されるため、各 getter はキャッシュした
// 不変スナップショットを返し、write 時のみ新しい参照に差し替える。

const KEYS = {
  currentUser: 'shuttlematch.currentUser',
  sessionIds: 'shuttlematch.sessionIds',
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
  sessionIds: string[]
}

let cache: Cache | null = null

function ensureCache(): Cache {
  if (cache == null) {
    cache = {
      currentUser: readRaw<User | null>(KEYS.currentUser, null),
      sessionIds: readRaw<string[]>(KEYS.sessionIds, []),
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

// ---- known session ids ----

export function getSessionIds(): string[] {
  return ensureCache().sessionIds
}

export function addSessionId(id: string) {
  const c = ensureCache()
  if (!c.sessionIds.includes(id)) {
    c.sessionIds = [id, ...c.sessionIds]
    persist(KEYS.sessionIds, c.sessionIds)
  }
}

export function removeSessionId(id: string) {
  const c = ensureCache()
  c.sessionIds = c.sessionIds.filter((x) => x !== id)
  persist(KEYS.sessionIds, c.sessionIds)
}

// ---- self participant (試合表での自己申告) ----
// セッションごとに「自分が何番か(＝ニックネーム入力済み)」を保存する。
// これがあれば試合表の自己申告モーダルは出さない。skipped は「あとで」を選んだ状態。

const SELF_PREFIX = 'shuttlematch.self.'

export interface SelfParticipant {
  participantId?: string
  skipped?: boolean
}

export function getSelfParticipant(sessionId: string): SelfParticipant | null {
  return readRaw<SelfParticipant | null>(SELF_PREFIX + sessionId, null)
}

export function setSelfParticipant(sessionId: string, participantId: string) {
  if (isBrowser()) {
    window.localStorage.setItem(SELF_PREFIX + sessionId, JSON.stringify({ participantId }))
  }
  emit()
}

export function skipSelfParticipant(sessionId: string) {
  if (isBrowser()) {
    window.localStorage.setItem(SELF_PREFIX + sessionId, JSON.stringify({ skipped: true }))
  }
  emit()
}
