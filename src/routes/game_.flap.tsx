import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, RotateCcw, Share2, Trophy } from 'lucide-react'
import { createShuttleFlapGame, levelOf } from '../components/game/shuttleFlap'
import { AdSlot } from '../components/game/AdSlot'
import { GameGuide } from '../components/game/GameGuide'
import { useToast } from '../components/ui/Toast'
import type { GamePhase, ShuttleFlapHandle } from '../components/game/shuttleFlap'

export const Route = createFileRoute('/game_/flap')({
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
  component: FlapPage,
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

function FlapPage() {
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
    // 開発時のみ ?s=25 のように途中スコアから開始できる(レベル・テーマ確認用)
    const startScore = import.meta.env.DEV
      ? Number(new URLSearchParams(window.location.search).get('s')) || 0
      : 0
    const game = createShuttleFlapGame(
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
    const lv = levelOf(score)
    const text =
      lv >= 2
        ? `シャトルフラップで ${score} 点(レベル${lv})とった！🏸 きみは超えられる？`
        : `シャトルフラップで ${score} 点とった！🏸 きみは超えられる？`
    const url = 'https://s-match.net/game/flap'
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
          <h1 className="text-xl font-bold text-slate-900">シャトルフラップ</h1>
          <p className="text-xs text-slate-500">タップだけで遊べます。</p>
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
              {levelOf(score) >= 2 ? (
                <p className="mt-0.5 text-xs font-semibold text-brand-500">
                  レベル {levelOf(score)} 到達
                </p>
              ) : null}
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

      <GameGuide
        howTo={[
          'タップ(パソコンならスペースキーか↑キー)でシャトルがふわりと浮きます。押さなければ落ちていきます。',
          '向かってくるネットのすき間をくぐり抜けるたびに 1 点。ネットに当たるか、床か天井に触れたら終了です。',
          '10 点ごとにレベルアップ。体育館のステージが昼から夕方、ナイターへと変わり、スピードが上がってすき間が狭くなります。',
          'レベル 2 からはネットが上下に揺れ始め、レベル 3 で揺れが速くなり、レベル 4 からはすき間の高さ自体が伸び縮みします。',
        ]}
        tips={[
          '連打よりも、短いタップを一定のリズムで刻むほうが高さを保てます。上がりすぎたら思い切って指を止めます。',
          '見るべきはシャトルではなく、次のすき間の位置。すき間の中心より少し上を通るつもりで狙うと当たりにくくなります。',
          'ネットが揺れるレベル 2 以降は、すき間が折り返す瞬間(いちばん上か、いちばん下で止まる一瞬)に通すと安全です。',
        ]}
      />

      <AdSlot />

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        ベストスコアはこの端末にだけ保存されます。
      </p>
    </div>
  )
}
