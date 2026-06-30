import type { Match, Participant } from '../../lib/types'
import { participantDisplayName } from '../../lib/format'

/**
 * ParticipantId -> 表示名 のルックアップを作る。
 * 試合のペアは ParticipantId を参照するため、セッションの参加者一覧と
 * userId -> 名前 のマップから解決する。
 */
export function buildParticipantNameLookup(
  participants: Participant[],
  userNames: ReadonlyMap<string, string>,
): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const p of participants) {
    lookup.set(p.id, participantDisplayName(p, userNames))
  }
  return lookup
}

function PairView({
  player1Id,
  player2Id,
  nameByParticipantId,
}: {
  player1Id: string
  player2Id: string
  nameByParticipantId: ReadonlyMap<string, string>
}) {
  const name = (id: string) => nameByParticipantId.get(id) ?? id.slice(0, 8)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-medium text-slate-900">{name(player1Id)}</span>
      <span className="font-medium text-slate-900">{name(player2Id)}</span>
    </div>
  )
}

export function MatchCard({
  match,
  nameByParticipantId,
  highlight = false,
}: {
  match: Match
  nameByParticipantId: ReadonlyMap<string, string>
  /** 自分が出場する試合を強調表示する。 */
  highlight?: boolean
}) {
  return (
    <div
      className={
        'rounded-xl border bg-white p-4 shadow-sm ' +
        (highlight ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200')
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">第 {match.matchNumber} 試合</span>
        {match.courtNumber != null ? (
          <span className="text-xs text-slate-400">コート {match.courtNumber}</span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <PairView
          player1Id={match.pairA.player1Id}
          player2Id={match.pairA.player2Id}
          nameByParticipantId={nameByParticipantId}
        />
        <span className="text-sm font-bold text-emerald-600">VS</span>
        <PairView
          player1Id={match.pairB.player1Id}
          player2Id={match.pairB.player2Id}
          nameByParticipantId={nameByParticipantId}
        />
      </div>
    </div>
  )
}
