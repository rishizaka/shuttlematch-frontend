import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query'
import {
  circleApi,
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
import type { User } from '../lib/types'

export const queryKeys = {
  user: (id: string) => ['user', id] as const,
  circle: (id: string) => ['circle', id] as const,
  session: (id: string) => ['session', id] as const,
  matches: (id: string) => ['matches', id] as const,
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

// ---- Session ----

export function useSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.session(sessionId ?? ''),
    queryFn: () => sessionApi.get(sessionId as string),
    enabled: !!sessionId,
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
