import type { MatchSchedule, Session, SessionStatus, User } from './types'

// バックエンドのベース URL。本番では VITE_API_BASE_URL を設定する。
export const API_BASE_URL: string =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8080'

/**
 * バックエンドの ProblemDetail (RFC 7807) に対応するエラー。
 * GlobalExceptionHandler が 400/404/409 で返す。
 */
export class ApiError extends Error {
  readonly status: number
  readonly title: string | undefined
  readonly detail: string | undefined

  constructor(status: number, message: string, title?: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
  }
}

interface ProblemDetail {
  title?: string
  detail?: string
  status?: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    let problem: ProblemDetail = {}
    try {
      problem = (await res.json()) as ProblemDetail
    } catch {
      // ボディが JSON でない場合は無視する。
    }
    const message = problem.detail ?? problem.title ?? `リクエストに失敗しました (${res.status})`
    throw new ApiError(res.status, message, problem.title, problem.detail)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

// ---- User ----

export interface CreateUserInput {
  name: string
  email: string
  password: string
}

export const userApi = {
  create: (input: CreateUserInput) =>
    request<User>('/api/v1/users', { method: 'POST', body: JSON.stringify(input) }),
  get: (userId: string) => request<User>(`/api/v1/users/${userId}`),
}

// ---- Auth ----

export const authApi = {
  login: (email: string, password: string) =>
    request<User>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
}

// ---- Room (session) ----

export interface CreateSessionInput {
  title: string
  /** ISO-8601 (OffsetDateTime)。 */
  heldAt: string
  location?: string | null
  capacity?: number | null
  courtCount?: number | null
  createdBy: string
}

export interface AddParticipantInput {
  /** 登録ユーザーの参加なら userId、ゲストなら guestName を指定する。 */
  userId?: string | null
  guestName?: string | null
}

export const sessionApi = {
  create: (input: CreateSessionInput) =>
    request<Session>('/api/v1/rooms', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** ステータスでルーム一覧を取得する(公開)。 */
  list: (status: SessionStatus = 'OPEN') =>
    request<Session[]>(`/api/v1/rooms?status=${status}`),
  get: (sessionId: string) => request<Session>(`/api/v1/rooms/${sessionId}`),
  /** かんたん作成: 参加人数・コート数・タイトルのみで、番号参加者+試合表まで作成。 */
  quickCreate: (input: {
    title: string
    courtCount: number
    participantCount: number
    createdBy: string
  }) =>
    request<Session>('/api/v1/rooms/quick', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** 参加者の名前(ニックネーム)を変更する。 */
  renameParticipant: (sessionId: string, participantId: string, name: string) =>
    request<Session>(`/api/v1/rooms/${sessionId}/participants/${participantId}/rename`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  /** ルームを終了する(終了済みとして履歴に残す)。 */
  close: (sessionId: string) =>
    request<Session>(`/api/v1/rooms/${sessionId}/close`, { method: 'POST' }),
  addParticipant: (sessionId: string, input: AddParticipantInput) =>
    request<Session>(`/api/v1/rooms/${sessionId}/participants`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  removeParticipant: (sessionId: string, participantId: string) =>
    request<void>(`/api/v1/rooms/${sessionId}/participants/${participantId}`, {
      method: 'DELETE',
    }),
  /** 早退(在席状態を LEFT に)。 */
  markParticipantLeft: (sessionId: string, participantId: string) =>
    request<Session>(`/api/v1/rooms/${sessionId}/participants/${participantId}/leave`, {
      method: 'POST',
    }),
  /** 復帰(在席状態を ACTIVE に)。 */
  reactivateParticipant: (sessionId: string, participantId: string) =>
    request<Session>(`/api/v1/rooms/${sessionId}/participants/${participantId}/reactivate`, {
      method: 'POST',
    }),
}

// ---- Match ----

export const matchApi = {
  generate: (sessionId: string, matchCount?: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${sessionId}/matches/generate`, {
      method: 'POST',
      body: JSON.stringify(matchCount != null ? { matchCount } : {}),
    }),
  get: (sessionId: string) => request<MatchSchedule>(`/api/v1/rooms/${sessionId}/matches`),
  startSet: (sessionId: string, setNumber: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${sessionId}/matches/sets/${setNumber}/start`, {
      method: 'POST',
    }),
  /** 進行中セットを開始前に戻す(開始時刻を消す)。 */
  revertSet: (sessionId: string, setNumber: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${sessionId}/matches/sets/${setNumber}/revert`, {
      method: 'POST',
    }),
  addSets: (sessionId: string, setCount?: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${sessionId}/matches/sets`, {
      method: 'POST',
      body: JSON.stringify(setCount != null ? { setCount } : {}),
    }),
  /** 未開始セットを現在の在席者で再編成する(途中参加・早退の反映)。 */
  replan: (sessionId: string) =>
    request<MatchSchedule>(`/api/v1/rooms/${sessionId}/matches/replan`, {
      method: 'POST',
    }),
}
