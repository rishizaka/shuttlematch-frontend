import { useMutation, useQuery, useQueryClient, useQueries } from '@tanstack/react-query'
import {
  matchApi,
  roomApi,
  userApi,
  type AddParticipantInput,
  type CreateRoomInput,
  type CreateUserInput,
} from '../lib/api'
import { addRoomId } from '../lib/local-store'
import type { RoomStatus, User } from '../lib/types'

export const queryKeys = {
  user: (id: string) => ['user', id] as const,
  room: (id: string) => ['room', id] as const,
  matches: (id: string) => ['matches', id] as const,
  openRooms: (status: RoomStatus) => ["rooms", "list", status] as const,
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

// ---- Room (room) ----

export function useRoom(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.room(roomId ?? ''),
    queryFn: () => roomApi.get(roomId as string),
    enabled: !!roomId,
  })
}

/** 募集中などのステータスのルーム一覧(公開・トップページ用)。 */
export function useRoomList(status: RoomStatus = 'OPEN') {
  return useQuery({
    queryKey: queryKeys.openRooms(status),
    queryFn: () => roomApi.list(status),
  })
}

/** 複数 room をまとめて取得する (ダッシュボード用)。 */
export function useRooms(roomIds: string[]) {
  return useQueries({
    queries: roomIds.map((id) => ({
      queryKey: queryKeys.room(id),
      queryFn: () => roomApi.get(id),
    })),
  })
}

export function useCreateRoom() {
  return useMutation({
    mutationFn: (input: CreateRoomInput) => roomApi.create(input),
    onSuccess: (room) => {
      addRoomId(room.id)
    },
  })
}

/** ルーム終了 (運営者操作)。終了済みにして募集中一覧からも外す。 */
export function useCloseRoom(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => roomApi.close(roomId),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room)
      qc.invalidateQueries({ queryKey: queryKeys.openRooms('OPEN') })
    },
  })
}

/** かんたん作成。番号参加者+試合表まで作成し、識別子を localStore に保存する。 */
export function useQuickCreateRoom() {
  return useMutation({
    mutationFn: (input: {
      title: string
      courtCount: number
      participantCount: number
      createdBy: string
    }) => roomApi.quickCreate(input),
    onSuccess: (room) => {
      addRoomId(room.id)
    },
  })
}

/** 参加者の名前(ニックネーム)変更 (運営者操作)。 */
export function useRenameParticipant(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { participantId: string; name: string }) =>
      roomApi.renameParticipant(roomId, input.participantId, input.name),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room)
    },
  })
}

export function useAddParticipant(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddParticipantInput) => roomApi.addParticipant(roomId, input),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room)
    },
  })
}

export function useRemoveParticipant(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => roomApi.removeParticipant(roomId, participantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    },
  })
}

/** 早退 (運営者操作)。在席状態を LEFT にする。未開始セットの再編成で反映される。 */
export function useMarkParticipantLeft(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => roomApi.markParticipantLeft(roomId, participantId),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room)
    },
  })
}

/** 復帰 (運営者操作)。在席状態を ACTIVE に戻す。 */
export function useReactivateParticipant(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) =>
      roomApi.reactivateParticipant(roomId, participantId),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room)
    },
  })
}

// ---- Match ----

export function useMatches(roomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.matches(roomId ?? ''),
    queryFn: () => matchApi.get(roomId as string),
    enabled: !!roomId,
    // まだ生成されていない場合は 404 になるため、リトライしない。
    retry: false,
  })
}

export function useGenerateMatches(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (matchCount?: number) => matchApi.generate(roomId, matchCount),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule)
      qc.invalidateQueries({ queryKey: queryKeys.room(roomId) })
    },
  })
}

/** セット開始 (運営者操作)。開始したセット (全コート) がアクティブになり、開始時刻が記録される。 */
export function useStartSet(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setNumber: number) => matchApi.startSet(roomId, setNumber),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule)
    },
  })
}

/** セットを開始前に戻す (運営者操作)。進行中セットの開始時刻を消す。 */
export function useRevertSet(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setNumber: number) => matchApi.revertSet(roomId, setNumber),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule)
    },
  })
}

/** セット追加 (運営者操作)。既存の結果を保ったまま、末尾にセットを継ぎ足す。 */
export function useAddSets(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (setCount: number) => matchApi.addSets(roomId, setCount),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule)
    },
  })
}

/** 未開始セットの再編成 (運営者操作)。途中参加・早退を反映する。 */
export function useReplanFutureSets(roomId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => matchApi.replan(roomId),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule)
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
