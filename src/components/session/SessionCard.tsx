import { Link } from '@tanstack/react-router'
import { Calendar, Lock, MapPin, Users } from 'lucide-react'
import type { Session } from '../../lib/types'
import { formatDateTime, sessionStatusLabel } from '../../lib/format'
import { Badge, statusTone } from '../ui/Badge'

export function SessionCard({ session }: { session: Session }) {
  return (
    <Link
      to="/sessions/$sessionId"
      params={{ sessionId: session.id }}
      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{session.title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {session.visibility === 'MEMBERS_ONLY' ? (
            <Badge tone="amber">
              <Lock className="mr-0.5 inline h-3 w-3" aria-hidden />
              メンバー限定
            </Badge>
          ) : null}
          <Badge tone={statusTone(session.status)}>{sessionStatusLabel(session.status)}</Badge>
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
          <span>{formatDateTime(session.heldAt)}</span>
        </div>
        {session.location ? (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
            <span>{session.location}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" aria-hidden />
          <span>
            参加 {session.participantCount}
            {session.capacity ? ` / ${session.capacity}` : ''} 名
          </span>
        </div>
      </dl>
    </Link>
  )
}
