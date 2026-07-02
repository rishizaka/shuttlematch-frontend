import { useState } from 'react'
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

  // セットの開始時刻は同一セット共通。任意の1試合から拾う。
  const startedAt = group.matches.find((m) => m.startedAt)?.startedAt ?? null
  const startedTime = startedAt ? formatTime(startedAt) : null
  const finished = !!startedAt && !active
  const canStart = isOrganizer && !!onStart && startable && !startedAt
  const canRevert = isOrganizer && !!onRevert && active

  const isHighlighted = (m: Match) =>
    !!highlightParticipantId &&
    (m.pairA.player1Id === highlightParticipantId ||
      m.pairA.player2Id === highlightParticipantId ||
      m.pairB.player1Id === highlightParticipantId ||
      m.pairB.player2Id === highlightParticipantId)

  const headerBadge = active
    ? 'border-emerald-500'
    : finished
      ? 'border-slate-200'
      : 'border-slate-200'

  return (
    <section className={'rounded-2xl border-l-4 bg-slate-50/60 p-4 ' + headerBadge}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">第 {group.setNumber} セット</h2>
          {startedTime ? (
            <span className="text-xs font-medium text-slate-500">{startedTime}〜</span>
          ) : null}
          {active ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              進行中
            </span>
          ) : null}
          {finished ? (
            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
              終了
            </span>
          ) : null}
        </div>

        {canStart ? (
          <div className="w-full sm:ml-auto sm:w-auto">
            {/* 開始はワンタップ。 */}
            <button
              type="button"
              disabled={starting}
              onClick={() => onStart?.()}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto sm:py-1.5"
            >
              {starting ? '開始中…' : `第 ${group.setNumber} セットを開始`}
            </button>
          </div>
        ) : canRevert ? (
          <div className="w-full sm:ml-auto sm:w-auto">
            {confirmingRevert ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-xs font-medium text-slate-600 sm:mr-0">
                  第 {group.setNumber} セットを開始前に戻しますか？
                </span>
                <button
                  type="button"
                  disabled={reverting}
                  onClick={() => {
                    onRevert?.()
                    setConfirmingRevert(false)
                  }}
                  className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  はい
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRevert(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  いいえ
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRevert(true)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto sm:py-1.5"
              >
                開始前に戻す
              </button>
            )}
          </div>
        ) : null}
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
    <div className="space-y-4">
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
