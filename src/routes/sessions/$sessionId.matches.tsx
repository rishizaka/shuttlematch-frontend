import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMatches, useSession, useUserNames } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { Card, CardBody } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { buildParticipantNameLookup } from '../../components/match/MatchCard'
import {
  MatchScheduleList,
  filterMatchesForParticipant,
} from '../../components/match/MatchScheduleList'

export const Route = createFileRoute('/sessions/$sessionId/matches')({
  component: MatchesPage,
})

type Filter = 'all' | 'mine'

function MatchesPage() {
  const { sessionId } = Route.useParams()
  const { user } = useCurrentUser()
  const { data: session } = useSession(sessionId)
  const { data: schedule, isLoading, isError, error } = useMatches(sessionId)
  const [filter, setFilter] = useState<Filter>('all')

  const userIds = (session?.participants ?? [])
    .map((p) => p.userId)
    .filter((id): id is string => !!id)
  const userNames = useUserNames(userIds)

  const nameByParticipantId = useMemo(
    () => buildParticipantNameLookup(session?.participants ?? [], userNames),
    [session, userNames],
  )

  // 自分の ParticipantId (このセッションに参加している場合)。
  const myParticipantId = useMemo(
    () => session?.participants.find((p) => p.userId === user?.id)?.id ?? null,
    [session, user],
  )

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
          <p className="text-sm text-slate-500">全 {schedule.matchCount} 試合</p>
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
          highlightParticipantId={filter === 'all' ? myParticipantId : null}
        />
      )}
    </div>
  )
}
