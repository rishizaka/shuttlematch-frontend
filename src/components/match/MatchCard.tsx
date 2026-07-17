import type { Match } from '../../lib/types'

/**
 * 参加者番号のチップ。試合表は番号だけで運用するため、名前は表示しない。
 * 自分(self)だけ濃い色で強調して、自分の試合を見つけやすくする。
 */
function PlayerChip({
  index,
  self,
  finished,
  dense,
}: {
  index: number | undefined
  self: boolean
  finished: boolean
  dense: boolean
}) {
  // 自分は深緑の塗りで示す(進行中の emerald-600 より一段濃い色)。
  // 他の参加者は白地+枠線でシンプルに番号だけを見せる。
  const chip = self
    ? 'bg-emerald-900 text-white'
    : finished
      ? 'border border-slate-200 bg-white text-slate-400'
      : 'border border-slate-300 bg-white text-slate-700 shadow-sm'
  return (
    <span
      aria-label={index != null ? `${index}番` : undefined}
      className={
        'flex select-none items-center justify-center rounded-full font-semibold tabular-nums ' +
        (dense ? 'h-7 w-7 text-xs ' : 'h-8 w-8 text-sm ') +
        chip
      }
    >
      {index ?? '?'}
    </span>
  )
}

/**
 * 1コート分を1行で表示する。コート番号のタグ + 出場者4名の番号チップ。
 * ペアは現地で相談して決めるため、4名をフラットに並べる(vsは出さない)。
 * 進行中/終了の状態はセット単位で決まるため親から受け取る。
 * dense はコンパクト表示: 枠なし・小さめチップで1行の高さを最小化する。
 */
export function MatchCard({
  match,
  indexByParticipantId,
  highlightParticipantId = null,
  active = false,
  finished = false,
  dense = false,
}: {
  match: Match
  /** ParticipantId -> 参加者番号(1始まり)。 */
  indexByParticipantId?: ReadonlyMap<string, number>
  /** この ParticipantId のチップと行を強調表示する(自分)。 */
  highlightParticipantId?: string | null
  /** このコートが属するセットが進行中。 */
  active?: boolean
  /** このコートが属するセットが終了済み。 */
  finished?: boolean
  /** コンパクト表示(枠なし・高密度)。 */
  dense?: boolean
}) {
  const players = [
    match.pairA.player1Id,
    match.pairA.player2Id,
    match.pairB.player1Id,
    match.pairB.player2Id,
  ]
  const isSelf = (id: string) => !!highlightParticipantId && id === highlightParticipantId
  const highlight = players.some(isSelf)

  // 自分の表示は番号チップと「あなた」バッジのみで示し、行の枠線は状態(進行中/終了)だけで決める。
  const container = active
    ? 'border-emerald-200 bg-white'
    : finished
      ? 'border-slate-100 bg-white'
      : 'border-slate-200 bg-white'

  const courtChip = active
    ? 'bg-emerald-600 text-white'
    : finished
      ? 'bg-slate-50 text-slate-400'
      : 'bg-slate-200/80 text-slate-600'

  const chips = (
    <span
      className={
        'flex items-center ' + (dense ? 'gap-1.5' : 'gap-1.5') + (finished ? ' opacity-60' : '')
      }
    >
      {players.map((id, i) => (
        <PlayerChip
          key={`${id}-${i}`}
          index={indexByParticipantId?.get(id)}
          self={isSelf(id)}
          finished={finished}
          dense={dense}
        />
      ))}
    </span>
  )

  // コンパクト表示では行を詰めるため「あなた」バッジは出さず、深緑チップのみで示す。
  const youBadge =
    highlight && !dense ? (
      <span className="ml-auto inline-flex shrink-0 items-center rounded-full bg-emerald-900 px-2 py-0.5 text-xs font-semibold text-white">
        あなた
      </span>
    ) : null

  // コンパクト表示: 枠なしの1行。コートは「1コ」の短縮ラベルで最小幅にする。
  if (dense) {
    const denseCourt = active
      ? 'text-emerald-700'
      : finished
        ? 'text-slate-300'
        : 'text-slate-500'
    return (
      <div className="flex items-center gap-2">
        {match.courtNumber != null ? (
          <span
            className={
              'w-7 shrink-0 select-none text-[10px] font-bold ' + denseCourt
            }
          >
            <span className="text-sm tabular-nums">{match.courtNumber}</span>コ
          </span>
        ) : null}
        {chips}
        {youBadge}
      </div>
    )
  }

  return (
    <div className={'flex items-center gap-2.5 rounded-xl border px-3 py-2 ' + container}>
      {/* 参加者番号の丸チップと見分けがつくよう、コートは文字入りの角型タグにする。 */}
      {match.courtNumber != null ? (
        <span
          className={
            'inline-flex shrink-0 select-none items-center rounded-md px-1.5 py-1 text-xs font-semibold ' +
            courtChip
          }
        >
          {match.courtNumber}
          <span className="text-[10px] font-medium">コート</span>
        </span>
      ) : null}
      {chips}
      {youBadge}
    </div>
  )
}
