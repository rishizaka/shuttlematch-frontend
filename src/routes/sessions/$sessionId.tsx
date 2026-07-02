import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Calendar, ListChecks, MapPin, Users } from 'lucide-react'
import { useCircle, useSession, useUserNames } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { addSessionId } from '../../lib/local-store'
import type { Circle, Session } from '../../lib/types'
import { formatDateTime, sessionStatusLabel, visibilityLabel } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge, statusTone } from '../../components/ui/Badge'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { ParticipantList } from '../../components/session/ParticipantList'
import { ParticipantManager } from '../../components/session/ParticipantManager'
import { ParticipationPanel } from '../../components/session/ParticipationPanel'
import { GenerateMatchesButton } from '../../components/match/GenerateMatchesButton'

export const Route = createFileRoute('/sessions/$sessionId')({ component: SessionPage })

function isOrganizer(session: Session, circle: Circle | undefined, userId: string | undefined): boolean {
  if (!userId) return false
  if (session.createdBy === userId) return true
  if (!circle) return false
  return circle.members.some((m) => m.userId === userId && m.role === 'ORGANIZER')
}

function SessionPage() {
  const { sessionId } = Route.useParams()
  const { user } = useCurrentUser()
  const { data: session, isLoading, isError, error } = useSession(sessionId)
  const { data: circle, isLoading: circleLoading } = useCircle(session?.circleId)

  useEffect(() => {
    if (session) addSessionId(session.id)
  }, [session])

  const userIds = (session?.participants ?? [])
    .map((p) => p.userId)
    .filter((id): id is string => !!id)
  const names = useUserNames(userIds)

  if (isLoading) return <LoadingBlock />
  if (isError || !session) {
    return <ErrorBlock message={error instanceof Error ? error.message : 'セッションを取得できませんでした'} />
  }

  const organizer = isOrganizer(session, circle, user?.id)
  const generated = session.status === 'GENERATED'
  const closed = session.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/circles/$circleId"
            params={{ circleId: session.circleId }}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← サークルへ戻る
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{session.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={statusTone(session.status)}>{sessionStatusLabel(session.status)}</Badge>
            {session.visibility === 'MEMBERS_ONLY' ? (
              <Badge tone="amber">{visibilityLabel(session.visibility)}</Badge>
            ) : null}
          </div>
        </div>
        <ParticipationPanel
          session={session}
          user={user}
          circle={circle}
          circleLoading={circleLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="開催情報" />
            <CardBody>
              <dl className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
                  {formatDateTime(session.heldAt)}
                </div>
                {session.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                    {session.location}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" aria-hidden />
                  参加 {session.participantCount}
                  {session.capacity ? ` / ${session.capacity}` : ''} 名
                </div>
              </dl>
            </CardBody>
          </Card>

          {(generated || organizer) && (
            <Card>
              <CardHeader
                title="試合"
                action={
                  generated ? (
                    <Link
                      to="/sessions/$sessionId/matches"
                      params={{ sessionId: session.id }}
                      search={{ openExternalBrowser: 1 }}
                      className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline"
                    >
                      <ListChecks className="h-4 w-4" />
                      試合表を見る
                    </Link>
                  ) : undefined
                }
              />
              <CardBody className="space-y-3">
                {generated ? (
                  <p className="text-sm text-slate-600">試合は生成済みです。</p>
                ) : (
                  <p className="text-sm text-slate-600">まだ試合は生成されていません。</p>
                )}
                {organizer ? (
                  <GenerateMatchesButton session={session} alreadyGenerated={generated} />
                ) : null}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`参加者 (${session.participantCount})`}
              description={organizer ? '代理登録・ゲスト追加・削除ができます' : undefined}
            />
            <CardBody>
              {organizer && !closed ? (
                <ParticipantManager
                  sessionId={session.id}
                  participants={session.participants}
                  names={names}
                  generated={generated}
                />
              ) : (
                <ParticipantList participants={session.participants} names={names} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
