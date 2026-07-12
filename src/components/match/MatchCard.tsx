import { useEffect, useRef, useState } from 'react'
import type { Match, Participant } from '../../lib/types'
import { participantDisplayNameForList } from '../../lib/format'

/**
 * ParticipantId -> 表示名 のルックアップを作る。
 * 試合のペアは ParticipantId を参照するため、ルームの参加者一覧と
 * userId -> 名前 のマップから解決する。
 * まだ自己申告していないゲスト(名前が番号のまま)は「ゲスト」と表示する
 * (番号バッジと同じ数字が並んで見えるのを避けるため)。
 */
export function buildParticipantNameLookup(
  participants: Participant[],
  userNames: ReadonlyMap<string, string>,
): Map<string, string> {
  const lookup = new Map<string, string>()
  participants.forEach((p) => {
    lookup.set(p.id, participantDisplayNameForList(p, userNames))
  })
  return lookup
}

/**
 * 参加者番号のチップ。タップ(またはホバー)でニックネームをツールチップ表示する。
 * スマホのワンビューに収めるため、行内は番号のみ・名前はオンデマンドにする。
 */
function PlayerChip({
  name,
  index,
  self,
  finished,
  dense,
  open,
  onToggle,
}: {
  name: string
  index: number | undefined
  self: boolean
  finished: boolean
  dense: boolean
  open: boolean
  onToggle: () => void
}) {
  // 自分は深緑の塗りで示す(進行中の emerald-600 より一段濃い色)。
  // 他の参加者は白地+枠線+影の「ボタン風」にして、タップでツールチップが出ることを示唆する。
  const chip = self
    ? 'bg-emerald-900 text-white'
    : finished
      ? 'border border-slate-200 bg-white text-slate-400'
      : 'border border-slate-300 bg-white text-slate-700 shadow-sm'
  return (
    <span className="group relative">
      <button
        type="button"
        aria-label={name}
        onClick={onToggle}
        className={
          'flex select-none items-center justify-center rounded-full font-semibold tabular-nums transition active:scale-95 ' +
          (dense ? 'h-7 w-7 text-xs ' : 'h-8 w-8 text-sm ') +
          chip
        }
      >
        {index ?? '?'}
      </button>
      <span
        role="tooltip"
        className={
          'pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg transition-opacity group-hover:opacity-100 ' +
          (open ? 'opacity-100' : 'opacity-0')
        }
      >
        {name}
      </span>
    </span>
  )
}

/** ツールチップをタップで開いたあと自動で閉じるまでの時間 (ms)。 */
const TOOLTIP_AUTO_HIDE_MS = 2000

/**
 * 1コート分を1行で表示する。コート番号のタグ + 出場者4名の番号チップ。
 * ペアは現地で相談して決めるため、4名をフラットに並べる(vsは出さない)。
 * 進行中/終了の状態はセット単位で決まるため親から受け取る。
 * dense はコンパクト表示: 枠なし・小さめチップで1行の高さを最小化する。
 */
export function MatchCard({
  match,
  nameByParticipantId,
  indexByParticipantId,
  highlightParticipantId = null,
  active = false,
  finished = false,
  dense = false,
}: {
  match: Match
  nameByParticipantId: ReadonlyMap<string, string>
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
  // タップで開いているツールチップの位置 (行内の何番目か)。一定時間で自動的に閉じる。
  const [openSlot, setOpenSlot] = useState<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    [],
  )
  const toggleTooltip = (slot: number) => {
    setOpenSlot((cur) => (cur === slot ? null : slot))
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setOpenSlot(null), TOOLTIP_AUTO_HIDE_MS)
  }

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
          name={nameByParticipantId.get(id) ?? id.slice(0, 8)}
          index={indexByParticipantId?.get(id)}
          self={isSelf(id)}
          finished={finished}
          dense={dense}
          open={openSlot === i}
          onToggle={() => toggleTooltip(i)}
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
