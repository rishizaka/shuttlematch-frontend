import { createPortal } from 'react-dom'
import { RANKING_SIZE } from '../../lib/ranking'
import { ArcadeScreen } from './ArcadeScreen'
import { PLAYER_NAME_MAX } from './playerName'

/**
 * ランクインしたときの名前入力モーダル。祝福の演出が終わってから出す。
 *
 * ゲーセンの名前入力と同じで、ENTER(登録)か SKIP(見送り)を選ぶまで先へ進めない。
 * 背景のタップや Esc では閉じない(閉じられると登録の機会がそのまま流れてしまうため)。
 */
export function NameEntryModal({
  rank,
  name,
  onNameChange,
  onSubmit,
  onSkip,
  pending,
  error,
}: {
  /** 先読みした順位(1〜5)。 */
  rank: number
  name: string
  onNameChange: (value: string) => void
  onSubmit: () => void
  onSkip: () => void
  pending: boolean
  error?: string | null
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#04050c]/85 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="ランキングに名前を登録"
    >
      <div className="w-full max-w-xs">
        <ArcadeScreen className="p-4">
          <p className="arcade-glow animate-arcade-blink mb-1 text-center text-base font-bold tracking-[0.2em] text-[#ffd24a]">
            RANK IN !!
          </p>
          <p className="mb-3 text-center text-xs tracking-[0.15em] text-[#dfe9ff]">
            {rank}位 / TOP {RANKING_SIZE}
          </p>
          <p className="mb-2 text-center text-[10px] tracking-[0.15em] text-[#7de3ff]">
            ENTER YOUR NAME
          </p>

          <input
            type="text"
            value={name}
            maxLength={PLAYER_NAME_MAX}
            autoFocus
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit()
            }}
            placeholder="_ _ _"
            aria-label="ランキングに登録する名前"
            className="w-full rounded border-2 border-[#2b3566] bg-[#111634] px-2 py-2.5 text-center font-mono text-lg tracking-[0.25em] text-[#ffd24a] placeholder:text-[#3d4a75] focus:outline-none focus-visible:border-[#7de3ff]"
          />

          {error ? (
            <p className="mt-1.5 text-center text-[10px] text-[#ff6b6b]">{error}</p>
          ) : (
            <p className="mt-1.5 text-center text-[10px] text-[#5d6ba0]">
              {PLAYER_NAME_MAX}文字まで・全員に公開されます
            </p>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!name.trim() || pending}
            className="mt-3 w-full rounded border-2 border-[#ffd24a] bg-[#ffd24a] py-2.5 font-mono text-sm font-bold tracking-[0.2em] text-[#080a18] transition hover:bg-[#ffe08a] active:scale-95 disabled:opacity-30"
          >
            {pending ? 'SENDING...' : 'ENTER'}
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={pending}
            className="mt-2 w-full rounded border-2 border-[#2b3566] bg-[#111634] py-2 font-mono text-xs tracking-[0.2em] text-[#5d6ba0] transition hover:bg-[#1a2150] active:scale-95 disabled:opacity-30"
          >
            SKIP
          </button>
        </ArcadeScreen>
      </div>
    </div>,
    document.body,
  )
}
