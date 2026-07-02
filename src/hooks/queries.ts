import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query'
import {
  matchApi,
  sessionApi,
  userApi,
  type AddParticipantInput,
  type CreateSessionInput,
  type CreateUserInput,
} from '../lib/api'
import { addSessionId } from '../lib/local-store'
import type { SessionStatus, User } from '../lib/types'

export const queryKeys = {
  user: (id: string) => ['user', id] as const,
  session: (id: string) => ['session', id] as const,
  matches: (id: string) => ['matches', id] as const,
  openSessions: (status: SessionStatus) => ['sessions', 'list', status] as const,
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

// ---- Session (room) ----

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.session(sessionId ?? ''),
    queryFn: () => sessionApi.get(sessionId as string),
    enabled: !!sessionId,
  })
}

/** 募集中などのステータスのルーム一覧(公開・トップページ用)。 */
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

export function useCreateSession() {
  return useMutation({
    mutationFn: (input: CreateSessionInput) => sessionApi.create(input),
    onSuccess: (session) => {
      addSessionId(session.id)
    },
  })
}

/** ルーム終了 (運営者操作)。終了済みにして募集中一覧からも外す。 */
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

/** かんたん作成。番号参加者+試合表まで作成し、識別子を localStore に保存する。 */
export function useQuickCreateSession() {
  return useMutation({
    mutationFn: (input: {
      title: string
      courtCount: number
      participantCount: number
      createdBy: string
    }) => sessionApi.quickCreate(input),
    onSuccess: (session) => {
      addSessionId(session.id)
    },
  })
}

/** 参加者の名前(ニックネーム)変更 (運営者操作)。 */
export function useRenameParticipant(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { participantId: string; name: string }) =>
      sessionApi.renameParticipant(sessionId, input.participantId, input.name),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.session(sessionId), session)
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

/** セットを開始前に戻す (運営者操作)。進行中セットの開始時刻を消す。 */
export function useRevertSet(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setNumber: number) => matchApi.revertSet(sessionId, setNumber),
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
