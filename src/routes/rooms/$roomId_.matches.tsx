import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ChevronDown,
  ListPlus,
  Lock,
  Minus,
  Plus,
  Camera,
  RefreshCw,
  Settings2,
  UserRound,
  Users,
} from 'lucide-react'
import {
  queryKeys,
  useAddSets,
  useCloseRoom,
  useMatches,
  useReplanFutureSets,
  useRevertSet,
  useRoom,
  useStartSet,
} from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { roomApi } from '../../lib/api'
import {
  getSelfParticipant,
  setSelfParticipant,
  removeSelfParticipant,
} from '../../lib/local-store'
import { roomOgMeta } from '../../lib/og'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { ParticipantManager } from '../../components/room/ParticipantManager'
import { SelfNumberModal } from '../../components/room/SelfNumberModal'
import { MatchScheduleList } from '../../components/match/MatchScheduleList'
import { SetStartAnnouncement } from '../../components/match/SetStartAnnouncement'

export const Route = createFileRoute('/rooms/$roomId_/matches')({
  // LINE 等のアプリ内ブラウザから既定ブラウザで開かせるためのパラメータ。
  // リンク/アドレスバー共有時に URL へ残るよう、ルートの検索パラメータとして扱う。
  validateSearch: (search: Record<string, unknown>): { openExternalBrowser?: 1 } => ({
    openExternalBrowser:
      search.openExternalBrowser === 1 || search.openExternalBrowser === '1' ? 1 : undefined,
  }),
  // OGP(SNS のリンクカード)用。SSR の HTML にルーム名入りメタタグを含める。
  loader: async ({ params }) => {
    try {
      return await roomApi.get(params.roomId)
    } catch {
      return null
    }
  },
  // 試合表のリンクカードは画像なし(テキストのみ)。og:image はここでは足さない。
  head: ({ loaderData, params }) =>
    loaderData
      ? {
          meta: [
            ...roomOgMeta(loaderData, `/rooms/${params.roomId}/matches`, '試合表'),
            { name: 'twitter:card', content: 'summary' },
          ],
        }
      : {},
  component: MatchesPage,
})

type Density = 'compact' | 'standard'

