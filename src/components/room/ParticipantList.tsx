import { useState } from 'react'
import { Check, LogOut, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import type { Participant } from '../../lib/types'
import { isUnclaimedGuestName, participantDisplayName } from '../../lib/format'
import { Badge } from '../ui/Badge'

export function ParticipantList({
  participants,
  names,
  onRemove,
  removingId,
  onMarkLeft,
  onReactivate,
  updatingId,
  onRename,
}: {
  participants: Participant[]
  names?: ReadonlyMap<string, string>
  /** 指定すると各行に削除ボタンを表示する (オーガナイザー用・生成前)。 */
  onRemove?: (participant: Participant) => void
  removingId?: string | null
  /** 指定すると在席者に早退ボタンを表示する (オーガナイザー用・生成後)。 */
  onMarkLeft?: (participant: Participant) => void
  /** 指定すると早退者に復帰ボタンを表示する (オーガナイザー用)。 */
  onReactivate?: (participant: Participant) => void
  updatingId?: string | null
  /** 指定するとゲストの名前(ニックネーム)を編集できる (オーガナイザー用)。 */
  onRename?: (participant: Participant, name: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  if (participants.length === 0) {
    return <p className="py-4 text-sm text-slate-500">まだ参加者がいません。</p>
  }

  const startEdit = (p: Participant, unnamed: boolean) => {
    setEditingId(p.id)
    setDraft(unnamed ? '' : (p.guestName ?? ''))
  }
  const commit = (p: Participant) => {
    const name = draft.trim()
    if (name && name !== p.guestName) onRename?.(p, name)
    setEditingId(null)
  }

  return (
    <ul className="divide-y divide-slate-100">
      {participants.map((p, i) => {
        const left = p.status === 'LEFT'
        const editing = editingId === p.id
        // ゲストのみ名前編集可。
        const canRename = !!onRename && p.guest
        const unnamed = isUnclaimedGuestName(p, i)
        const displayName = unnamed ? 'ゲスト' : participantDisplayName(p, names)
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
              {editing ? (
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit(p)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    placeholder="ニックネーム"
                    className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-1 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => commit(p)}
                    aria-label="保存"
                    className="text-emerald-600 hover:text-emerald-700"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="キャンセル"
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <>
                  <span
                    className={
                      'truncate ' +
                      (left ? 'line-through ' : '') +
                      (unnamed ? 'text-slate-400' : '')
                    }
                  >
                    {displayName}
                  </span>
                  {canRename ? (
                    <button
                      type="button"
                      onClick={() => startEdit(p, unnamed)}
                      aria-label="名前を編集"
                      className="shrink-0 text-slate-400 transition hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {left ? <Badge tone="slate">早退</Badge> : null}
                </>
              )}
            </span>

            {editing ? null : (
              <span className="flex shrink-0 items-center gap-2">
                {onReactivate && left ? (
                  <button
                    type="button"
                    onClick={() => onReactivate(p)}
                    disabled={updatingId === p.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 transition hover:text-emerald-700 disabled:opacity-40"
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
                    aria-label={`${participantDisplayName(p, names)} を削除`}
                    className="text-slate-400 transition hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
