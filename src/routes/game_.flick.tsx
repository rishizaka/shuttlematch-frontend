import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, RotateCcw, Share2, Trophy } from 'lucide-react'
import { createCoinFlickGame, flickLevelOf } from '../components/game/coinFlick'
import { AdSlot } from '../components/game/AdSlot'
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
        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-700">
          <Trophy className="h-4 w-4" />
          ベスト {best}円
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
            <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl">
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

      <AdSlot />

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        長押しでチャージ(ゲージは往復)、離すと発射。弱すぎると「もどり」で1枚損。
        <br />
        持ち玉3枚スタート、10円で+1枚・30円で+2枚・50円で+3枚。50円ごとにレベルアップし、レベル2からポケットが動きます。
      </p>
    </div>
  )
}
