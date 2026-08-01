import type { RankingEntry } from '../../lib/types'
import { RANKING_SIZE } from '../../lib/ranking'

/** 順位の表記。アーケードのハイスコア表に合わせて 1ST / 2ND … と出す。 */
const ORDINAL = ['1ST', '2ND', '3RD', '4TH', '5TH']

/** 順位ごとの蛍光色。1〜3位は金・銀・銅、それ以下は水色で揃える。 */
const RANK_COLOR: Record<number, string> = {
  1: 'text-[#ffd24a]',
  2: 'text-[#dfe9ff]',
  3: 'text-[#ff9d4a]',
}
const DEFAULT_COLOR = 'text-[#7de3ff]'

/**
 * ランキング表(上位5件)。レトロなアーケードのハイスコア表を模した見た目で、
 * 記録が5件に満たないうちは空席を出して「入れそう」と分かるようにする。
 *
 * 背景は {@link ArcadeScreen} 側が持つので、ここは行だけを描く。
 */
export function RankingBoard({
  entries,
  unit,
  highlightRank,
  compact = false,
}: {
  entries: RankingEntry[]
  /** スコアの単位(円 / 点)。 */
  unit: string
  /** 自分の記録として点滅させる順位。 */
  highlightRank?: number | null
  /** ゲームオーバー画面用に行間を詰める。 */
  compact?: boolean
}) {
  const empties = Array.from(
    { length: Math.max(0, RANKING_SIZE - entries.length) },
    (_, i) => entries.length + i + 1,
  )
  const rowClass = compact ? 'py-0.5 text-[11px]' : 'py-1 text-xs sm:text-sm'

  return (
    <ol className="space-y-0.5">
      {entries.map((entry) => {
        const mine = entry.rank === highlightRank
        const color = RANK_COLOR[entry.rank] ?? DEFAULT_COLOR
        return (
          <li
            key={entry.rank}
            className={
              'flex items-baseline gap-2 ' +
              rowClass +
              ' ' +
              color +
              (mine ? ' animate-arcade-blink' : '')
            }
          >
            <span className="arcade-glow w-9 shrink-0 font-bold tabular-nums">
              {ORDINAL[entry.rank - 1]}
            </span>
            <span className="max-w-[9rem] shrink truncate">{entry.playerName}</span>
            {/* 昔のハイスコア表のリーダー(点線)。余った幅を埋める。 */}
            <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-current opacity-40" />
            <span className="arcade-glow shrink-0 tabular-nums">
              {entry.score}
              {unit}
            </span>
            <span className="w-3 shrink-0 text-center">{mine ? '◀' : ''}</span>
          </li>
        )
      })}

      {empties.map((rank) => (
        <li
          key={rank}
          className={'flex items-baseline gap-2 text-[#3d4a75] ' + rowClass}
        >
          <span className="w-9 shrink-0 font-bold tabular-nums">{ORDINAL[rank - 1]}</span>
          <span className="shrink truncate">- - - -</span>
          <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-current opacity-40" />
          <span className="shrink-0 tabular-nums">0{unit}</span>
          <span className="w-3 shrink-0" />
        </li>
      ))}
    </ol>
  )
}
