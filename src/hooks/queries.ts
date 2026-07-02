import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query'
import {
  circleApi,
  joinRequestApi,
  matchApi,
  sessionApi,
  userApi,
  type AddMemberInput,
  type AddParticipantInput,
  type CreateCircleInput,
  type CreateSessionInput,
  type CreateUserInput,
} from '../lib/api'
import { addCircleId, addSessionId } from '../lib/local-store'
import type { JoinRequestStatus, SessionStatus, User } from '../lib/types'

export const queryKeys = {
  user: (id: string) => ['user', id] as const,
  circle: (id: string) => ['circle', id] as const,
  session: (id: string) => ['session', id] as const,
  matches: (id: string) => ['matches', id] as const,
  openSessions: (status: SessionStatus) => ['sessions', 'list', status] as const,
  joinRequests: (circleId: string, status: JoinRequestStatus) =>
    ['joinRequests', circleId, status] as const,
}

// ---- User ----

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.user(userId ?? ''),
    queryFn: () => userApi.get(userId as string),
    enabled: !!userId,
  })
}

export function useCreateUser() {
  return useMutation({
    mutationFn: (input: CreateUserInput) => userApi.create(input),
  })
}

// ---- Circle ----

export function useCircle(circleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.circle(circleId ?? ''),
    queryFn: () => circleApi.get(circleId as string),
    enabled: !!circleId,
  })
}

/** 複数 circle をまとめて取得する (ダッシュボード用)。 */
export function useCircles(circleIds: string[]) {
  return useQueries({
    queries: circleIds.map((id) => ({
      queryKey: queryKeys.circle(id),
      queryFn: () => circleApi.get(id),
    })),
  })
}

export function useCreateCircle() {
  return useMutation({
    mutationFn: (input: CreateCircleInput) => circleApi.create(input),
    onSuccess: (circle) => {
      addCircleId(circle.id)
    },
  })
}

export function useAddMember(circleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddMemberInput) => circleApi.addMember(circleId, input),
    onSuccess: (circle) => {
      qc.setQueryData(queryKeys.circle(circleId), circle)
    },
  })
}

// ---- Join request (membership application) ----

/** サークルの参加申請一覧(オーガナイザー用)。 */
export function useJoinRequests(
  circleId: string | undefined,
  status: JoinRequestStatus = 'PENDING',
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.joinRequests(circleId ?? '', status),
    queryFn: () => joinRequestApi.list(circleId as string, status),
    enabled: !!circleId && enabled,
  })
}

/** 参加申請を出す。 */
export function useApplyForMembership(circleId: string) {
  return useMutation({
    mutationFn: (userId: string) => joinRequestApi.apply(circleId, userId),
  })
}

/** 参加申請を承認する。承認するとメンバーが増えるのでサークルも再取得。 */
export function useApproveJoinRequest(circleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => joinRequestApi.approve(circleId, requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.joinRequests(circleId, 'PENDING') })
      qc.invalidateQueries({ queryKey: queryKeys.circle(circleId) })
    },
  })
}

/** 参加申請を却下する。 */
export function useRejectJoinRequest(circleId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => joinRequestApi.reject(circleId, requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.joinRequests(circleId, 'PENDING') })
    },
  })
}

// ---- Session ----

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.session(sessionId ?? ''),
    queryFn: () => sessionApi.get(sessionId as string),
    enabled: !!sessionId,
  })
}

/** 募集中などのステータスのセッション一覧(公開・トップページ用)。 */
export function useSessionList(status: SessionStatus = 'OPEN') {
  return useQuery({
    queryKey: queryKeys.openSessions(status),
    queryFn: () => sessionApi.list(status),
  })
}

/** 複数 session をまとめて取得する (ダッシュボード用)。 */
export function useSessions(sessionIds: string[]) {
  return useQueries({
    queries: sessionIds.map((id) => ({
      queryKey: queryKeys.session(id),
      queryFn: () => sessionApi.get(id),
    })),
  })
}

export function useCreateSession(circleId: string) {
  return useMutation({
    mutationFn: (input: CreateSessionInput) => sessionApi.create(circleId, input),
    onSuccess: (session) => {
      addSessionId(session.id)
    },
  })
}

/** セッション終了 (運営者操作)。終了済みにして募集中一覧からも外す。 */
export function useCloseSession(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => sessionApi.close(sessionId),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session(sessionId), session)
      qc.invalidateQueries({ queryKey: queryKeys.openSessions('OPEN') })
    },
  })
}

export function useAddParticipant(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddParticipantInput) => sessionApi.addParticipant(sessionId, input),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session(sessionId), session)
    },
  })
}

export function useRemoveParticipant(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => sessionApi.removeParticipant(sessionId, participantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.session(sessionId) })
    },
  })
}

/** 早退 (運営者操作)。在席状態を LEFT にする。未開始セットの再編成で反映される。 */
export function useMarkParticipantLeft(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => sessionApi.markParticipantLeft(sessionId, participantId),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session(sessionId), session)
    },
  })
}

/** 復帰 (運営者操作)。在席状態を ACTIVE に戻す。 */
export function useReactivateParticipant(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) =>
      sessionApi.reactivateParticipant(sessionId, participantId),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session(sessionId), session)
    },
  })
}

// ---- Match ----

export function useMatches(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.matches(sessionId ?? ''),
    queryFn: () => matchApi.get(sessionId as string),
    enabled: !!sessionId,
    // まだ生成されていない場合は 404 になるため、リトライしない。
    retry: false,
  })
}

export function useGenerateMatches(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchCount?: number) => matchApi.generate(sessionId, matchCount),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(sessionId), schedule)
      qc.invalidateQueries({ queryKey: queryKeys.session(sessionId) })
    },
  })
}

/** セット開始 (運営者操作)。開始したセット (全コート) がアクティブになり、開始時刻が記録される。 */
export function useStartSet(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setNumber: number) => matchApi.startSet(sessionId, setNumber),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(sessionId), schedule)
    },
  })
}

/** セット追加 (運営者操作)。既存の結果を保ったまま、末尾にセットを継ぎ足す。 */
export function useAddSets(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setCount: number) => matchApi.addSets(sessionId, setCount),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(sessionId), schedule)
    },
  })
}

/** 未開始セットの再編成 (運営者操作)。途中参加・早退を反映する。 */
export function useReplanFutureSets(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => matchApi.replan(sessionId),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(sessionId), schedule)
    },
  })
}

/**
 * 参加者 (登録ユーザー) の表示名を userId -> 名前 のマップで解決する。
 * 試合表示でプレイヤー名を出すために使う。
 */
export function useUserNames(userIds: string[]): Map<string, string> {
  const unique = Array.from(new Set(userIds))
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: queryKeys.user(id),
      queryFn: () => userApi.get(id),
      staleTime: 5 * 60 * 1000,
    })),
  })
  const map = new Map<string, string>()
  results.forEach((r, i) => {
    const user = r.data as User | undefined
    if (user) map.set(unique[i], user.name)
  })
  return map
}
