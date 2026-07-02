// バックエンド (shuttlematch-backend) の REST レスポンスに対応するドメイン型。
// 値はバックエンドの enum 名 (大文字) をそのまま受け取る。

export type MemberRole = 'ORGANIZER' | 'PLAYER'
export type JoinPolicy = 'OPEN' | 'APPROVAL'
export type SessionStatus = 'PREPARING' | 'OPEN' | 'GENERATED' | 'CLOSED'
export type SessionVisibility = 'PUBLIC' | 'MEMBERS_ONLY'
export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface User {
  id: string
  name: string
  email: string
}

export interface Member {
  userId: string
  role: MemberRole
}

export interface Circle {
  id: string
  name: string
  description: string | null
  inviteCode: string
  joinPolicy: JoinPolicy
  createdBy: string
  members: Member[]
}

export interface Participant {
  id: string
  /** 登録ユーザーの参加なら UserId、ゲストなら null。 */
  userId: string | null
  /** ゲスト参加者の表示名。登録ユーザーなら null。 */
  guestName: string | null
  guest: boolean
}

export interface Session {
  id: string
  circleId: string
  title: string
  /** ISO-8601 (UTC, 末尾 Z)。 */
  heldAt: string
  location: string | null
  capacity: number | null
  courtCount: number | null
  status: SessionStatus
  visibility: SessionVisibility
  createdBy: string
  participantCount: number
  participants: Participant[]
}

export interface JoinRequest {
  id: string
  circleId: string
  userId: string
  status: JoinRequestStatus
  requestedAt: string
  decidedAt: string | null
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
  sessionId: string
  matchCount: number
  matches: Match[]
}
