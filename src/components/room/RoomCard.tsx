import { Link } from '@tanstack/react-router'
import { Calendar, MapPin, Users } from 'lucide-react'
import type { Room } from '../../lib/types'
import { formatDateTime, roomStatusLabel } from '../../lib/format'
import { Badge, statusTone } from '../ui/Badge'

export function RoomCard({ room }: { room: Room }) {
  return (
    <Link
      to="/rooms/$roomId/matches"
      params={{ roomId: room.id }}
      search={{ openExternalBrowser: 1 }}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow"
    >
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
    </Link>
  )
}
