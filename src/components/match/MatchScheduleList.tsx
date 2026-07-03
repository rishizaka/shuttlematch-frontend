import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Play, RotateCcw } from 'lucide-react'
import type { Match } from '../../lib/types'
import { formatTime } from '../../lib/format'
import { MatchCard } from './MatchCard'

/** 指定 ParticipantId が出場する試合だけに絞り込む。 */
export function filterMatchesForParticipant(
  matches: Match[],
  participantId: string | null,
): Match[] {
  if (!participantId) return matches
  return matches.filter(
    (m) =>
      m.pairA.player1Id === participantId ||
      m.pairA.player2Id === participantId ||
      m.pairB.player1Id === participantId ||
      m.pairB.player2Id === participantId,
  )
}

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

function SetGroupView({
  group,
  nameByParticipantId,
  indexByParticipantId,
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
  nameByParticipantId: ReadonlyMap<string, string>
  indexByParticipantId?: ReadonlyMap<string, number>
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
  // 終了セットは手動でのみ折りたためる。次のセット開始時に自動で畳まれると
  // びっくりするため、既定は展開のまま(折りたたみは任意)。
  const [expanded, setExpanded] = useState(true)

  // セットの開始時刻は同一セット共通。任意の1試合から拾う。
  const startedAt = group.matches.find((m) => m.startedAt)?.startedAt ?? null
  const startedTime = startedAt ? formatTime(startedAt) : null
  const finished = !!startedAt && !active
  const canStart = isOrganizer && !!onStart && startable && !startedAt
  const canRevert = isOrganizer && !!onRevert && active
  // まだ開始できない未来のセット。
  const upcoming = !startedAt && !canStart

  const isHighlighted = (m: Match) =>
    !!highlightParticipantId &&
    (m.pairA.player1Id === highlightParticipantId ||
      m.pairA.player2Id === highlightParticipantId ||
      m.pairB.player1Id === highlightParticipantId ||
      m.pairB.player2Id === highlightParticipantId)

  const hasMyMatch = group.matches.some(isHighlighted)

  // 終了セットは1行のサマリーに畳む。
  if (finished && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
          <Check className="h-3 w-3 text-slate-400" />
        </span>
        <span className="text-sm font-semibold text-slate-500">
          第 {group.setNumber} セット
        </span>
        {startedTime ? (
          <span className="text-xs text-slate-400 tabular-nums">{startedTime}〜</span>
        ) : null}
        {hasMyMatch ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
            出場
          </span>
        ) : null}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
      </button>
    )
  }

  const container = active
    ? 'rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 p-4 shadow-sm shadow-emerald-100'
    : finished
      ? 'rounded-2xl border border-slate-200 bg-white p-4'
      : canStart
        ? 'rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm'
        : 'rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4'

  return (
    <section className={container}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {active ? (
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        ) : null}
        <h2
          className={
            'text-base font-bold ' +
            (finished ? 'text-slate-500' : upcoming ? 'text-slate-600' : 'text-slate-900')
          }
        >
          第 {group.setNumber} セット
        </h2>
        {startedTime ? (
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {startedTime}〜
          </span>
        ) : null}
        {active ? (
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
            進行中
          </span>
        ) : null}
        {finished ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
            終了
          </span>
        ) : null}
        {upcoming && !canStart ? (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-400">
            待機中
          </span>
        ) : null}

        <span className="ml-auto flex items-center gap-1.5">
          {canRevert ? (
            confirmingRevert ? (
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-600">
                  開始前に戻しますか？
                </span>
                <button
                  type="button"
                  disabled={reverting}
                  onClick={() => {
                    onRevert?.()
                    setConfirmingRevert(false)
                  }}
                  className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  はい
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRevert(false)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white"
                >
                  いいえ
                </button>
              </span>
            ) : (
              // 誤操作を避けたい補助操作なので、あえて控えめな見た目にする。
              <button
                type="button"
                onClick={() => setConfirmingRevert(true)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-white hover:text-slate-600"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                戻す
              </button>
            )
          ) : null}
          {finished ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="たたむ"
              className="inline-flex items-center rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          ) : null}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.matches.map((m) => (
          <MatchCard
            key={m.matchNumber}
            match={m}
            nameByParticipantId={nameByParticipantId}
            indexByParticipantId={indexByParticipantId}
            highlight={isHighlighted(m)}
            active={active}
            finished={finished}
          />
        ))}
      </div>

      {canStart ? (
        <div className="mt-3 sm:flex sm:justify-end">
          <button
            type="button"
            disabled={starting}
            onClick={() => onStart?.()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 sm:w-auto sm:px-6"
          >
            <Play className="h-4 w-4 fill-current" />
            {starting ? '開始中…' : `第 ${group.setNumber} セットを開始`}
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function MatchScheduleList({
  matches,
  nameByParticipantId,
  indexByParticipantId,
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
  nameByParticipantId: ReadonlyMap<string, string>
  /** ParticipantId -> 参加者番号(1始まり)。 */
  indexByParticipantId?: ReadonlyMap<string, number>
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
    <div className="space-y-3">
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
