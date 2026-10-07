import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { Match } from '../../lib/types'
import { FREE_SLOT } from '../../lib/guests'

/**
 * 参加者番号のチップ。試合表は番号で運用する。名前(ニックネーム)が付いている場合は
 * 番号をタップするとツールチップで名前を表示する。自分(self)はゴールドで強調。
 *
 * 運営者が「フリー」にした枠はティールで塗り、数字の下に小さく「フリー」と添える
 * (タップしないと分からないのを解消するため)。色だけだと初見の人に意味が伝わらず、
 * 文字だけだと列の高さが不揃いになるので、両方を組み合わせている。
 */
function PlayerChip({
  index,
  name,
  self,
  finished,
  appearDelay = null,
}: {
  index: number | undefined
  /** 付いていればタップで表示する名前。無ければ番号のみの非インタラクティブなチップ。 */
  name?: string
  self: boolean
  finished: boolean
  /** 進行中セットで順番に飛び出させるときの遅延(ms)。null なら動かさない。 */
  appearDelay?: number | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // 開いている間は「外側タップ」でも「一定時間後」でも閉じる。
  // onBlur だけだとモバイルでは他の場所をタップしても閉じず、同じ番号を
  // もう一度タップしないと消えなかった。
  useEffect(() => {
    if (!open) return
    const closeOnOutside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    // 開いたその瞬間のタップで閉じないよう、次の tick で登録する。
    const register = setTimeout(() => document.addEventListener('pointerdown', closeOnOutside), 0)
    const autoClose = setTimeout(() => setOpen(false), 2500)
    return () => {
      clearTimeout(register)
      clearTimeout(autoClose)
      document.removeEventListener('pointerdown', closeOnOutside)
    }
  }, [open])

  const free = name === FREE_SLOT

  // 自分はロゴのゴールドの塗り+濃紺文字。フリーはティール(在席のまま「今は誰も
  // いない」ことを示す、自分/通常/終了済みのどれとも被らない色)。他は白地+枠線。
  const chip = self
    ? 'bg-accent-500 text-brand-900'
    : free
      ? finished
        ? 'border border-teal-100 bg-teal-50/60 text-teal-300'
        : 'border border-teal-300 bg-teal-50 text-teal-700'
      : finished
        ? 'border border-slate-200 bg-white text-slate-400'
        : 'border border-slate-300 bg-white text-slate-700 shadow-sm'
  const appearing = appearDelay != null
  const base =
    'flex h-7 w-7 select-none items-center justify-center rounded-full text-xs font-semibold tabular-nums ' +
    (appearing ? 'animate-chip-in ' : '') +
    // 進行中セットの自分の番号は、光の輪を出し続けて「いま自分の番」を知らせる。
    (appearing && self ? 'ring-anim ' : '')
  const appearStyle = appearing
    ? ({ '--chip-delay': `${appearDelay}ms` } as React.CSSProperties)
    : undefined

  // フリーは色とラベルで既に示せているので、タップの名前ツールチップ(「フリー」を
  // もう一度表示するだけ)は出さない。ラベルぶん縦に伸びるのはこの枠だけ。
  if (free) {
    return (
      <span className="flex flex-col items-center gap-0.5">
        <span
          aria-label={index != null ? `${index}番 フリー` : 'フリー'}
          className={base + chip}
          style={appearStyle}
        >
          {index ?? '?'}
        </span>
        <span
          aria-hidden
          className={
            'text-[8.5px] font-medium leading-none tracking-wide ' +
            (finished ? 'text-teal-200' : 'text-teal-500')
          }
        >
          フリー
        </span>
      </span>
    )
  }

  // 名前が無ければ従来どおり非インタラクティブなチップ。
  if (!name) {
    return (
      <span
        aria-label={index != null ? `${index}番` : undefined}
        className={base + chip}
        style={appearStyle}
      >
        {index ?? '?'}
      </span>
    )
  }

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={index != null ? `${index}番 ${name}` : name}
        onClick={() => setOpen((v) => !v)}
        className={base + chip}
        style={appearStyle}
      >
        {index ?? '?'}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="animate-pop-up absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-white shadow-lg"
        >
          {name}
        </span>
      ) : null}
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
  nameByParticipantId,
  highlightParticipantId = null,
  active = false,
  finished = false,
}: {
  match: Match
  /** ParticipantId -> 参加者番号(1始まり)。 */
  indexByParticipantId?: ReadonlyMap<string, number>
  /** ParticipantId -> 名前(あれば番号タップで表示)。 */
  nameByParticipantId?: ReadonlyMap<string, string>
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
  // フリーの枠は下にラベルが付いて縦に伸びるため、行はどちらも上揃え(items-start)にする。
  // コート番号側は h-7(チップと同じ28px)で高さを固定し、その中で中央揃えにすることで、
  // フリーのラベル分だけ行が伸びても「1コ」の位置が引きずられないようにしている。
  return (
    <div className="flex items-start gap-2">
      {match.courtNumber != null ? (
        <span
          className={
            'flex h-7 w-7 shrink-0 select-none items-center text-[10px] font-bold ' + courtColor
          }
        >
          <span className="text-sm tabular-nums">{match.courtNumber}</span>コ
        </span>
      ) : null}
      <span className={'flex items-start gap-1.5' + (finished ? ' opacity-60' : '')}>
        {players.map((id, i) => (
          <PlayerChip
            key={`${id}-${i}`}
            index={indexByParticipantId?.get(id)}
            name={nameByParticipantId?.get(id)}
            self={isSelf(id)}
            finished={finished}
            appearDelay={active ? ((match.courtNumber ?? 1) - 1) * 160 + i * 45 : null}
          />
        ))}
      </span>
    </div>
  )
}
