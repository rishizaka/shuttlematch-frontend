import { useState } from 'react'
import { Check, Play, RotateCcw } from 'lucide-react'
import type { Match } from '../../lib/types'
import { formatTime } from '../../lib/format'
import { MatchCard } from './MatchCard'

export interface SetGroup {
  setNumber: number
  /** コート番号昇順に並んだ、このセットの試合。 */
  matches: Match[]
}

/**
 * 試合をセット番号でまとめる。セット昇順・各セット内はコート番号昇順。
 * 同一セットの複数コートを1つの塊として扱うための前処理。
 */
export function groupMatchesBySet(matches: Match[]): SetGroup[] {
  const bySet = new Map<number, Match[]>()
  for (const m of matches) {
    const list = bySet.get(m.setNumber)
    if (list) list.push(m)
    else bySet.set(m.setNumber, [m])
  }
  return Array.from(bySet.entries())
    .sort(([a], [b]) => a - b)
    .map(([setNumber, ms]) => ({
      setNumber,
      matches: [...ms].sort((a, b) => (a.courtNumber ?? 0) - (b.courtNumber ?? 0)),
    }))
}

/**
 * 1セット分の表示(コンパクト固定)。カードをやめ、セットの区切りを
 * 「ラベル付き横線」にして密度を上げる。進行中セットだけ薄い帯で示す。
 * 次に開始できるセットは見出しごと点線の枠で囲み、開始ボタンがどのセットのものかを
 * はっきりさせる(帯の直下・右端にボタンがあると、進行中セットのボタンに見えやすかった)。
 * 行が低いので折りたたみは提供しない。
 */
function SetGroupView({
  group,
  indexByParticipantId,
  nameByParticipantId,
  highlightParticipantId,
  active,
  startable,
  isOrganizer,
  onStart,
  starting,
  onRevert,
  reverting,
}: {
  group: SetGroup
  indexByParticipantId?: ReadonlyMap<string, number>
  nameByParticipantId?: ReadonlyMap<string, string>
  highlightParticipantId?: string | null
  active: boolean
  startable: boolean
  isOrganizer: boolean
  onStart?: () => void
  starting: boolean
  onRevert?: () => void
  reverting: boolean
}) {
  // 「開始前に戻す」の確認状態。開始はワンタップなので確認しない。
  const [confirmingRevert, setConfirmingRevert] = useState(false)

  // セットの開始時刻は同一セット共通。任意の1試合から拾う。
  const startedAt = group.matches.find((m) => m.startedAt)?.startedAt ?? null
  const startedTime = startedAt ? formatTime(startedAt) : null
  const finished = !!startedAt && !active
  const canStart = isOrganizer && !!onStart && startable && !startedAt
  const canRevert = isOrganizer && !!onRevert && active
  // まだ開始できない未来のセット。
  const upcoming = !startedAt && !canStart

  return (
    <section
      className={
        canStart ? '-mx-2 rounded-lg border border-dashed border-brand-300 px-2 py-2' : undefined
      }
    >
      <div className="flex items-center gap-2">
        <span
          className={
            'flex shrink-0 items-center gap-1.5 text-xs font-bold ' +
            (finished
              ? 'text-slate-400'
              : active
                ? 'text-brand-700'
                : upcoming
                  ? 'text-slate-500'
                  : 'text-slate-700')
          }
        >
          {finished ? <Check className="h-3 w-3 text-slate-300" /> : null}
          {canStart ? (
            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
              次
            </span>
          ) : null}
          {active ? (
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            </span>
          ) : null}
          第{group.setNumber}セット
          {startedTime ? (
            <span className="text-[10px] font-medium text-slate-400 tabular-nums">
              {startedTime}〜
            </span>
          ) : null}
        </span>
        <span className={'h-px flex-1 ' + (active ? 'bg-brand-200' : 'bg-slate-200')} />
        {canStart ? (
          <button
            type="button"
            disabled={starting}
            onClick={() => onStart?.()}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-brand-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {starting ? '開始中…' : `第${group.setNumber}セット開始`}
          </button>
        ) : null}
        {canRevert ? (
          confirmingRevert ? (
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-[10px] font-medium text-slate-500">戻す？</span>
              <button
                type="button"
                disabled={reverting}
                onClick={() => {
                  onRevert?.()
                  setConfirmingRevert(false)
                }}
                className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                はい
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRevert(false)}
                className="rounded px-1 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100"
              >
                いいえ
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingRevert(true)}
              className="inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              戻す
            </button>
          )
        ) : null}
      </div>
      <div
        className={
          'mt-1.5 space-y-1' + (active ? ' -mx-2 rounded-lg bg-brand-50 px-2 py-1.5' : '')
        }
      >
        {group.matches.map((m) => (
          <MatchCard
            key={m.matchNumber}
            match={m}
            indexByParticipantId={indexByParticipantId}
            nameByParticipantId={nameByParticipantId}
            highlightParticipantId={highlightParticipantId}
            active={active}
            finished={finished}
          />
        ))}
      </div>
    </section>
  )
}

export function MatchScheduleList({
  matches,
  indexByParticipantId,
  nameByParticipantId,
  highlightParticipantId,
  activeSetNumber,
  startableSetNumber,
  isOrganizer = false,
  onStartSet,
  startingSetNumber,
  onRevertSet,
  revertingSetNumber,
}: {
  matches: Match[]
  /** ParticipantId -> 参加者番号(1始まり)。 */
  indexByParticipantId?: ReadonlyMap<string, number>
  /** ParticipantId -> 名前(あれば番号タップで表示)。 */
  nameByParticipantId?: ReadonlyMap<string, string>
  /** この ParticipantId が出場するコートを強調する。 */
  highlightParticipantId?: string | null
  /** 進行中(アクティブ)なセット番号。 */
  activeSetNumber?: number | null
  /** 次に開始できるセット番号(これ以外は開始不可)。 */
  startableSetNumber?: number | null
  /** 運営者操作を許可する。 */
  isOrganizer?: boolean
  /** セット開始ハンドラ。 */
  onStartSet?: (setNumber: number) => void
  /** 開始処理中のセット番号。 */
  startingSetNumber?: number | null
  /** 進行中セットを開始前に戻すハンドラ。 */
  onRevertSet?: (setNumber: number) => void
  /** 戻し処理中のセット番号。 */
  revertingSetNumber?: number | null
}) {
  if (matches.length === 0) {
    return <p className="py-6 text-sm text-slate-500">表示できる試合がありません。</p>
  }

  const groups = groupMatchesBySet(matches)

  return (
    <div className="space-y-3.5">
      {groups.map((group) => (
        <SetGroupView
          key={group.setNumber}
          group={group}
          nameByParticipantId={nameByParticipantId}
          indexByParticipantId={indexByParticipantId}
          highlightParticipantId={highlightParticipantId}
          active={activeSetNumber === group.setNumber}
          startable={startableSetNumber === group.setNumber}
          isOrganizer={isOrganizer}
          onStart={
            isOrganizer && onStartSet && group.setNumber === startableSetNumber
              ? () => onStartSet(group.setNumber)
              : undefined
          }
          starting={startingSetNumber === group.setNumber}
          onRevert={
            isOrganizer && onRevertSet && group.setNumber === activeSetNumber
              ? () => onRevertSet(group.setNumber)
              : undefined
          }
          reverting={revertingSetNumber === group.setNumber}
        />
      ))}
    </div>
  )
}
