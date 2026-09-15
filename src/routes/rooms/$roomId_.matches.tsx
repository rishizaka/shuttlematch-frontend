import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  Archive,
  ChevronDown,
  ListPlus,
  Lock,
  LogOut,
  Minus,
  Plus,
  Camera,
  RefreshCw,
  Settings2,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import {
  queryKeys,
  useAddSets,
  useClaimNextParticipant,
  useClaimNumber,
  useRenameParticipant,
  useCloseRoom,
  useDeleteRoom,
  useMatches,
  useReplanFutureSets,
  useRevertSet,
  useRoom,
  useStartSet,
} from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { roomApi } from '../../lib/api'
import {
  addRoomId,
  getSelfParticipant,
  setSelfParticipant,
  removeSelfParticipant,
  removeRoomId,
  subscribe,
} from '../../lib/local-store'
import { FREE_SLOT } from '../../lib/guests'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { roomOgMeta } from '../../lib/og'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorBlock } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { ClaimNumberModal } from '../../components/room/ClaimNumberModal'
import { QuickJoinBanner } from '../../components/room/QuickJoinBanner'
import { Lobby } from '../../components/room/Lobby'
import { ParticipantManager } from '../../components/room/ParticipantManager'
import { RosterAccordion } from '../../components/room/RosterAccordion'
import { MatchScheduleList } from '../../components/match/MatchScheduleList'
import { MatchesSkeleton } from '../../components/match/MatchesSkeleton'
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
  // 試合表のリンクカードは画像なし(テキストのみ)。リンクでよく共有するため、
  // og:image は足さず、twitter:card も設定しない。
  // (twitter:card=summary を付けると画像枠を要求され、og:image が無いときに
  //  サイトアイコン(favicon)をサムネイルとして拾われてノイズになる)
  head: ({ loaderData, params }) =>
    loaderData
      ? { meta: roomOgMeta(loaderData, `/rooms/${params.roomId}/matches`, '試合表') }
      : {},
  // ルーム一覧などから遷移してきて loader を待つあいだ。初回表示(SSR)の待ちは
  // コンポーネント側の MatchesSkeleton が受け持つ。
  pendingComponent: () => <MatchesSkeleton />,
  component: MatchesPage,
})

