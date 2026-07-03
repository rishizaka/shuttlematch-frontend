import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ChevronDown,
  ListPlus,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react'
import {
  useAddSets,
  useCloseRoom,
  useMatches,
  useRenameParticipant,
  useReplanFutureSets,
  useRevertSet,
  useRoom,
  useStartSet,
  useUserNames,
} from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { getSelfParticipant, setSelfParticipant } from '../../lib/local-store'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { buildParticipantNameLookup } from '../../components/match/MatchCard'
import { ParticipantManager } from '../../components/room/ParticipantManager'
import { SelfIdentifyModal } from '../../components/room/SelfIdentifyModal'
import {
  MatchScheduleList,
  filterMatchesForParticipant,
} from '../../components/match/MatchScheduleList'

export const Route = createFileRoute('/rooms/$roomId_/matches')({
  // LINE 等のアプリ内ブラウザから既定ブラウザで開かせるためのパラメータ。
  // リンク/アドレスバー共有時に URL へ残るよう、ルートの検索パラメータとして扱う。
  validateSearch: (search: Record<string, unknown>): { openExternalBrowser?: 1 } => ({
    openExternalBrowser:
      search.openExternalBrowser === 1 || search.openExternalBrowser === '1' ? 1 : undefined,
  }),
  component: MatchesPage,
})

type Filter = 'all' | 'mine'

