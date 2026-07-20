import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  matchApi,
  roomApi,
  userApi,
  type AddParticipantInput,
  type CreateRoomInput,
  type CreateUserInput,
  type RoomListParams,
} from "../lib/api";
import { addRoomId, setSelfParticipant } from "../lib/local-store";
import type { Room } from "../lib/types";

/**
 * ライブ同期用のポーリング間隔 (ms)。
 * 他端末の操作 (セット開始・ニックネーム変更など) をリロードなしで反映するために使う。
 * コスト面の暴発を避けるため、進行中の試合表ページに限定して有効化すること。
 */
const LIVE_REFETCH_INTERVAL = 10_000;

export const queryKeys = {
  user: (id: string) => ["user", id] as const,
  room: (id: string) => ["room", id] as const,
  matches: (id: string) => ["matches", id] as const,
  roomLists: ["rooms", "list"] as const,
  roomList: (params: RoomListParams) => ["rooms", "list", params] as const,
};

// ---- User ----

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.user(userId ?? ""),
    queryFn: () => userApi.get(userId as string),
    enabled: !!userId,
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: (input: CreateUserInput) => userApi.create(input),
  });
}

// ---- Room (room) ----

export function useRoom(
  roomId: string | undefined,
  options?: { live?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.room(roomId ?? ""),
    queryFn: () => roomApi.get(roomId as string),
    enabled: !!roomId,
    // live 時は定期再取得。終了済みルームは変化しないので停止する。
    // (タブが非アクティブの間は TanStack Query の既定で停止する)
    refetchInterval: options?.live
      ? (query) =>
          query.state.data?.status === "CLOSED" ? false : LIVE_REFETCH_INTERVAL
      : undefined,
  });
}

/** 条件に合うルーム一覧(公開・トップページ/過去の開催用)。 */
export function useRoomList(params: RoomListParams = {}) {
  return useQuery({
    queryKey: queryKeys.roomList(params),
    queryFn: () => roomApi.list(params),
  });
}

/** 複数 room をまとめて取得する (ダッシュボード用)。 */
export function useRooms(roomIds: string[]) {
  return useQueries({
    queries: roomIds.map((id) => ({
      queryKey: queryKeys.room(id),
      queryFn: () => roomApi.get(id),
    })),
  });
}

export function useCreateRoom() {
  return useMutation({
    mutationFn: (input: CreateRoomInput) => roomApi.create(input),
    onSuccess: (room) => {
      addRoomId(room.id);
    },
  });
}

/** ルーム終了 (運営者操作)。終了済みにして募集中一覧からも外す。 */
export function useCloseRoom(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => roomApi.close(roomId),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room);
      qc.invalidateQueries({ queryKey: queryKeys.roomLists });
    },
  });
}

/** ルームを配下データごと完全に削除する。間違えて作成した場合などに使う。 */
export function useDeleteRoom(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => roomApi.deleteRoom(roomId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.room(roomId) });
      qc.invalidateQueries({ queryKey: queryKeys.roomLists });
    },
  });
}

/**
 * 受付中ルームに本人が参加する(名前必須)。参加すると番号が自動採番される。
 * 参加した本人の participantId を localStore に保存し、自分の試合ハイライトに使う。
 */
export function useJoinRoom(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => roomApi.join(roomId, name),
    onSuccess: (result) => {
      setSelfParticipant(roomId, result.participantId);
      qc.setQueryData(queryKeys.room(roomId), result.room);
      addRoomId(roomId);
    },
  });
}

/** かんたん作成。番号参加者+試合表まで作成し、識別子を localStore に保存する。 */
export function useQuickCreateRoom() {
  return useMutation({
    mutationFn: (input: {
      title: string;
      courtCount: number;
      participantCount: number;
      createdBy: string;
    }) => roomApi.quickCreate(input),
    onSuccess: (room) => {
      addRoomId(room.id);
    },
  });
}

export function useAddParticipant(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddParticipantInput) =>
      roomApi.addParticipant(roomId, input),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room);
    },
  });
}

/** 固定ペア(常に同じチームで組む2人)を追加する。 */
export function useAddFixedPair(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { participantA: string; participantB: string }) =>
      roomApi.addFixedPair(roomId, input.participantA, input.participantB),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room);
    },
  });
}

/** 固定ペアを解除する。 */
export function useRemoveFixedPair(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { participantA: string; participantB: string }) =>
      roomApi.removeFixedPair(roomId, input.participantA, input.participantB),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room);
    },
  });
}

export function useRemoveParticipant(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      roomApi.removeParticipant(roomId, participantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.room(roomId) });
    },
  });
}

/** 早退 (運営者操作)。在席状態を LEFT にする。未開始セットの再編成で反映される。 */
export function useMarkParticipantLeft(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      roomApi.markParticipantLeft(roomId, participantId),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room);
    },
  });
}

/** 復帰 (運営者操作)。在席状態を ACTIVE に戻す。 */
export function useReactivateParticipant(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      roomApi.reactivateParticipant(roomId, participantId),
    onSuccess: (room) => {
      qc.setQueryData(queryKeys.room(roomId), room);
    },
  });
}

// ---- Match ----

export function useMatches(
  roomId: string | undefined,
  options?: { live?: boolean },
) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.matches(roomId ?? ""),
    queryFn: () => matchApi.get(roomId as string),
    enabled: !!roomId,
    // まだ生成されていない場合は 404 になるため、リトライしない。
    retry: false,
    // live 時は定期再取得。未生成 (404) のまま叩き続けないよう、取得済みの場合のみ。
    // ルームが終了済みなら試合表も変化しないので停止する (キャッシュ上の room で判定)。
    refetchInterval: options?.live
      ? (query) => {
          if (!query.state.data) return false;
          const room = qc.getQueryData<Room>(queryKeys.room(roomId ?? ""));
          if (room?.status === "CLOSED") return false;
          return LIVE_REFETCH_INTERVAL;
        }
      : undefined,
  });
}

export function useGenerateMatches(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchCount?: number) => matchApi.generate(roomId, matchCount),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule);
      qc.invalidateQueries({ queryKey: queryKeys.room(roomId) });
    },
  });
}

/** セット開始 (運営者操作)。開始したセット (全コート) がアクティブになり、開始時刻が記録される。 */
export function useStartSet(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setNumber: number) => matchApi.startSet(roomId, setNumber),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule);
    },
  });
}

/** セットを開始前に戻す (運営者操作)。進行中セットの開始時刻を消す。 */
export function useRevertSet(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setNumber: number) => matchApi.revertSet(roomId, setNumber),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule);
    },
  });
}

/** セット追加 (運営者操作)。既存の結果を保ったまま、末尾にセットを継ぎ足す。 */
export function useAddSets(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setCount: number) => matchApi.addSets(roomId, setCount),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule);
    },
  });
}

/** 未開始セットの再編成 (運営者操作)。途中参加・早退を反映する。 */
export function useReplanFutureSets(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => matchApi.replan(roomId),
    onSuccess: (schedule) => {
      qc.setQueryData(queryKeys.matches(roomId), schedule);
    },
  });
}