function MatchesPage() {
  const { roomId } = Route.useParams()
  // OGP 用に loader が SSR で取ってきたルーム(失敗時は null)。
  // 読み込み中の骨組みに本物のルーム名とコート数を出すのに使い回す。
  const seed = Route.useLoaderData()
  const { user } = useCurrentUser()
  const { showToast } = useToast()
  // ポーリングで他端末の操作 (セット開始・ニックネーム変更・出入り) をリロードなしで反映する。
  // 終了済みルームでは自動停止する (queries.ts 側の判定)。
  const { data: schedule, isLoading, error, refetch: refetchMatches } = useMatches(roomId, {
    live: true,
  })
  // 参加者情報 (room) もルーム終了までポーリングする (終了判定は queries.ts 側)。
  // 番号の変更・途中参加・早退・終了検知が他端末に反映されるようにするため。
  // 内容が変わらない間は TanStack Query の structural sharing により再レンダリングは発生しない。
  const { data: room, refetch: refetchRoom } = useRoom(roomId, { live: true })
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
  const deleteRoom = useDeleteRoom(roomId, room?.shareCode)
  const claim = useClaimNumber(roomId)
  const claimNext = useClaimNextParticipant(roomId)
  const rename = useRenameParticipant(roomId)
  const navigate = useNavigate()
  const [addCount, setAddCount] = useState(3)
  const [confirmingClose, setConfirmingClose] = useState(false)
  // ルーム削除の確認モーダルの開閉。
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // 最下部の「セットを追加」の入力UI(ステッパー)の開閉。
  const [addingSets, setAddingSets] = useState(false)
  // 運営メニューの開閉。参加者リストが長くなりがちなので、既定では畳んでおく。
  const [organizerOpen, setOrganizerOpen] = useState(false)
  // 自分の番号を決める・名前を変更するモーダルの開閉。番号だけの枠を選んで名前を付ける
  // ことも、既に名乗っている番号の名前だけ変えることもできる(下の submitClaim 参照)。
  const [showClaimModal, setShowClaimModal] = useState(false)
  // 「早退する」の確認モーダルの開閉。自分の番号がフリーになり端末の紐付けも解けるので、
  // 誤タップで即実行されないよう確認を挟む。
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  // 自分の ParticipantId (localStorage 由来)。参加(join)や番号設定で store が更新されたら
  // 即座に反映されるよう、リアクティブに購読する(useCurrentUser と同じ仕組み)。
  const selfParticipantId = useSyncExternalStore(
    subscribe,
    () => getSelfParticipant(roomId)?.participantId ?? null,
    () => null,
  )

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

  // 早退ボタンは「まだ在席している自分」にだけ出す(既に早退中ならもう出す意味が無い。
  // フリーにする操作は早退中の枠には使えない=ParticipantList.canMakeFree と同じ条件)。
  const myParticipantActive =
    room?.participants.find((p) => p.id === myParticipantId)?.status !== 'LEFT'

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

  // 簡易作成ルームで、1セット目が始まる前だけ「参加する」の自動採番導線を出す。
  // 受付モードは生成直後(1セット目前)でも番号を選ぶ導線のままにする(既に名前入りの
  // 早退中の枠などへ選び直したい場合があり、自動採番だけでは足りないため)。
  const showQuickJoin = !closed && activeSetNumber === null && !!room?.quickCreated

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

  // 受付中(未生成)のロビーは matches クエリのローディング状態に依存させない。
  // 依存すると 10 秒ごとのポーリングで isLoading が一瞬 true になり、LoadingBlock を
  // 挟んでロビーが再マウントし、入力中の名前が消えてしまう(全画面が再読込される感覚)。
  // room さえ取れていれば status で判定して安定表示する。
  if (room && room.status !== 'GENERATED' && room.status !== 'CLOSED') {
    return <Lobby room={room} isOrganizer={isOrganizer} />
  }
  // 試合表が届くまでの場所取り。リンクから開くと数秒かかることがあり、
  // スピナーだけだと真っ白なページに見えてしまう。
  const skeleton = (
    <MatchesSkeleton
      title={room?.title ?? seed?.title}
      courts={(room ?? seed)?.courtCount ?? undefined}
    />
  )
  if (isLoading) return skeleton
  if (!schedule) {
    if (!room) {
      // room も matches も取れていない。取得失敗(ネットワーク断など)なら再試行を出し、
      // 取得中ならローディングを出す。
      if (error) {
        return (
          <ErrorBlock
            message={error.message}
            onRetry={() => {
              void refetchRoom()
              void refetchMatches()
            }}
          />
        )
      }
      return skeleton
    }
    // 生成済みだがスケジュール取得待ち(生成直後など)はロビー、終了済みはエラー。
    if (room.status !== 'CLOSED') {
      return <Lobby room={room} isOrganizer={isOrganizer} />
    }
    return (
      <ErrorBlock
        message={
          error instanceof Error ? error.message : 'この試合表はまだ生成されていません'
        }
        onRetry={error ? () => void refetchMatches() : undefined}
      />
    )
  }

  // 「受付で作ったルームか、人数を指定して作ったルームか」で導線を分けていた頃の名残として
  // 参加者の名前から受付モードを推測していたが、推測はやめた。どちらのルームでも参加者は
  // 同じ1枚(ClaimNumberModal)で自分を名乗り、名前を入れれば名簿に載る(API)、入れなければ
  // 番号を端末が覚えるだけ(localStorage)。最初の1人が名前を入れた瞬間に画面の作りが
  // 変わってしまう問題も、これで無くなる。
  //
  // ParticipantId -> 名前(実名のみ)。番号タップで名前を出すツールチップに使う。
  const nameByParticipantId = new Map<string, string>()
  for (const p of room?.participants ?? []) {
    if (p.guestName && !/^\d+$/.test(p.guestName.trim())) {
      nameByParticipantId.set(p.id, p.guestName)
    }
  }

  const submitClaim = (participantId: string, name: string | null) => {
    // 切り替え前に自分が名乗っていた番号。別の番号に切り替えるときだけ、間違えて
    // 入力した名前を番号の表示(「3」なら "3")に戻す。名簿に実名が残ったまま
    // 端末だけ切り替わると、誰も紐付いていない実名が名簿に浮いてしまうため
    // (簡易版で番号を選び間違えたときに起きていた不具合)。
    const previousParticipantId = myParticipantId
    const revertPrevious = () => {
      if (!previousParticipantId || previousParticipantId === participantId) return
      if (!nameByParticipantId.has(previousParticipantId)) return
      const number = indexByParticipantId.get(previousParticipantId)
      if (number == null) return
      rename.mutate({ participantId: previousParticipantId, name: String(number) })
    }

    // 実名入りの番号を選んだ場合(name=null)は名簿に触れず、端末の紐付けだけ行う。
    // 番号の指定は排他にしない(重複可)。間違えても選び直すだけで直せるようにする。
    if (name === null) {
      setSelfParticipant(roomId, participantId)
      addRoomId(roomId)
      setShowClaimModal(false)
      showToast('自分の番号を設定しました')
      revertPrevious()
      return
    }
    claim.mutate(
      { participantId, name },
      {
        onSuccess: () => {
          setShowClaimModal(false)
          showToast(`${name}として参加しました`)
          revertPrevious()
        },
      },
    )
  }

  // 参加者自身が押す「早退する」。運営者の早退(status=LEFT、未開始セットから除外して
  // 再編成)とは別物の軽量な操作: 自分の番号をフリーにして(名簿はそのまま在席・出場も
  // 変わらない)、端末との紐付けだけ解く。代わりに来た人が同じ番号を名乗れるようにする。
  const submitLeave = () => {
    if (!myParticipantId) return
    rename.mutate(
      { participantId: myParticipantId, name: FREE_SLOT },
      {
        onSuccess: () => {
          removeSelfParticipant(roomId)
          setConfirmingLeave(false)
          showToast('早退しました。あなたの番号はフリーになりました')
        },
      },
    )
  }

  return (
    // 最下部の「セットを追加」「ルームを終了」が画面の端に来ると押しにくいので、
    // 下に余白を確保しておく。
    <div className="space-y-5 pb-24">
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

      {showClaimModal ? (
        <ClaimNumberModal
          participants={room?.participants ?? []}
          myParticipantId={myParticipantId}
          pending={claim.isPending}
          error={claim.isError ? (claim.error as Error).message : null}
          onSubmit={submitClaim}
          onCancel={() => setShowClaimModal(false)}
        />
      ) : null}

      {confirmingLeave && myParticipantId ? (
        <ConfirmModal
          title="早退しますか？"
          description={`あなたの${indexByParticipantId.get(myParticipantId) ?? '?'}番は「フリー」になり、代わりに来た人が同じ番号を名乗れるようになります。この端末との紐付けも解除されます。`}
          confirmLabel="早退する"
          confirming={rename.isPending}
          onConfirm={submitLeave}
          onCancel={() => setConfirmingLeave(false)}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-sm text-brand-600 hover:underline">
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
          {/* 自分の番号表示。名前を名乗っていれば併記する。「名前を変更」は番号の選び直し
              も兼ねる(ClaimNumberModal を再利用、submitClaim 参照)。番号を選び間違えて
              違う番号に実名を入れてしまっても、選び直せば元の番号は番号の表示に戻る。
              「早退する」は運営者の早退(未開始セットから除外・再編成)とは別の軽量操作。
              自分の番号をフリーにして紐付けを解くだけで、出場やセット構成は変わらない
              (submitLeave 参照)。既に早退中なら出さない(myParticipantActive)。
              運営者もプレーヤーとして出るので、参加者と同じ位置に出す。 */}
          {!closed && myParticipantId ? (
            <p className="mt-0.5 text-xs text-slate-500">
              あなた: {indexByParticipantId.get(myParticipantId) ?? '?'}番
              {nameByParticipantId.get(myParticipantId)
                ? ` ・ ${nameByParticipantId.get(myParticipantId)}`
                : null}
              <button
                type="button"
                onClick={() => setShowClaimModal(true)}
                className="ml-1.5 font-medium text-brand-600 hover:underline"
              >
                {nameByParticipantId.get(myParticipantId) ? '名前を変更' : '名前を入れる'}
              </button>
              {myParticipantActive ? (
                <button
                  type="button"
                  onClick={() => setConfirmingLeave(true)}
                  className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-slate-500 hover:text-slate-800"
                >
                  <LogOut className="h-3 w-3" />
                  早退する
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      {/* 自分がまだ未設定の人への誘導。
          簡易作成ルームで1セット目が始まる前なら「参加する」で自動採番(QuickJoinBanner)、
          それ以外(受付モード・1セット目開始後)は従来通り番号を選ばせる
          (遅刻者も運営が用意した空き番号を指定して入る)。
          QuickJoinBanner が失敗した(空き枠が本当に無かった等)ときは、念のため
          従来の番号選択(番号を入力しましょう)も併せて出す。 claimNextFreeSlot は
          フリー・遅刻者ビジター枠まで対象にしているので基本は成立するはずだが、
          万一の抜け漏れに備えた保険。
          運営者もプレーヤーを兼ねるので同じ導線を使う(運営メニューには置かない)。 */}
      {!closed && !myParticipantId ? (
        <>
          {showQuickJoin ? (
            <QuickJoinBanner
              pending={claimNext.isPending}
              error={claimNext.isError ? (claimNext.error as Error).message : null}
              onSubmit={(name) =>
                claimNext.mutate(name, {
                  onSuccess: (result) => showToast(`${result.number}番として参加しました`),
                })
              }
            />
          ) : null}
          {!showQuickJoin || claimNext.isError ? (
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <UserRound className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-amber-900">
                  自分の番号を入力しましょう
                </span>
                <span className="block text-xs text-amber-700">
                  {showQuickJoin
                    ? '空いている番号や既に名前の付いた番号から選べます。'
                    : '設定すると、自分が出る試合が強調表示されて見やすくなります。'}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-sm font-semibold text-amber-700">
                <Plus className="h-4 w-4" />
                入力
              </span>
            </button>
          ) : null}
        </>
      ) : null}

      {closed ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            この試合表は終了済みとして記録されています。内容の変更はできません。
          </p>
        </div>
      ) : null}

      {/* 参加者名簿(番号→名前)。名前運用(受付モード)のときだけ出る。
          運営者には既定では出さない(運営メニューの参加者管理で名前を見られるため)が、
          終了済みルームでは運営メニューごと消えるので、そのときは運営者にも出す。
          出さないと運営者だけ番号と名前の対応を確認できなくなる。
          QuickJoinBanner(参加する)を出す間は forceVisible で強制表示する。
          押す前でも、今何人参加しているか見えていてよいため。 */}
      {!isOrganizer || closed ? (
        <RosterAccordion
          participants={room?.participants ?? []}
          selfParticipantId={myParticipantId}
          forceVisible={showQuickJoin}
        />
      ) : null}

      {/* 運営メニュー。終了済みでも出す(削除とスクショ用ページは終了後にも要る)。
          試合表を書き換える操作だけ、中で closed のときに落とす。 */}
      {isOrganizer ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* ヘッダー行は常に表示し、タップでメニュー全体を開閉する。 */}
          <button
            type="button"
            onClick={() => setOrganizerOpen((v) => !v)}
            aria-expanded={organizerOpen}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Settings2 className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">運営メニュー</span>
              <span className="block truncate text-xs text-slate-500">
                在席 {activeCount} 人
                {leftCount > 0 ? `・早退 ${leftCount} 人` : ''}・全 {setCount} セット
              </span>
            </span>
            {hasLeftParticipant && !organizerOpen && !closed ? (
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

          {/* 中身は瞬時に開閉する(高さアニメは付けない)。開閉の合図はシェブロンの回転のみ。 */}
          {organizerOpen ? (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {/* 「自分の番号」はここには置かない。運営者もプレーヤーとして参加者と同じ
                  ページ上部の導線を使う(以前は受付モードのときだけここにも出していた)。 */}

              {/* 試合表を書き換える操作。終了済みでは変更できないので出さない。 */}
              {!closed ? (
                <>
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

              {/* セットの追加はページ最下部に置いてあるので、ここには重複して置かない。 */}

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
                </>
              ) : null}

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

              {/* ルーム削除(危険操作)。間違えて作成した場合などにデータごと破棄する。 */}
              <div className="bg-red-50/40 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      <h3 className="text-sm font-semibold text-red-700">ルームを削除</h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      参加者・試合表を含めてすべて完全に削除します。元に戻せません。
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={deleteRoom.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    削除する
                  </Button>
                </div>
                {deleteRoom.isError ? (
                  <p className="mt-2 text-sm text-red-600">
                    {deleteRoom.error instanceof Error
                      ? deleteRoom.error.message
                      : 'ルームの削除に失敗しました'}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {confirmingDelete ? (
        <ConfirmModal
          title="このルームを削除しますか？"
          description="参加者・固定ペア・試合表を含めてすべて完全に削除します。元に戻せません。"
          confirmLabel="削除する"
          cancelLabel="やめる"
          danger
          confirming={deleteRoom.isPending}
          onConfirm={() =>
            deleteRoom.mutate(undefined, {
              onSuccess: () => {
                removeRoomId(roomId)
                setConfirmingDelete(false)
                showToast('ルームを削除しました')
                void navigate({ to: '/' })
              },
            })
          }
          onCancel={() => setConfirmingDelete(false)}
        />
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
          indexByParticipantId={indexByParticipantId}
          nameByParticipantId={nameByParticipantId}
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
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-brand-700"
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
