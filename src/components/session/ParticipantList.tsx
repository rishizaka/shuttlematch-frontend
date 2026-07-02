import { Trash2 } from 'lucide-react'
import type { Participant } from '../../lib/types'
import { participantDisplayName } from '../../lib/format'
import { Badge } from '../ui/Badge'

export function ParticipantList({
  participants,
  names,
  onRemove,
  removingId,
}: {
  participants: Participant[]
  names?: ReadonlyMap<string, string>
  /** 指定すると各行に削除ボタンを表示する (オーガナイザー用)。 */
  onRemove?: (participant: Participant) => void
  removingId?: string | null
}) {
  if (participants.length === 0) {
    return <p className="py-4 text-sm text-slate-500">まだ参加者がいません。</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {participants.map((p, i) => (
        <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-slate-800">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums"
              aria-hidden
            >
              {i + 1}
            </span>
            {participantDisplayName(p, names)}
            {p.guest ? <Badge tone="amber">ゲスト</Badge> : null}
          </span>
          {onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(p)}
              disabled={removingId === p.id}
              aria-label={`${participantDisplayName(p, names)} を削除`}
              className="text-slate-400 transition hover:text-red-600 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
