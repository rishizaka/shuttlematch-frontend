import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Crown, RotateCcw, Share2 } from 'lucide-react'
import { createCoinFlickGame, flickLevelOf } from '../components/game/coinFlick'
import { AdSlot } from '../components/game/AdSlot'
import { GameGuide } from '../components/game/GameGuide'
import { GameOverRanking } from '../components/game/GameOverRanking'
import { RankingModal } from '../components/game/RankingModal'
import { useToast } from '../components/ui/Toast'
import type { GamePhase, MiniGameHandle } from '../components/game/shared'

export const Route = createFileRoute('/game_/flick')({
  head: () => ({
    meta: [
      { title: '10円はじき — 待ち時間のミニゲーム | ShuttleMatch' },
      {
        name: 'description',
        content:
          '駄菓子屋のエレメカ風。長押しチャージで10円玉をはじいて、釘の間を抜けて当たりポケットを狙うミニゲーム。試合の待ち時間にどうぞ。',
      },
    ],
  }),
  component: FlickPage,
})

const BEST_KEY = 'shuttlematch:coin-flick:best'

/** スコアに応じた称号。リトライ意欲を出すための小さなご褒美。 */
function rankOf(score: number): { emoji: string; label: string } {
  if (score >= 250) return { emoji: '🏆', label: 'エレメカの神!' }
  if (score >= 150) return { emoji: '🥇', label: '景品総取り' }
  if (score >= 100) return { emoji: '🥈', label: '駄菓子屋の常連' }
  if (score >= 50) return { emoji: '🥉', label: '一発当てた' }
  if (score >= 10) return { emoji: '🪙', label: 'まずは一勝' }
  return { emoji: '🐣', label: 'まずは10円!' }
}

function FlickPage() {
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
    // 開発時のみ ?s=60 のように途中スコアから開始できる(レベル・テーマ確認用)
    const startScore = import.meta.env.DEV
      ? Number(new URLSearchParams(window.location.search).get('s')) || 0
      : 0
    const game = createCoinFlickGame(
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
    const lv = flickLevelOf(score)
    const text =
      lv >= 2
        ? `10円はじきで ${score}円かせいだ！(レベル${lv})🪙 きみは超えられる？`
        : `10円はじきで ${score}円かせいだ！🪙 きみは超えられる？`
    const url = 'https://s-match.net/game/flick'
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
          <h1 className="text-xl font-bold text-slate-900">10円はじき</h1>
          <p className="text-xs text-slate-500">長押しでチャージ、離して発射。</p>
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
              {flickLevelOf(score) >= 2 ? (
                <p className="mt-0.5 text-xs font-semibold text-brand-500">
                  レベル {flickLevelOf(score)} 到達
                </p>
              ) : null}
              {isNewBest ? (
                <p className="mt-1 text-sm font-bold text-amber-600">🎉 自己ベスト更新!</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  ベストまであと {Math.max(best - score, 1)}円
                </p>
              )}
              <GameOverRanking game="flick" unit="円" score={score} />
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
          '駄菓子屋のエレメカがモチーフ。長押しでパワーをためて、離すと 10 円玉が右のレールを駆け上がり、釘に弾かれながら落ちていきます。',
          'パワーゲージは行ったり来たりを繰り返すので、狙った強さで指を離すタイミング勝負です。',
          '下のポケットは 10 円・30 円・50 円(大当たり)・ハズレ。入った金額がそのままスコアに加算されます。',
          '持ち玉は 4 枚スタートで、1 回の発射につき 1 枚消費。10 円で +1 枚、30 円で +2 枚、50 円で +3 枚戻ってきます。持ち玉が尽きたら終了です。',
          'チャージが弱すぎるとレールを登り切れず「もどり」になり、1 枚まるごと損をします。50 円ごとにレベルアップし、ゲージが速く・当たりポケットが狭くなり、レベル 2 からはポケット列が左右に動きます。',
        ]}
        tips={[
          '迷ったら強めに離します。弱すぎる「もどり」は 1 枚の丸損ですが、強すぎても釘に弾かれてどこかのポケットには入ります。',
          'ゲージは折り返しの前後でゆっくりに見えます。折り返し地点を目標にすると、狙った強さで離しやすくなります。',
          '同じ強さで撃つと、釘への当たり方が似て入るポケットも偏ります。狙いを外し続けるときは強さを少しずらしてみてください。',
          '持ち玉が残り 1 枚のときは大当たり狙いより、まず 10 円ポケットで 1 枚戻して延命するほうが結果的に伸びます。',
        ]}
      />

      <AdSlot />

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        ベストスコアはこの端末にだけ保存されます。
      </p>
      {showRanking ? (
        <RankingModal game="flick" unit="円" onClose={() => setShowRanking(false)} />
      ) : null}
    </div>
  )
}
