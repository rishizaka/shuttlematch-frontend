import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Calendar, ListChecks, MapPin, Users } from 'lucide-react'
import { useRoom, useUserNames } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { roomApi } from '../../lib/api'
import { addRoomId } from '../../lib/local-store'
import { ogImageMeta, roomOgMeta } from '../../lib/og'
import type { Room } from '../../lib/types'
import { formatDateTime, roomStatusLabel } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Badge, statusTone } from '../../components/ui/Badge'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { ParticipantList } from '../../components/room/ParticipantList'
import { ParticipantManager } from '../../components/room/ParticipantManager'
import { ParticipationPanel } from '../../components/room/ParticipationPanel'
import { GenerateMatchesButton } from '../../components/match/GenerateMatchesButton'

export const Route = createFileRoute('/rooms/$roomId')({
  // OGP(SNS のリンクカード)用。クローラーは JS を実行しないため、
  // SSR の HTML にルーム名入りのメタタグを含める必要がある。
  // 失敗してもページ自体はクライアント側の useRoom で表示できるので null に落とす。
  loader: async ({ params }) => {
    try {
      return await roomApi.get(params.roomId)
    } catch {
      return null
    }
  },
  head: ({ loaderData, params }) =>
    loaderData
      ? {
          meta: [
            ...roomOgMeta(loaderData, `/rooms/${params.roomId}`, 'ルーム'),
            ...ogImageMeta(),
          ],
        }
      : {},
  component: RoomPage,
})

function isOrganizer(room: Room, userId: string | undefined): boolean {
  // ルームは作成者(オーナー)のみが運営操作できる。
  return !!userId && room.createdBy === userId
}

function RoomPage() {
  const { roomId } = Route.useParams()
  const { user } = useCurrentUser()
  const { data: room, isLoading, isError, error } = useRoom(roomId)

  useEffect(() => {
    if (room) addRoomId(room.id)
  }, [room])

  const userIds = (room?.participants ?? [])
    .map((p) => p.userId)
    .filter((id): id is string => !!id)
  const names = useUserNames(userIds)

  if (isLoading) return <LoadingBlock />
  if (isError || !room) {
    return <ErrorBlock message={error instanceof Error ? error.message : 'ルームを取得できませんでした'} />
  }

  const organizer = isOrganizer(room, user?.id)
  const generated = room.status === 'GENERATED'
  const closed = room.status === 'CLOSED'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/" className="text-sm text-emerald-600 hover:underline">
            ← ルーム一覧へ
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{room.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={statusTone(room.status)}>{roomStatusLabel(room.status)}</Badge>
          </div>
        </div>
        <ParticipationPanel room={room} user={user} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="開催情報" />
            <CardBody>
              <dl className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
                  {formatDateTime(room.heldAt)}
                </div>
                {room.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                    {room.location}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" aria-hidden />
                  参加 {room.participantCount}
                  {room.capacity ? ` / ${room.capacity}` : ''} 名
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
                      to="/rooms/$roomId/matches"
                      params={{ roomId: room.id }}
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
                  <GenerateMatchesButton room={room} alreadyGenerated={generated} />
                ) : null}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`参加者 (${room.participantCount})`}
              description={organizer ? '代理登録・ゲスト追加・削除ができます' : undefined}
            />
            <CardBody>
              {organizer && !closed ? (
                <ParticipantManager
                  roomId={room.id}
                  shareCode={room.shareCode}
                  participants={room.participants}
                  names={names}
                  generated={generated}
                />
              ) : (
                <ParticipantList participants={room.participants} names={names} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
