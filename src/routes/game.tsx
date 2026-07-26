import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RotateCcw, Share2, Trophy } from 'lucide-react'
import { createShuttleFlapGame } from '../components/game/shuttleFlap'
import { useToast } from '../components/ui/Toast'
import type { GamePhase, ShuttleFlapHandle } from '../components/game/shuttleFlap'

export const Route = createFileRoute('/game')({
  head: () => ({
    meta: [
      { title: 'シャトルフラップ — 待ち時間のミニゲーム | ShuttleMatch' },
      {
        name: 'description',
        content:
          'タップでシャトルを飛ばしてネットのすき間をくぐり抜けるミニゲーム。試合の待ち時間にどうぞ。',
      },
    ],
  }),
  component: GamePage,
})

const BEST_KEY = 'shuttlematch:shuttle-flap:best'

/** スコアに応じた称号。リトライ意欲を出すための小さなご褒美。 */
function rankOf(score: number): { emoji: string; label: string } {
  if (score >= 40) return { emoji: '🏆', label: '全日本級!' }
  if (score >= 25) return { emoji: '🥇', label: '県大会レベル' }
  if (score >= 15) return { emoji: '🥈', label: '市大会レベル' }
  if (score >= 8) return { emoji: '🥉', label: '部内エース' }
  if (score >= 3) return { emoji: '🏸', label: '初心者卒業' }
  return { emoji: '🐣', label: 'まずは3点!' }
}

/**
 * 将来の広告枠。マネタイズは /game に閉じて、試合表や TOP には出さない方針。
 * AdSense 等を入れるときはこの中身をタグに差し替える。
 */
function AdSlot() {
  return (
    <div className="flex h-[100px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100/60">
      <span className="text-xs tracking-wider text-slate-400">AD SPACE</span>
    </div>
  )
}

function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ShuttleFlapHandle | null>(null)
  const { showToast } = useToast()

  const [phase, setPhase] = useState<GamePhase>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  // ゲームオーバー表示時点のベスト(更新前)。「あと N 点でベスト」表示に使う。
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
    const game = createShuttleFlapGame(canvas, {
      onPhaseChange: (p) => {
        setPhase(p)
        if (p === 'playing') setScore(0)
      },
      onScore: setScore,
      onGameOver: handleGameOver,
    })
    gameRef.current = game
    return () => {
      gameRef.current = null
      game.dispose()
    }
  }, [handleGameOver])

  const share = async () => {
    const text = `シャトルフラップで ${score} 点とった！🏸 きみは超えられる？`
    const url = 'https://s-match.net/game'
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
          <h1 className="text-xl font-bold text-slate-900">シャトルフラップ</h1>
          <p className="text-xs text-slate-500">試合の待ち時間に。タップだけで遊べます。</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-semibold text-amber-700">
          <Trophy className="h-4 w-4" />
          ベスト {best}
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
              <p className="mt-2 text-4xl font-black text-slate-900">{score}</p>
              {isNewBest ? (
                <p className="mt-1 text-sm font-bold text-amber-600">🎉 自己ベスト更新!</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  ベストまであと {Math.max(best - score, 1)} 点
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
        タップ(またはスペースキー)でシャトルが浮きます。
        <br />
        ネットのすき間をくぐるたびに 1 点。ベストスコアはこの端末に保存されます。
      </p>
    </div>
  )
}
