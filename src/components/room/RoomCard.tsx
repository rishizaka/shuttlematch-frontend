import { Link } from '@tanstack/react-router'
import { Calendar, MapPin, Users } from 'lucide-react'
import type { PublicRoom } from '../../lib/types'
import { formatDateTime, roomStatusLabel } from '../../lib/format'
import { Badge, statusTone } from '../ui/Badge'

/**
 * 一覧に並ぶルームのカード。
 *
 * `roomId` が渡されたときだけ試合表へのリンクになる。一覧 API は roomId を返さないので、
 * リンクになるのは「作成した」「参加した」などで既にその roomId を知っている端末だけ
 * (照合は `lib/public-room-id.ts`)。知らないルームは、何が開催されているかは見えるが
 * 押せないカードとして並ぶ。中に入るには共有URL(`/r/{shareCode}`)が要る。
 */
export function RoomCard({ room, roomId }: { room: PublicRoom; roomId?: string | null }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{room.title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={statusTone(room.status)}>{roomStatusLabel(room.status)}</Badge>
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
          <span>{formatDateTime(room.heldAt)}</span>
        </div>
        {room.location ? (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
            <span>{room.location}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" aria-hidden />
          <span>
            参加 {room.participantCount}
            {room.capacity ? ` / ${room.capacity}` : ''} 名
          </span>
        </div>
      </dl>
    </>
  )

  // 押せないカードは背景を落として影を外す。リンクと同じ見た目だと、タップして
  // 反応しないのが不具合に見える(ホバーの無いモバイルでは特に分からない)。
  if (!roomId) {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">{body}</div>
  }

  return (
    <Link
      to="/rooms/$roomId/matches"
      params={{ roomId }}
      search={{ openExternalBrowser: 1 }}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
    >
      {body}
    </Link>
  )
}
