import type { Match } from '../../lib/types'

/**
 * 参加者番号のチップ。試合表は番号だけで運用するため、名前は表示しない。
 * 自分(self)だけロゴのゴールドで強調して、自分の試合を見つけやすくする。
 */
function PlayerChip({
  index,
  self,
  finished,
}: {
  index: number | undefined
  self: boolean
  finished: boolean
}) {
  // 自分はロゴのゴールドの塗り+濃紺文字で示す。他は白地+枠線でシンプルに番号だけ。
  const chip = self
    ? 'bg-accent-500 text-brand-900'
    : finished
      ? 'border border-slate-200 bg-white text-slate-400'
      : 'border border-slate-300 bg-white text-slate-700 shadow-sm'
  return (
    <span
      aria-label={index != null ? `${index}番` : undefined}
      className={
        'flex h-7 w-7 select-none items-center justify-center rounded-full text-xs font-semibold tabular-nums ' +
        chip
      }
    >
      {index ?? '?'}
    </span>
  )
}

/**
 * 1コート分を1行(コンパクト表示)で表示する。コート番号の短縮ラベル + 出場者4名の番号チップ。
 * ペアは現地で相談して決めるため、4名をフラットに並べる(vsは出さない)。
 * 進行中/終了の状態はセット単位で決まるため親から受け取る。
 */
export function MatchCard({
  match,
  indexByParticipantId,
  highlightParticipantId = null,
  active = false,
  finished = false,
}: {
  match: Match
  /** ParticipantId -> 参加者番号(1始まり)。 */
  indexByParticipantId?: ReadonlyMap<string, number>
  /** この ParticipantId のチップを強調表示する(自分)。 */
  highlightParticipantId?: string | null
  /** このコートが属するセットが進行中。 */
  active?: boolean
  /** このコートが属するセットが終了済み。 */
  finished?: boolean
}) {
  const players = [
    match.pairA.player1Id,
    match.pairA.player2Id,
    match.pairB.player1Id,
    match.pairB.player2Id,
  ]
  const isSelf = (id: string) => !!highlightParticipantId && id === highlightParticipantId

  const courtColor = active
    ? 'text-brand-700'
    : finished
      ? 'text-slate-300'
      : 'text-slate-500'

  // 枠なしの1行。コートは「1コ」の短縮ラベルで最小幅にする。
  return (
    <div className="flex items-center gap-2">
      {match.courtNumber != null ? (
        <span className={'w-7 shrink-0 select-none text-[10px] font-bold ' + courtColor}>
          <span className="text-sm tabular-nums">{match.courtNumber}</span>コ
        </span>
      ) : null}
      <span className={'flex items-center gap-1.5' + (finished ? ' opacity-60' : '')}>
        {players.map((id, i) => (
          <PlayerChip
            key={`${id}-${i}`}
            index={indexByParticipantId?.get(id)}
            self={isSelf(id)}
            finished={finished}
          />
        ))}
      </span>
    </div>
  )
}
