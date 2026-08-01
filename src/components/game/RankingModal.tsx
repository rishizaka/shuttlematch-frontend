import { createPortal } from 'react-dom'
import { useGameRanking } from '../../hooks/queries'
import { ArcadeScreen } from './ArcadeScreen'
import { RankingBoard } from './RankingBoard'

/**
 * ヘッダーの冠アイコンから開くランキング。レトロなアーケード筐体の画面を模した見た目。
 * ベストスコア(端末ローカル)とは別に、サーバーに記録された全員の上位5件を出す。
 */
export function RankingModal({
  game,
  unit,
  onClose,
}: {
  game: string
  unit: string
  onClose: () => void
}) {
  const { data, isLoading, error, refetch } = useGameRanking(game)

  // SSR では描画しない(クライアントで開かれるモーダル)。
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="ランキング"
      onClick={onClose}
    >
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <ArcadeScreen title="★ HIGH SCORE ★" className="p-4">
          {isLoading ? (
            <p className="animate-arcade-blink py-6 text-center font-mono text-xs text-[#7de3ff]">
              NOW LOADING...
            </p>
          ) : error ? (
            <div className="py-6 text-center font-mono text-xs text-[#ff9d4a]">
              <p>CONNECTION ERROR</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-2 underline decoration-dotted"
              >
                RETRY
              </button>
            </div>
          ) : (
            <RankingBoard entries={data?.entries ?? []} unit={unit} />
          )}

          <p className="mt-3 text-center font-mono text-[10px] leading-relaxed text-[#5d6ba0]">
            5位までに入ると名前を登録できます
            <br />
            記録は全員に公開されます
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded border-2 border-[#2b3566] bg-[#111634] py-2 font-mono text-xs font-bold tracking-[0.2em] text-[#dfe9ff] transition hover:bg-[#1a2150] active:scale-95"
          >
            CLOSE
          </button>
        </ArcadeScreen>
      </div>
    </div>,
    document.body,
  )
}
