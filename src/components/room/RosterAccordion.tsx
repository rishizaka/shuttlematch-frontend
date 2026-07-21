import { useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import type { Participant } from '../../lib/types'

/**
 * 参加者名簿(番号→名前)のアコーディオン。
 * 受付モードのように名前が付いているときだけ表示し、番号運用(名前=番号)のときは出さない。
 * 番号だけの試合表で「誰が何番か」を確認するための一覧。
 */
export function RosterAccordion({
  participants,
  selfParticipantId,
}: {
  participants: Participant[]
  selfParticipantId?: string | null
}) {
  const [open, setOpen] = useState(false)

  // 番号(並び順)は参加者一覧の順。名前が実質的に付いている(数字だけでない)人がいるときのみ表示。
  const hasRealNames = participants.some(
    (p) => p.guestName != null && !/^\d+$/.test(p.guestName.trim()),
  )
  if (!hasRealNames) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <Users className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-800">
          参加者名簿（番号→名前）
        </span>
        <span className="text-xs text-slate-400">{participants.length}人</span>
        <ChevronDown
          className={
            'ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ' +
            (open ? 'rotate-180' : '')
          }
        />
      </button>
      {open ? (
        <ul className="grid grid-cols-2 gap-x-4 border-t border-slate-100 px-4 py-3 sm:grid-cols-3">
          {participants.map((p, i) => {
            const left = p.status === 'LEFT'
            const self = p.id === selfParticipantId
            return (
              <li key={p.id} className="flex items-center gap-2 py-1 text-sm">
                <span
                  className={
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ' +
                    (self ? 'bg-accent-500 text-brand-900' : 'bg-slate-100 text-slate-600')
                  }
                >
                  {i + 1}
                </span>
                <span
                  className={
                    'truncate ' + (left ? 'text-slate-400 line-through' : 'text-slate-800')
                  }
                >
                  {p.guestName}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
