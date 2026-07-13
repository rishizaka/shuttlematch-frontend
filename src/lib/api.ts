import type { MatchSchedule, Room, RoomStatus, User } from './types'

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
  /** ゲストユーザーを発行する。未ログインでルームを作成するときの作成者に使う。 */
  createGuest: () => request<User>('/api/v1/users/guest', { method: 'POST' }),
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

// ---- Room (room) ----

export interface CreateRoomInput {
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

/** ルーム一覧の絞り込み条件。いずれも省略可(省略時は絞り込まない)。 */
export interface RoomListParams {
  status?: RoomStatus
  /** 開催日時がこの時刻以上 (ISO-8601)。 */
  heldFrom?: string
  /** 開催日時がこの時刻未満 (ISO-8601)。 */
  heldTo?: string
}

export const roomApi = {
  create: (input: CreateRoomInput) =>
    request<Room>('/api/v1/rooms', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** 条件でルーム一覧を取得する(公開)。 */
  list: (params: RoomListParams = {}) => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.heldFrom) qs.set('heldFrom', params.heldFrom)
    if (params.heldTo) qs.set('heldTo', params.heldTo)
    const q = qs.toString()
    return request<Room[]>(`/api/v1/rooms${q ? `?${q}` : ''}`)
  },
  get: (roomId: string) => request<Room>(`/api/v1/rooms/${roomId}`),
  /** 共有コードでルームを取得する(短縮URL /r/{code} の解決用)。 */
  getByCode: (shareCode: string) => request<Room>(`/api/v1/rooms/code/${shareCode}`),
  /** かんたん作成: 参加人数・コート数・タイトルのみで、番号参加者+試合表まで作成。 */
  quickCreate: (input: {
    title: string
    courtCount: number
    participantCount: number
    createdBy: string
  }) =>
    request<Room>('/api/v1/rooms/quick', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** 参加者の名前(ニックネーム)を変更する。 */
  renameParticipant: (roomId: string, participantId: string, name: string) =>
    request<Room>(`/api/v1/rooms/${roomId}/participants/${participantId}/rename`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  /** ルームを終了する(終了済みとして履歴に残す)。 */
  close: (roomId: string) =>
    request<Room>(`/api/v1/rooms/${roomId}/close`, { method: 'POST' }),
  addParticipant: (roomId: string, input: AddParticipantInput) =>
    request<Room>(`/api/v1/rooms/${roomId}/participants`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  removeParticipant: (roomId: string, participantId: string) =>
    request<void>(`/api/v1/rooms/${roomId}/participants/${participantId}`, {
      method: 'DELETE',
    }),
  /** 早退(在席状態を LEFT に)。 */
  markParticipantLeft: (roomId: string, participantId: string) =>
    request<Room>(`/api/v1/rooms/${roomId}/participants/${participantId}/leave`, {
      method: 'POST',
    }),
  /** 復帰(在席状態を ACTIVE に)。 */
  reactivateParticipant: (roomId: string, participantId: string) =>
    request<Room>(`/api/v1/rooms/${roomId}/participants/${participantId}/reactivate`, {
      method: 'POST',
    }),
}

// ---- Match ----

export const matchApi = {
  generate: (roomId: string, matchCount?: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${roomId}/matches/generate`, {
      method: 'POST',
      body: JSON.stringify(matchCount != null ? { matchCount } : {}),
    }),
  get: (roomId: string) => request<MatchSchedule>(`/api/v1/rooms/${roomId}/matches`),
  startSet: (roomId: string, setNumber: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${roomId}/matches/sets/${setNumber}/start`, {
      method: 'POST',
    }),
  /** 進行中セットを開始前に戻す(開始時刻を消す)。 */
  revertSet: (roomId: string, setNumber: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${roomId}/matches/sets/${setNumber}/revert`, {
      method: 'POST',
    }),
  addSets: (roomId: string, setCount?: number) =>
    request<MatchSchedule>(`/api/v1/rooms/${roomId}/matches/sets`, {
      method: 'POST',
      body: JSON.stringify(setCount != null ? { setCount } : {}),
    }),
  /** 未開始セットを現在の在席者で再編成する(途中参加・早退の反映)。 */
  replan: (roomId: string) =>
    request<MatchSchedule>(`/api/v1/rooms/${roomId}/matches/replan`, {
      method: 'POST',
    }),
}
