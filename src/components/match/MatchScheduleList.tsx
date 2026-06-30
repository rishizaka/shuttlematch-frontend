import type { Match } from '../../lib/types'
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

export function MatchScheduleList({
  matches,
  nameByParticipantId,
  highlightParticipantId,
}: {
  matches: Match[]
  nameByParticipantId: ReadonlyMap<string, string>
  /** この ParticipantId が出場する試合を強調する。 */
  highlightParticipantId?: string | null
}) {
  if (matches.length === 0) {
    return <p className="py-6 text-sm text-slate-500">表示できる試合がありません。</p>
  }

  const isHighlighted = (m: Match) =>
    !!highlightParticipantId &&
    (m.pairA.player1Id === highlightParticipantId ||
      m.pairA.player2Id === highlightParticipantId ||
      m.pairB.player1Id === highlightParticipantId ||
      m.pairB.player2Id === highlightParticipantId)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m) => (
        <MatchCard
          key={m.matchNumber}
          match={m}
          nameByParticipantId={nameByParticipantId}
          highlight={isHighlighted(m)}
        />
      ))}
    </div>
  )
}