function MatchesPage() {
  const { roomId } = Route.useParams()
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const { showToast } = useToast()
  const { data: room } = useRoom(roomId)
  const { data: schedule, isLoading, isError, error } = useMatches(roomId)
  const startSet = useStartSet(roomId)
  const revertSet = useRevertSet(roomId)
  const addSets = useAddSets(roomId)
  const replan = useReplanFutureSets(roomId)
  const closeRoom = useCloseRoom(roomId)
  const rename = useRenameParticipant(roomId)
  const [filter, setFilter] = useState<Filter>('all')
  const [addCount, setAddCount] = useState(3)
  const [confirmingClose, setConfirmingClose] = useState(false)
  // 運営メニューの開閉。参加者リストが長くなりがちなので、既定では畳んでおく。
  const [organizerOpen, setOrganizerOpen] = useState(false)
  const [showSelfModal, setShowSelfModal] = useState(false)
  // 自己申告で選んだ自分の ParticipantId (localStorage 由来)。
  const [selfParticipantId, setSelfParticipantId] = useState<string | null>(null)

  const closed = room?.status === 'CLOSED'

  // LINE 等のアプリ内ブラウザで開かれたら、既定(外部)ブラウザで開き直す。
  // openExternalBrowser=1 を付けて1回だけリダイレクト(付与済み/通常ブラウザでは何もしない)。
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = navigator.userAgent || ''
    const inInAppBrowser = /Line\//i.test(ua)
    if (!inInAppBrowser) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('openExternalBrowser') === '1') return
    url.searchParams.set('openExternalBrowser', '1')
    window.location.replace(url.toString())
  }, [])

  // 早退者がいる、または在席者で未開始セットに一度も出ていない人がいる = 再編成の余地あり。
  const leftCount = (room?.participants ?? []).filter((p) => p.status === 'LEFT').length
  const activeCount = (room?.participants ?? []).length - leftCount
  const hasLeftParticipant = leftCount > 0

  // 運営者(ルームの作成者)のみセット開始などの操作ができる。
  const isOrganizer = useMemo(
    () => !!user && !!room && room.createdBy === user.id,
    [user, room],
  )

  const userIds = (room?.participants ?? [])
    .map((p) => p.userId)
    .filter((id): id is string => !!id)
  const userNames = useUserNames(userIds)

  const nameByParticipantId = useMemo(
    () => buildParticipantNameLookup(room?.participants ?? [], userNames),
    [room, userNames],
  )

  // 参加者一覧の並び順を 1 始まりの番号として割り当てる。
  const indexByParticipantId = useMemo(() => {
    const map = new Map<string, number>()
    ;(room?.participants ?? []).forEach((p, i) => map.set(p.id, i + 1))
    return map
  }, [room])

  // 自分の ParticipantId。登録ユーザーなら userId 一致、そうでなければ自己申告(番号)を使う。
  const myParticipantId = useMemo(() => {
    const byUser = room?.participants.find((p) => p.userId === user?.id)?.id
    if (byUser) return byUser
    if (selfParticipantId && room?.participants.some((p) => p.id === selfParticipantId)) {
      return selfParticipantId
    }
    return null
  }, [room, user, selfParticipantId])

  // マウント後に localStorage を読み、未申告なら自己紹介モーダルを出す(SSR不一致を避けるため effect 内で判定)。
  // 運営者と、参加者に紐付いた登録ユーザーは申告不要なので対象外。
  useEffect(() => {
    if (!schedule || closed) return
    const participants = room?.participants ?? []
    if (participants.length === 0) return
    if (isOrganizer) return
    if (user && participants.some((p) => p.userId === user.id)) return
    const stored = getSelfParticipant(roomId)
    if (stored?.participantId) {
      setSelfParticipantId(stored.participantId)
      return
    }
    setShowSelfModal(true)
  }, [roomId, schedule, closed, room, user, isOrganizer])

  // アクティブ(進行中)なセット = 最も新しい開始時刻を持つセット。
  const activeSetNumber = useMemo(() => {
    let active: number | null = null
    let latest = ''
    for (const m of schedule?.matches ?? []) {
      if (m.startedAt && m.startedAt > latest) {
        latest = m.startedAt
        active = m.setNumber
      }
    }
    return active
  }, [schedule])

  // 次に開始できるセット = 開始済みの最大セット + 1。セットは1から順番にのみ開始できる。
  const startableSetNumber = useMemo(() => {
    let maxStarted = 0
    for (const m of schedule?.matches ?? []) {
      if (m.startedAt && m.setNumber > maxStarted) maxStarted = m.setNumber
    }
    return maxStarted + 1
  }, [schedule])

  // セット数 = セット番号の最大値。
  const setCount = useMemo(() => {
    let max = 0
    for (const m of schedule?.matches ?? []) {
      if (m.setNumber > max) max = m.setNumber
    }
    return max
  }, [schedule])

  if (isLoading) return <LoadingBlock />
  if (isError || !schedule) {
    return (
      <ErrorBlock
        message={
          error instanceof Error ? error.message : 'この試合表はまだ生成されていません'
        }
      />
    )
  }

  const visible =
    filter === 'mine'
      ? filterMatchesForParticipant(schedule.matches, myParticipantId)
      : schedule.matches

  return (
    <div className="space-y-5">
      {showSelfModal ? (
        <SelfIdentifyModal
          participants={room?.participants ?? []}
          names={userNames}
          submitting={rename.isPending}
          onSubmit={(participantId, nickname) =>
            rename.mutate(
              { participantId, name: nickname },
              {
                onSuccess: () => {
                  setSelfParticipant(roomId, participantId)
                  setSelfParticipantId(participantId)
                  setShowSelfModal(false)
                },
              },
            )
          }
          onCancel={() => {
            // 申告しないなら試合表は見せず、ルーム詳細へ戻す。
            navigate({ to: '/rooms/$roomId', params: { roomId } })
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/rooms/$roomId"
            params={{ roomId }}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← ルームへ戻る
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">試合表</h1>
            {closed ? (
              <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                終了済み
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500">
            全 {setCount} セット・{schedule.matchCount} 試合
          </p>
        </div>
        {myParticipantId ? (
          <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="表示切替">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={
                'rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
                (filter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700')
              }
            >
              すべて
            </button>
            <button
              type="button"
              onClick={() => setFilter('mine')}
              className={
                'rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
                (filter === 'mine'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700')
              }
            >
              自分の試合
            </button>
          </div>
        ) : null}
      </div>

      {closed ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            この試合表は終了済みとして記録されています。内容の変更はできません。
          </p>
        </div>
      ) : null}

      {isOrganizer && !closed ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* ヘッダー行は常に表示し、タップでメニュー全体を開閉する。 */}
          <button
            type="button"
            onClick={() => setOrganizerOpen((v) => !v)}
            aria-expanded={organizerOpen}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Settings2 className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">運営メニュー</span>
              <span className="block truncate text-xs text-slate-500">
                在席 {activeCount} 人
                {leftCount > 0 ? `・早退 ${leftCount} 人` : ''}・全 {setCount} セット
              </span>
            </span>
            {hasLeftParticipant && !organizerOpen ? (
              <span className="hidden shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 sm:inline-flex">
                再編成の余地あり
              </span>
            ) : null}
            <ChevronDown
              className={
                'h-5 w-5 shrink-0 text-slate-400 transition-transform ' +
                (organizerOpen ? 'rotate-180' : '')
              }
            />
          </button>

          {organizerOpen ? (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {/* 参加者の出入り */}
              <div className="px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-800">参加者</h3>
                </div>
                <ParticipantManager
                  roomId={roomId}
                  participants={room?.participants ?? []}
                  names={userNames}
                  generated
                />
              </div>

              {/* セットを追加 */}
              <div className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <ListPlus className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-800">セットを追加</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
                      <button
                        type="button"
                        aria-label="追加セット数を減らす"
                        onClick={() => setAddCount((c) => Math.max(1, c - 1))}
                        className="px-2.5 py-2 text-slate-500 transition hover:bg-slate-50"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-slate-900 tabular-nums">
                        {addCount}
                      </span>
                      <button
                        type="button"
                        aria-label="追加セット数を増やす"
                        onClick={() => setAddCount((c) => Math.min(30, c + 1))}
                        className="px-2.5 py-2 text-slate-500 transition hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        addSets.mutate(addCount, {
                          onSuccess: () => showToast('セットを追加しました'),
                        })
                      }
                      disabled={addSets.isPending}
                    >
                      {addSets.isPending ? '追加中…' : '追加'}
                    </Button>
                  </div>
                </div>
                {addSets.isError ? (
                  <p className="mt-2 text-sm text-red-600">
                    {addSets.error instanceof Error
                      ? addSets.error.message
                      : 'セットの追加に失敗しました'}
                  </p>
                ) : null}
              </div>

              {/* 未開始セットの再編成 */}
              <div className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        未開始セットを再編成
                      </h3>
                      {hasLeftParticipant ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          早退者あり
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      出入りを反映して未開始セットを組み直します(開始済みはそのまま)。
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      replan.mutate(undefined, {
                        onSuccess: () => showToast('未開始セットを再編成しました'),
                      })
                    }
                    disabled={replan.isPending}
                  >
                    {replan.isPending ? '再編成中…' : '再編成する'}
                  </Button>
                </div>
                {replan.isError ? (
                  <p className="mt-2 text-sm text-red-600">
                    {replan.error instanceof Error
                      ? replan.error.message
                      : '再編成に失敗しました'}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {visible.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">該当する試合がありません。</p>
          </CardBody>
        </Card>
      ) : (
        <MatchScheduleList
          matches={visible}
          nameByParticipantId={nameByParticipantId}
          indexByParticipantId={indexByParticipantId}
          highlightParticipantId={filter === 'all' ? myParticipantId : null}
          activeSetNumber={activeSetNumber}
          startableSetNumber={startableSetNumber}
          isOrganizer={isOrganizer && !closed}
          onStartSet={(setNumber) => startSet.mutate(setNumber)}
          startingSetNumber={startSet.isPending ? startSet.variables : null}
          onRevertSet={(setNumber) => revertSet.mutate(setNumber)}
          revertingSetNumber={revertSet.isPending ? revertSet.variables : null}
        />
      )}

      {/* ルームの終了は最終操作なので、ページ最下部に控えめに置く。 */}
      {isOrganizer && !closed ? (
        <div className="border-t border-slate-100 pt-6">
          {confirmingClose ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-slate-700">
                この試合表を記録して終了しますか？（終了後は変更できません）
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    closeRoom.mutate(undefined, {
                      onSuccess: () => setConfirmingClose(false),
                    })
                  }}
                  disabled={closeRoom.isPending}
                >
                  {closeRoom.isPending ? '記録中…' : '終了する'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirmingClose(false)}
                  disabled={closeRoom.isPending}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setConfirmingClose(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-red-600"
              >
                <Archive className="h-4 w-4" />
                ルームを終了
              </button>
            </div>
          )}
          {closeRoom.isError ? (
            <p className="mt-2 text-center text-sm text-red-600">
              {closeRoom.error instanceof Error
                ? closeRoom.error.message
                : '終了に失敗しました'}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
