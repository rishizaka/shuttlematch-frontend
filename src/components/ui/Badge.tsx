import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { RoomStatus } from '../../lib/types'

type Tone = 'slate' | 'emerald' | 'amber' | 'blue'

const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

const STATUS_TONE: Record<RoomStatus, Tone> = {
  PREPARING: 'slate',
  OPEN: 'emerald',
  GENERATED: 'blue',
  CLOSED: 'amber',
}

export function statusTone(status: RoomStatus): Tone {
  return STATUS_TONE[status] ?? 'slate'
}
