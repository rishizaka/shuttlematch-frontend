import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Calendar, MapPin, Users } from 'lucide-react'
import { useAddParticipant, useRoom } from '../hooks/queries'
import { setSelfParticipant } from '../lib/local-store'
import { formatDateTime } from '../lib/format'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'

export const Route = createFileRoute('/join/$roomId')({ component: JoinPage })

/**
 * 招待リンク用の公開参加ページ。ログイン不要で「参加する」を押すと
 * 参加番号(参加順)が割り当てられ、ゲストとしてルームに参加できる。
 * 名前(ニックネーム)は扱わず、番号だけで運用する。
 */
function JoinPage() {
  const { roomId } = Route.useParams()
  const { data: room, isLoading, isError } = useRoom(roomId)
  const add = useAddParticipant(roomId)
  const [joinedNumber, setJoinedNumber] = useState<number | null>(null)

  const join = () => {
    if (!room) return
    // 追加前の参加者 ID を控えておき、レスポンスで増えた ID を自分とみなす
    // (並び順に依存せず、自分の participant を確実に特定するため)。
    const before = new Set(room.participants.map((p) => p.id))
    // 番号運用: 次の空き番号(現在の人数+1)を仮名として連番の数字で追加する。
    add.mutate(
      { guestName: String(room.participants.length + 1) },
      {
        onSuccess: (updated) => {
          const meIndex = updated.participants.findIndex((p) => !before.has(p.id))
          if (meIndex >= 0) {
            // 試合表で自分の試合が強調されるよう、割り当て番号をローカル保存する。
            setSelfParticipant(roomId, updated.participants[meIndex].id)
            setJoinedNumber(meIndex + 1)
          } else {
            setJoinedNumber(updated.participants.length)
          }
        },
      },
    )
  }

  if (isLoading) return <LoadingBlock />
  if (isError || !room) {
    return <ErrorBlock message="ルームが見つかりません。招待リンクを確認してください。" />
  }

  const acceptsJoin = room.status === 'OPEN' || room.status === 'PREPARING'

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader title={room.title} />
        <CardBody className="space-y-5">
          {/* 開催情報を見せることで、名前入力を外してもページがスカスカにならないようにする。 */}
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

          {joinedNumber != null ? (
            <div className="space-y-3 rounded-2xl bg-emerald-50 py-6 text-center">
              <p className="text-sm text-emerald-700">あなたの番号は</p>
              <p className="text-5xl font-bold text-emerald-900 tabular-nums">
                {joinedNumber}
                <span className="ml-1 text-2xl font-semibold">番</span>
              </p>
              <p className="text-xs text-slate-500">試合表ではこの番号で表示されます</p>
              <Link
                to="/rooms/$roomId/matches"
                params={{ roomId }}
                search={{ openExternalBrowser: 1 }}
                className="inline-block text-sm font-medium text-emerald-600 hover:underline"
              >
                試合表を見る →
              </Link>
            </div>
          ) : !acceptsJoin ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              このルームは現在参加を受け付けていません。
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                ボタンを押すと参加番号が割り当てられます。名前の入力は不要です。
              </p>
              {add.isError ? (
                <p className="text-sm text-red-600">{(add.error as Error).message}</p>
              ) : null}
              <Button
                type="button"
                className="w-full"
                onClick={join}
                disabled={add.isPending}
              >
                {add.isPending ? '参加中…' : '参加する'}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
