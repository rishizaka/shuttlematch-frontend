// バックエンド (shuttlematch-backend) の REST レスポンスに対応するドメイン型。
// 値はバックエンドの enum 名 (大文字) をそのまま受け取る。

export type RoomStatus = 'PREPARING' | 'OPEN' | 'GENERATED' | 'CLOSED'

export interface User {
  id: string
  name: string
  /** ゲストユーザー(未ログイン作成者)は null。 */
  email: string | null
}

export type ParticipantStatus = 'ACTIVE' | 'LEFT'

export interface Participant {
  id: string
  /** 登録ユーザーの参加なら UserId、ゲストなら null。 */
  userId: string | null
  /** ゲスト参加者の表示名。登録ユーザーなら null。 */
  guestName: string | null
  guest: boolean
  /** 在席状態。LEFT は早退(未開始セットの編成対象外)。 */
  status: ParticipantStatus
}

/** 固定ペア(常に同じチームで組む2人)。participantA/B は ParticipantId を指す。 */
export interface FixedPair {
  participantA: string
  participantB: string
}

/** 自己参加(join)のレスポンス。participantId を端末に保存して「自分」を識別する。 */
export interface JoinResult {
  participantId: string
  /** 参加時点で割り当てられた番号(目安)。権威は最新ロスターでの並び順。 */
  number: number
  room: Room
}

export interface Room {
  id: string
  /** URL共有用の短いコード。/r/{shareCode} でアクセスできる。 */
  shareCode: string
  title: string
  /** ISO-8601 (UTC, 末尾 Z)。 */
  heldAt: string
  location: string | null
  capacity: number | null
  courtCount: number | null
  status: RoomStatus
  createdBy: string
  participantCount: number
  participants: Participant[]
  /** 固定ペア(常に同じチームで組む2人)の一覧。 */
  fixedPairs: FixedPair[]
}

/** 試合のペア。player1Id / player2Id は ParticipantId を指す。 */
export interface Pair {
  player1Id: string
  player2Id: string
}

export interface Match {
  matchNumber: number
  /** セット番号 (1始まり)。同一セットの各コートは同時に進行する。 */
  setNumber: number
  pairA: Pair
  pairB: Pair
  courtNumber: number | null
  /** セット開始時刻 (ISO8601)。未開始は null。同一セットの試合は同じ時刻になる。 */
  startedAt: string | null
}

export interface MatchSchedule {
  roomId: string
  matchCount: number
  matches: Match[]
}
