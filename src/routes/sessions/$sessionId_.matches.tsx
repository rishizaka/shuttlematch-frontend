import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  useAddSets,
  useCircle,
  useMatches,
  useReplanFutureSets,
  useSession,
  useStartSet,
  useUserNames,
} from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { buildParticipantNameLookup } from '../../components/match/MatchCard'
import {
  MatchScheduleList,
  filterMatchesForParticipant,
} from '../../components/match/MatchScheduleList'

export const Route = createFileRoute('/sessions/$sessionId_/matches')({
  component: MatchesPage,
})

type Filter = 'all' | 'mine'

function MatchesPage() {
  const { sessionId } = Route.useParams()
  const { user } = useCurrentUser()
  const { data: session } = useSession(sessionId)
  const { data: circle } = useCircle(session?.circleId)
  const { data: schedule, isLoading, isError, error } = useMatches(sessionId)
  const startSet = useStartSet(sessionId)
  const addSets = useAddSets(sessionId)
  const replan = useReplanFutureSets(sessionId)
  const [filter, setFilter] = useState<Filter>('all')
  const [addCount, setAddCount] = useState(3)

  // 早退者がいる、または在席者で未開始セットに一度も出ていない人がいる = 再編成の余地あり。
  const hasLeftParticipant = (session?.participants ?? []).some((p) => p.status === 'LEFT')

  // 運営者(セッション作成者 or サークルの ORGANIZER)のみセット開始操作ができる。
  const isOrganizer = useMemo(() => {
    if (!user || !session) return false
    if (session.createdBy === user.id) return true
    return !!circle?.members.some((m) => m.userId === user.id && m.role === 'ORGANIZER')
  }, [user, session, circle])

  const userIds = (session?.participants ?? [])
    .map((p) => p.userId)
    .filter((id): id is string => !!id)
  const userNames = useUserNames(userIds)

  const nameByParticipantId = useMemo(
    () => buildParticipantNameLookup(session?.participants ?? [], userNames),
    [session, userNames],
  )

  // 参加者一覧の並び順を 1 始まりの番号として割り当てる。
  const indexByParticipantId = useMemo(() => {
    const map = new Map<string, number>()
    ;(session?.participants ?? []).forEach((p, i) => map.set(p.id, i + 1))
    return map
  }, [session])

  // 自分の ParticipantId (このセッションに参加している場合)。
  const myParticipantId = useMemo(
    () => session?.participants.find((p) => p.userId === user?.id)?.id ?? null,
    [session, user],
  )

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/sessions/$sessionId"
            params={{ sessionId }}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← セッションへ戻る
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">試合表</h1>
          <p className="text-sm text-slate-500">
            全 {setCount} セット・{schedule.matchCount} 試合
          </p>
        </div>
        {myParticipantId ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'primary' : 'secondary'}
              onClick={() => setFilter('all')}
            >
              すべて
            </Button>
            <Button
              size="sm"
              variant={filter === 'mine' ? 'primary' : 'secondary'}
              onClick={() => setFilter('mine')}
            >
              自分の試合
            </Button>
          </div>
        ) : null}
      </div>

      {isOrganizer ? (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-600">
                セット数が足りない場合は、現在の結果を保ったまま追加できます。
              </p>
              <div className="flex items-center gap-2 sm:ml-auto">
                <label className="flex items-center gap-1 text-sm text-slate-500">
                  追加
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={addCount}
                    onChange={(e) =>
                      setAddCount(Math.min(30, Math.max(1, Math.floor(Number(e.target.value) || 1))))
                    }
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                  セット
                </label>
                <Button
                  size="sm"
                  onClick={() => addSets.mutate(addCount)}
                  disabled={addSets.isPending}
                >
                  {addSets.isPending ? '追加中…' : 'セットを追加'}
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

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <p className="text-sm text-slate-600">
                途中参加・早退があったら、未開始セットを現在の在席者で組み直せます。
                {hasLeftParticipant ? (
                  <span className="ml-1 font-medium text-emerald-700">
                    早退者がいます。
                  </span>
                ) : null}
                <span className="block text-xs text-slate-400">
                  開始済みのセットはそのまま。人数が足りない場合はコート数を自動で減らします。
                </span>
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="sm:ml-auto"
                onClick={() => replan.mutate()}
                disabled={replan.isPending}
              >
                {replan.isPending ? '再編成中…' : '未開始セットを再編成'}
              </Button>
            </div>
            {replan.isError ? (
              <p className="mt-2 text-sm text-red-600">
                {replan.error instanceof Error
                  ? replan.error.message
                  : '再編成に失敗しました'}
              </p>
            ) : null}
          </CardBody>
        </Card>
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
          isOrganizer={isOrganizer}
          onStartSet={(setNumber) => startSet.mutate(setNumber)}
          startingSetNumber={startSet.isPending ? startSet.variables : null}
        />
      )}
    </div>
  )
}
