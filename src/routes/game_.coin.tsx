import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Crown, RotateCcw, Share2 } from 'lucide-react'
import { coinLevelOf, createCoinDropGame } from '../components/game/coinDrop'
import { AdSlot } from '../components/game/AdSlot'
import { GameGuide } from '../components/game/GameGuide'
import { GameOverRanking } from '../components/game/GameOverRanking'
import { RankingModal } from '../components/game/RankingModal'
import { useToast } from '../components/ui/Toast'
import type { GamePhase, MiniGameHandle } from '../components/game/shared'

export const Route = createFileRoute('/game_/coin')({
  head: () => ({
    meta: [
      { title: '10円ゲーム — 待ち時間のミニゲーム | ShuttleMatch' },
      {
        name: 'description',
        content:
          '駄菓子屋の名機を片手で。10円玉をジャンプで操って穴を飛び越え、下まで転がせば10円ゲット。試合の待ち時間にどうぞ。',
      },
    ],
  }),
  component: CoinPage,
})

const BEST_KEY = 'shuttlematch:coin-drop:best'

/** スコアに応じた称号。リトライ意欲を出すための小さなご褒美。 */
function rankOf(score: number): { emoji: string; label: string } {
  if (score >= 150) return { emoji: '🏆', label: '伝説のコロコロ名人!' }
  if (score >= 100) return { emoji: '🥇', label: '10円長者' }
  if (score >= 60) return { emoji: '🥈', label: '駄菓子屋の常連' }
  if (score >= 30) return { emoji: '🥉', label: 'コツをつかんだ' }
  if (score >= 10) return { emoji: '🪙', label: 'はじめての10円' }
  return { emoji: '🐣', label: 'まずは1枚(10円)!' }
}

function CoinPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<MiniGameHandle | null>(null)
  const { showToast } = useToast()

  const [phase, setPhase] = useState<GamePhase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  // ランキング(冠アイコン)のモーダルの開閉。
  const [showRanking, setShowRanking] = useState(false)
  // ゲームオーバー表示時点のベスト(更新前)。「あと N 円でベスト」表示に使う。
  const bestRef = useRef(0)

  useEffect(() => {
    const stored = Number(localStorage.getItem(BEST_KEY) ?? '0')
    if (Number.isFinite(stored) && stored > 0) {
      setBest(stored)
      bestRef.current = stored
    }
  }, [])

  const handleGameOver = useCallback((finalScore: number) => {
    const prevBest = bestRef.current
    if (finalScore > prevBest) {
      bestRef.current = finalScore
      setBest(finalScore)
      setIsNewBest(true)
      localStorage.setItem(BEST_KEY, String(finalScore))
    } else {
      setIsNewBest(false)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // 開発時のみ ?s=40 のように途中スコアから開始できる(レベル・テーマ確認用)
    const startScore = import.meta.env.DEV
      ? Number(new URLSearchParams(window.location.search).get('s')) || 0
      : 0
    const game = createCoinDropGame(
      canvas,
      {
        onPhaseChange: (p) => {
          setPhase(p)
          if (p === 'playing') setScore(startScore)
        },
        onScore: setScore,
        onGameOver: handleGameOver,
      },
      { startScore },
    )
    gameRef.current = game
    return () => {
      gameRef.current = null
      game.dispose()
    }
  }, [handleGameOver])

  const share = async () => {
    const lv = coinLevelOf(score)
    const text =
      lv >= 2
        ? `10円ゲームで ${score}円ためた！(レベル${lv})🪙 きみは超えられる？`
        : `10円ゲームで ${score}円ためた！🪙 きみは超えられる？`
    const url = 'https://s-match.net/game/coin'
    if (navigator.share) {
      try {
        await navigator.share({ text, url })
      } catch {
        // キャンセルは何もしない
      }
      return
    }
    await navigator.clipboard.writeText(`${text}\n${url}`)
    showToast('スコアをコピーしました。SNS に貼ってシェア!')
  }

  const rank = rankOf(score)

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <Link
            to="/game"
            className="mb-1 inline-flex items-center gap-0.5 text-xs font-medium text-slate-400 transition hover:text-brand-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            ミニゲーム一覧
          </Link>
          <h1 className="text-xl font-bold text-slate-900">10円ゲーム</h1>
          <p className="text-xs text-slate-500">タップでジャンプ。何円ためられる？</p>
        </div>
        {/* 冠を押すとレトロなアーケード風のランキング(全員の記録)が開く。
            端末ごとの自己ベストはその下に小さく添える。 */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setShowRanking(true)}
            aria-label="ランキングを見る"
            className="arcade-scanlines relative flex items-center gap-1.5 rounded-lg border-2 border-[#2b3566] bg-[#080a18] px-3 py-2 font-mono text-xs font-bold tracking-[0.15em] text-[#ffd24a] shadow-[inset_0_0_12px_rgba(60,90,200,0.35)] transition hover:bg-[#111634] active:scale-95"
          >
            <Crown className="arcade-glow h-4 w-4" />
            RANKING
          </button>
          <p className="whitespace-nowrap text-[10px] tabular-nums text-slate-400">
            自己ベスト {best}円
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        {/* 高さは画面に収まる範囲でなるべく縦長に(スマホ片手プレイ想定) */}
        <canvas
          ref={canvasRef}
          className="block h-[min(72dvh,560px)] w-full touch-none select-none"
        />

        {phase === 'over' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/45 p-6 backdrop-blur-[2px]">
            <div className="max-h-full w-full max-w-xs overflow-y-auto rounded-2xl bg-white p-5 text-center shadow-xl">
              <p className="text-3xl">{rank.emoji}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{rank.label}</p>
              <p className="mt-2 text-4xl font-black text-slate-900">{score}円</p>
              {coinLevelOf(score) >= 2 ? (
                <p className="mt-0.5 text-xs font-semibold text-brand-500">
                  レベル {coinLevelOf(score)} 到達
                </p>
              ) : null}
              {isNewBest ? (
                <p className="mt-1 text-sm font-bold text-amber-600">🎉 自己ベスト更新!</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  ベストまであと {Math.max(best - score, 1)}円
                </p>
              )}
              <GameOverRanking game="coin" unit="円" score={score} />
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => gameRef.current?.restart()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-95"
                >
                  <RotateCcw className="h-4 w-4" />
                  もう一回
                </button>
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
                >
                  <Share2 className="h-4 w-4" />
                  スコアをシェア
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <GameGuide
        howTo={[
          '駄菓子屋にあった 10 円ゲームがモチーフ。10 円玉がジグザグの棚を自動で転がり落ちていきます。',
          'タップ(パソコンならスペースキー)で小さくジャンプ。棚に開いた赤い縁の穴はハズレで、落ちたらそこで終了です。',
          '棚を 1 段降りるごとに +1 円。いちばん下の「あたり」まで届けば +5 円で、1 盤面をきれいに抜けると 10 円になります。',
          '1 盤面クリアするたびに棚と穴が組み変わり、景色が昼 → 夕焼け → ナイターと移ります。夕焼け(2 面目)からは穴が左右にスライドし始めます。さらに 20 円ごとにレベルアップし、転がりが速く・穴が増えていきます。',
        ]}
        tips={[
          'ジャンプは小さいので、穴の手前ぎりぎりではなく「ひと呼吸早く」跳ぶくらいでちょうど穴を越えられます。',
          '目線は転がっている 10 円玉ではなく、進行方向の次の穴に置きます。壁ぎわの降り口の位置も先に確認しておきましょう。',
          '穴が動きだす夕焼け以降は、穴が自分から遠ざかる向きに動いている瞬間を狙うと、跳んだ先が塞がりません。',
        ]}
      />

      <AdSlot />

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        ベストスコアはこの端末にだけ保存されます。
      </p>
      {showRanking ? (
        <RankingModal game="coin" unit="円" onClose={() => setShowRanking(false)} />
      ) : null}
    </div>
  )
}