function MatchesPage() {
  const { roomId } = Route.useParams()
  const { user } = useCurrentUser()
  const { showToast } = useToast()
  // ポーリングで他端末の操作 (セット開始・ニックネーム変更・出入り) をリロードなしで反映する。
  // 終了済みルームでは自動停止する (queries.ts 側の判定)。
  const { data: schedule, isLoading, isError, error } = useMatches(roomId, {
    live: true,
  })
  // 参加者情報 (room) もルーム終了までポーリングする (終了判定は queries.ts 側)。
  // 番号の変更・途中参加・早退・終了検知が他端末に反映されるようにするため。
  // 内容が変わらない間は TanStack Query の structural sharing により再レンダリングは発生しない。
  const { data: room } = useRoom(roomId, { live: true })
  const closed = room?.status === 'CLOSED'
  const qc = useQueryClient()

  // 再編成で途中参加者が試合表に現れたら、次の room ポーリングを待たずに
  // すぐ名前を解決できるよう room を取り直す (未知の ParticipantId を検知したときのみ)。
  useEffect(() => {
    if (!schedule || !room) return
    const known = new Set(room.participants.map((p) => p.id))
    const hasUnknown = schedule.matches.some(
      (m) =>
        !known.has(m.pairA.player1Id) ||
        !known.has(m.pairA.player2Id) ||
        !known.has(m.pairB.player1Id) ||
        !known.has(m.pairB.player2Id),
    )
    if (hasUnknown) qc.invalidateQueries({ queryKey: queryKeys.room(roomId) })
  }, [schedule, room, roomId, qc])
  const startSet = useStartSet(roomId)
  const revertSet = useRevertSet(roomId)
  const addSets = useAddSets(roomId)
  const replan = useReplanFutureSets(roomId)
  const closeRoom = useCloseRoom(roomId)
  // 表示密度。既定はコンパクト(1画面に多くのセットを収める)。
  const [density, setDensity] = useState<Density>('compact')
  const [addCount, setAddCount] = useState(3)
  const [confirmingClose, setConfirmingClose] = useState(false)
  // 最下部の「セットを追加」の入力UI(ステッパー)の開閉。
  const [addingSets, setAddingSets] = useState(false)
  // 運営メニューの開閉。参加者リストが長くなりがちなので、既定では畳んでおく。
  const [organizerOpen, setOrganizerOpen] = useState(false)
  const [showSelfModal, setShowSelfModal] = useState(false)
  // 自己申告で選んだ自分の ParticipantId (localStorage 由来)。
  const [selfParticipantId, setSelfParticipantId] = useState<string | null>(null)

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

  // マウント後に localStorage から「自分の番号」設定を読み込む(SSR不一致を避けるため effect 内)。
  // これは任意の見やすさ設定なので、未設定でもモーダルは自動では出さない
  // (自分の番号は各自が明示的に設定ボタンから設定する)。
  useEffect(() => {
    const stored = getSelfParticipant(roomId)
    if (stored?.participantId) setSelfParticipantId(stored.participantId)
  }, [roomId])

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

  // セットの開始を検知して知らせる (ポーリングによる他端末からの反映でも気付けるように)。
  // 自分で開始ボタンを押した場合はトースト、他端末からの検知は全画面アナウンス。
  // 初回読み込みと、開始前に戻す操作 (番号が減る) では通知しない。
  const prevActiveSetRef = useRef<number | null | undefined>(undefined)
  // 直前のセット開始が自分の操作によるものか (アナウンス抑制用)。
  const selfStartedRef = useRef(false)
  // 全画面アナウンス中のセット番号 (null = 非表示)。
  const [announcedSet, setAnnouncedSet] = useState<number | null>(null)
  useEffect(() => {
    if (!schedule) return
    const prev = prevActiveSetRef.current
    prevActiveSetRef.current = activeSetNumber
    if (prev === undefined) return
    if (activeSetNumber !== null && (prev === null || activeSetNumber > prev)) {
      if (selfStartedRef.current) {
        selfStartedRef.current = false
        showToast(`第${activeSetNumber}セットが開始されました`)
      } else {
        setAnnouncedSet(activeSetNumber)
      }
    }
  }, [schedule, activeSetNumber, showToast])

  // アナウンス対象セットでの自分の試合 (出ないセットなら null)。
  const announcedMatch = useMemo(() => {
    if (announcedSet == null || !schedule || !myParticipantId) return null
    return (
      schedule.matches.find(
        (m) =>
          m.setNumber === announcedSet &&
          [
            m.pairA.player1Id,
            m.pairA.player2Id,
            m.pairB.player1Id,
            m.pairB.player2Id,
          ].includes(myParticipantId),
      ) ?? null
    )
  }, [announcedSet, schedule, myParticipantId])

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

  const dense = density === 'compact'

  return (
    <div className="space-y-5">
      {announcedSet != null ? (
        <SetStartAnnouncement
          setNumber={announcedSet}
          courtNumber={announcedMatch?.courtNumber ?? null}
          memberIndexes={
            announcedMatch
              ? [
                  announcedMatch.pairA.player1Id,
                  announcedMatch.pairA.player2Id,
                  announcedMatch.pairB.player1Id,
                  announcedMatch.pairB.player2Id,
                ].map((id) => ({
                  index: indexByParticipantId.get(id) ?? '?',
                  self: id === myParticipantId,
                }))
              : null
          }
          identified={!!myParticipantId}
          onClose={() => setAnnouncedSet(null)}
        />
      ) : null}

      {showSelfModal ? (
        <SelfNumberModal
          participants={room?.participants ?? []}
          initialNumber={
            myParticipantId ? indexByParticipantId.get(myParticipantId) ?? null : null
          }
          onSubmit={(participantId) => {
            // DB には送らず localStorage に保存するだけ(重複可)。
            setSelfParticipant(roomId, participantId)
            setSelfParticipantId(participantId)
            setShowSelfModal(false)
            showToast('自分の番号を設定しました')
          }}
          onClear={
            myParticipantId
              ? () => {
                  removeSelfParticipant(roomId)
                  setSelfParticipantId(null)
                  setShowSelfModal(false)
                  showToast('自分の番号を解除しました')
                }
              : undefined
          }
          onCancel={() => setShowSelfModal(false)}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-sm text-emerald-600 hover:underline">
            ← ルーム一覧へ
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{room?.title ?? '試合表'}</h1>
            {closed ? (
              <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                終了済み
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-500">
            全 {setCount} セット・{schedule.matchCount} 試合
          </p>
          {/* 参加者は任意で自分の番号を設定でき、設定すると自分の試合が強調される
              (運営者は運営メニューから設定する)。 */}
          {!isOrganizer && !closed ? (
            myParticipantId ? (
              <p className="mt-0.5 text-xs text-slate-500">
                あなた: {indexByParticipantId.get(myParticipantId) ?? '?'}番
                <button
                  type="button"
                  onClick={() => setShowSelfModal(true)}
                  className="ml-1.5 font-medium text-emerald-600 hover:underline"
                >
                  変更する
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowSelfModal(true)}
                className="mt-0.5 text-xs font-medium text-emerald-600 hover:underline"
              >
                自分の番号を設定（自分の試合が強調表示されます）
              </button>
            )
          ) : null}
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1" role="group" aria-label="表示切替">
          <button
            type="button"
            onClick={() => setDensity('compact')}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
              (density === 'compact'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            コンパクト
          </button>
          <button
            type="button"
            onClick={() => setDensity('standard')}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
              (density === 'standard'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            標準
          </button>
        </div>
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
              {/* 自分の番号 (運営者もプレーヤーとして参加する場合の自己申告) */}
              <div className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-800">自分の番号</h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      {myParticipantId
                        ? `${indexByParticipantId.get(myParticipantId) ?? '?'} 番として設定済み。自分の試合が強調表示されます。`
                        : '未設定です。設定すると自分の試合が強調表示されます。'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowSelfModal(true)}
                  >
                    {myParticipantId ? '変更する' : '設定する'}
                  </Button>
                </div>
              </div>

              {/* 参加者の出入り */}
              <div className="px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-800">参加者</h3>
                </div>
                <ParticipantManager
                  roomId={roomId}
                  shareCode={room?.shareCode}
                  participants={room?.participants ?? []}
                  fixedPairs={room?.fixedPairs ?? []}
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

              {/* スクショ用ページ */}
              <div className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Camera className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        スクショ用ページ
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      セット・コート・番号だけの一覧を別タブで開きます。
                    </p>
                  </div>
                  <Link
                    to="/rooms/$roomId/matches/print"
                    params={{ roomId }}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
                  >
                    開く
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {schedule.matches.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">該当する試合がありません。</p>
          </CardBody>
        </Card>
      ) : (
        <MatchScheduleList
          matches={schedule.matches}
          dense={dense}
          indexByParticipantId={indexByParticipantId}
          highlightParticipantId={myParticipantId}
          activeSetNumber={activeSetNumber}
          startableSetNumber={startableSetNumber}
          isOrganizer={isOrganizer && !closed}
          onStartSet={(setNumber) => {
            // 自分の操作による開始では全画面アナウンスを出さない (トーストのみ)。
            selfStartedRef.current = true
            startSet.mutate(setNumber)
          }}
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
          ) : addingSets ? (
            // セット追加の入力UI。押すまではボタンだけの控えめな表示にしておく。
            // 運営メニュー内の追加と同じ addCount / addSets を共有する。
            <div className="flex flex-wrap items-center justify-center gap-2">
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
                    onSuccess: () => {
                      showToast('セットを追加しました')
                      setAddingSets(false)
                    },
                  })
                }
                disabled={addSets.isPending}
              >
                {addSets.isPending ? '追加中…' : '追加'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAddingSets(false)}
                disabled={addSets.isPending}
              >
                キャンセル
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setAddingSets(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-emerald-700"
              >
                <ListPlus className="h-4 w-4" />
                セットを追加
              </button>
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
          {!confirmingClose && addSets.isError ? (
            <p className="mt-2 text-sm text-red-600">
              {addSets.error instanceof Error
                ? addSets.error.message
                : 'セットの追加に失敗しました'}
            </p>
          ) : null}
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
