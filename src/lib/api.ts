import type { JoinResult, MatchSchedule, Room, RoomStatus, User } from './types'

// バックエンドのベース URL は実行環境で変わる:
//  - SSR(サーバー): 同一ホスト上の backend を直接叩く(localhost:8080)。CORS 不要。
//  - 本番ブラウザ: 相対パス('')で同一オリジンへ。serve.mjs が /api を backend へ中継する。
//  - 開発ブラウザ(PC): プロキシを通さず backend を直接叩く(localhost:8080、CORS 許可済み)。
//  - 開発ブラウザ(スマホ実機など LAN 経由): localhost はスマホ自身を指してしまうので、
//    相対パスにして vite dev の /api プロキシ(vite.config.ts)経由で backend に届ける。
// VITE_API_BASE_URL が設定されていればそれを優先する(ドメイン/ALB 経由にする場合など)。
const CONFIGURED_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL as string | undefined
)?.replace(/\/$/, '')

function resolveApiBaseUrl(): string {
  if (CONFIGURED_BASE_URL != null) return CONFIGURED_BASE_URL
  if (typeof window === 'undefined') return 'http://localhost:8080'
  if (import.meta.env?.PROD) return ''
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
    ? 'http://localhost:8080'
    : ''
}

export const API_BASE_URL: string = resolveApiBaseUrl()

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

/**
 * サーバーに到達できなかったときのエラー(オフライン・DNS失敗・接続拒否など)。
 * fetch が reject する「Failed to fetch」を利用者向けの文言に変換する。
 */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('ネットワークに繋がらないようです。通信環境を確認して、もう一度お試しください。', {
      cause,
    })
    this.name = 'NetworkError'
  }
}

/**
 * ネットワーク到達不能のエラーか。SSR の loader で投げられたエラーは
 * シリアライズでクラス情報が落ちることがあるため、name でも判定する。
 */
export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof NetworkError || (error instanceof Error && error.name === 'NetworkError')
  )
}

interface ProblemDetail {
  title?: string
  detail?: string
  status?: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch (cause) {
    throw new NetworkError(cause)
  }

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
  /** ルームを終了する(終了済みとして履歴に残す)。 */
  close: (roomId: string) =>
    request<Room>(`/api/v1/rooms/${roomId}/close`, { method: 'POST' }),
  /** ルームを配下データ(参加者・固定ペア・試合表)ごと完全に削除する。 */
  deleteRoom: (roomId: string) =>
    request<void>(`/api/v1/rooms/${roomId}`, { method: 'DELETE' }),
    addFixedPair: (roomId: string, participantA: string, participantB: string) =>
      request<Room>(`/api/v1/rooms/${roomId}/fixed-pairs`, {
        method: 'POST',
        body: JSON.stringify({ participantA, participantB }),
      }),
    removeFixedPair: (roomId: string, participantA: string, participantB: string) =>
      request<Room>(`/api/v1/rooms/${roomId}/fixed-pairs/${participantA}/${participantB}`, {
        method: 'DELETE',
      }),
  /** 受付中ルームに本人が参加する(名前必須)。参加順で番号が自動採番される。 */
  join: (roomId: string, name: string) =>
    request<JoinResult>(`/api/v1/rooms/${roomId}/participants/join`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  /** 参加者の名前(ニックネーム)を変更する。番号だけの枠に後から名前を付けるのに使う。 */
  renameParticipant: (roomId: string, participantId: string, name: string) =>
    request<Room>(`/api/v1/rooms/${roomId}/participants/${participantId}/rename`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
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
