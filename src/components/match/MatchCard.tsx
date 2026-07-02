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

function PlayerView({
  id,
  nameByParticipantId,
  indexByParticipantId,
}: {
  id: string
  nameByParticipantId: ReadonlyMap<string, string>
  indexByParticipantId?: ReadonlyMap<string, number>
}) {
  const name = nameByParticipantId.get(id) ?? id.slice(0, 8)
  const index = indexByParticipantId?.get(id)
  return (
    <span className="flex items-center gap-2">
      {index != null ? (
        <span className="inline-flex h-5 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
          {index}
        </span>
      ) : null}
      <span className="truncate font-medium text-slate-900">{name}</span>
    </span>
  )
}

function PairView({
  player1Id,
  player2Id,
  nameByParticipantId,
  indexByParticipantId,
}: {
  player1Id: string
  player2Id: string
  nameByParticipantId: ReadonlyMap<string, string>
  indexByParticipantId?: ReadonlyMap<string, number>
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <PlayerView
        id={player1Id}
        nameByParticipantId={nameByParticipantId}
        indexByParticipantId={indexByParticipantId}
      />
      <PlayerView
        id={player2Id}
        nameByParticipantId={nameByParticipantId}
        indexByParticipantId={indexByParticipantId}
      />
    </div>
  )
}

/**
 * 1コート分の対戦カード。セット内の「◯コート」を1枚として表示する。
 * 進行中/終了の状態はセット単位で決まるため親から受け取る。
 */
export function MatchCard({
  match,
  nameByParticipantId,
  indexByParticipantId,
  highlight = false,
  active = false,
  finished = false,
}: {
  match: Match
  nameByParticipantId: ReadonlyMap<string, string>
  /** ParticipantId -> 参加者番号(1始まり)。 */
  indexByParticipantId?: ReadonlyMap<string, number>
  /** 自分が出場するコートを強調表示する。 */
  highlight?: boolean
  /** このコートが属するセットが進行中。 */
  active?: boolean
  /** このコートが属するセットが終了済み。 */
  finished?: boolean
}) {
  const container = active
    ? 'border-emerald-500 bg-white ring-2 ring-emerald-300'
    : finished
      ? 'border-slate-200 bg-slate-50'
      : highlight
        ? 'border-emerald-400 bg-white ring-1 ring-emerald-200'
        : 'border-slate-200 bg-white'

  return (
    <div className={'rounded-xl border p-4 shadow-sm ' + container}>
      {match.courtNumber != null ? (
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {match.courtNumber} コート
          </span>
          {highlight ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              あなた
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className={
          'grid grid-cols-[1fr_auto_1fr] items-center gap-3' + (finished ? ' opacity-50' : '')
        }
      >
        <PairView
          player1Id={match.pairA.player1Id}
          player2Id={match.pairA.player2Id}
          nameByParticipantId={nameByParticipantId}
          indexByParticipantId={indexByParticipantId}
        />
        <span className="text-sm font-bold text-emerald-600">VS</span>
        <PairView
          player1Id={match.pairB.player1Id}
          player2Id={match.pairB.player2Id}
          nameByParticipantId={nameByParticipantId}
          indexByParticipantId={indexByParticipantId}
        />
      </div>
    </div>
  )
}
