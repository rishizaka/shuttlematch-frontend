import { LogOut, RotateCcw, Trash2 } from 'lucide-react'
import type { Participant } from '../../lib/types'
import { Badge } from '../ui/Badge'

export function ParticipantList({
  participants,
  onRemove,
  removingId,
  onMarkLeft,
  onReactivate,
  updatingId,
}: {
  participants: Participant[]
  /** 指定すると各行に削除ボタンを表示する (オーガナイザー用・生成前)。 */
  onRemove?: (participant: Participant) => void
  removingId?: string | null
  /** 指定すると在席者に早退ボタンを表示する (オーガナイザー用・生成後)。 */
  onMarkLeft?: (participant: Participant) => void
  /** 指定すると早退者に復帰ボタンを表示する (オーガナイザー用)。 */
  onReactivate?: (participant: Participant) => void
  updatingId?: string | null
}) {
  if (participants.length === 0) {
    return <p className="py-4 text-sm text-slate-500">まだ参加者がいません。</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {participants.map((p, i) => {
        const left = p.status === 'LEFT'
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <span
              className={
                'flex min-w-0 flex-1 items-center gap-2 text-sm ' +
                (left ? 'text-slate-400' : 'text-slate-800')
              }
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums"
                aria-hidden
              >
                {i + 1}
              </span>
              {/* 受付モードなど名前が付いていれば名前を表示。番号運用(名前=番号)なら「ゲスト」。 */}
              <span className={'truncate ' + (left ? 'line-through' : '')}>
                {p.guestName && !/^\d+$/.test(p.guestName.trim()) ? p.guestName : 'ゲスト'}
              </span>
              {left ? <Badge tone="slate">早退</Badge> : null}
            </span>

            <span className="flex shrink-0 items-center gap-2">
              {onReactivate && left ? (
                <button
                  type="button"
                  onClick={() => onReactivate(p)}
                  disabled={updatingId === p.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  復帰
                </button>
              ) : null}
              {onMarkLeft && !left ? (
                <button
                  type="button"
                  onClick={() => onMarkLeft(p)}
                  disabled={updatingId === p.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  早退
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(p)}
                  disabled={removingId === p.id}
                  aria-label={`${i + 1}番 を削除`}
                  className="text-slate-400 transition hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
