import type {
  Circle,
  JoinPolicy,
  MatchSchedule,
  MemberRole,
  Session,
  User,
} from './types'

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
}

export const userApi = {
  create: (input: CreateUserInput) =>
    request<User>('/api/v1/users', { method: 'POST', body: JSON.stringify(input) }),
  get: (userId: string) => request<User>(`/api/v1/users/${userId}`),
}

// ---- Circle ----

export interface CreateCircleInput {
  name: string
  description?: string | null
  joinPolicy: JoinPolicy
  createdBy: string
}

export interface AddMemberInput {
  userId: string
  role?: MemberRole
}

export const circleApi = {
  create: (input: CreateCircleInput) =>
    request<Circle>('/api/v1/circles', { method: 'POST', body: JSON.stringify(input) }),
  get: (circleId: string) => request<Circle>(`/api/v1/circles/${circleId}`),
  addMember: (circleId: string, input: AddMemberInput) =>
    request<Circle>(`/api/v1/circles/${circleId}/members`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}

// ---- Session ----

export interface CreateSessionInput {
  title: string
  /** ISO-8601 (OffsetDateTime)。 */
  heldAt: string
  location?: string | null
  capacity?: number | null
  createdBy: string
}

export interface AddParticipantInput {
  /** 登録ユーザーの参加なら userId、ゲストなら guestName を指定する。 */
  userId?: string | null
  guestName?: string | null
}

export const sessionApi = {
  create: (circleId: string, input: CreateSessionInput) =>
    request<Session>(`/api/v1/circles/${circleId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  get: (sessionId: string) => request<Session>(`/api/v1/sessions/${sessionId}`),
  addParticipant: (sessionId: string, input: AddParticipantInput) =>
    request<Session>(`/api/v1/sessions/${sessionId}/participants`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  removeParticipant: (sessionId: string, participantId: string) =>
    request<void>(`/api/v1/sessions/${sessionId}/participants/${participantId}`, {
      method: 'DELETE',
    }),
}

// ---- Match ----

export const matchApi = {
  generate: (sessionId: string, matchCount?: number) =>
    request<MatchSchedule>(`/api/v1/sessions/${sessionId}/matches/generate`, {
      method: 'POST',
      body: JSON.stringify(matchCount != null ? { matchCount } : {}),
    }),
  get: (sessionId: string) => request<MatchSchedule>(`/api/v1/sessions/${sessionId}/matches`),
}
