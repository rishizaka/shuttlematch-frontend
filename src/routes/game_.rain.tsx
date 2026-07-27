import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, RotateCcw, Share2, Trophy } from 'lucide-react'
import { createSmashRainGame, rainLevelOf } from '../components/game/smashRain'
import { AdSlot } from '../components/game/AdSlot'
import { GameGuide } from '../components/game/GameGuide'
import { useToast } from '../components/ui/Toast'
import type { GamePhase, MiniGameHandle } from '../components/game/shared'

export const Route = createFileRoute('/game_/rain')({
  head: () => ({
    meta: [
      { title: 'スマッシュレイン — 待ち時間のミニゲーム | ShuttleMatch' },
      {
        name: 'description',
        content:
          '降り注ぐシャトルをよけ続けるサバイバルミニゲーム。予告つきの狙い撃ちスマッシュをかわし、ドリンクで加点。試合の待ち時間にどうぞ。',
      },
    ],
  }),
  component: RainPage,
})

const BEST_KEY = 'shuttlematch:smash-rain:best'

/** スコアに応じた称号。リトライ意欲を出すための小さなご褒美。 */
function rankOf(score: number): { emoji: string; label: string } {
  if (score >= 90) return { emoji: '🏆', label: '鉄壁のレシーバー!' }
  if (score >= 60) return { emoji: '🥇', label: '全日本の粘り' }
  if (score >= 40) return { emoji: '🥈', label: '県大会の反応速度' }
  if (score >= 20) return { emoji: '🥉', label: '部内一のフットワーク' }
  if (score >= 8) return { emoji: '🏸', label: '初心者卒業' }
  return { emoji: '🐣', label: 'まずは8点!' }
}

function RainPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<MiniGameHandle | null>(null)
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
    // 開発時のみ ?s=30 のように途中スコアから開始できる(レベル・テーマ確認用)
    const startScore = import.meta.env.DEV
      ? Number(new URLSearchParams(window.location.search).get('s')) || 0
      : 0
    const game = createSmashRainGame(
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
    const lv = rainLevelOf(score)
    const text =
      lv >= 2
        ? `スマッシュレインで ${score} 点生き残った！(レベル${lv})🏸 きみは超えられる？`
        : `スマッシュレインで ${score} 点生き残った！🏸 きみは超えられる？`
    const url = 'https://s-match.net/game/rain'
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
          <h1 className="text-xl font-bold text-slate-900">スマッシュレイン</h1>
          <p className="text-xs text-slate-500">ドラッグでよけるだけ。何秒生き残れる？</p>
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
              {rainLevelOf(score) >= 2 ? (
                <p className="mt-0.5 text-xs font-semibold text-brand-500">
                  レベル {rainLevelOf(score)} 到達
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
          '画面をドラッグすると選手が指を追いかけます。パソコンなら←→キーでも動かせます。',
          '降ってくるシャトルに当たらず生き残った時間がスコア。1 秒ごとに 1 点入ります。',
          'ときどき落ちてくるスポーツドリンクをキャッチすると +5 点。',
          '15 点ごとにレベルアップし、ステージが変わって物量と落下速度が上がります。',
          '自分を狙う高速スマッシュは最初から飛んできます。「!」の予告が出るのはレベル 1 のうちだけで、レベル 2 からは予告なしです。レベル 3 からは落下の途中で横に切れ込むカットショットも混ざります。',
        ]}
        tips={[
          'シャトルは羽根の抵抗でふらふら揺れながら落ちてきます。真下ではなく、揺れ幅のぶんだけ余裕をとってよけましょう。',
          '端に寄ると逃げ道が片側だけになります。基本は中央付近で待ち、最小限の移動でしのぐのが安定します。',
          'スマッシュは自分の位置を狙って撃たれます。撃たれたと気づいたら、細かく動かず一気に横へ抜けるのが確実です。',
          'ドリンクは +5 点ぶんの価値がありますが、無理に取りにいくと事故ります。安全に届く位置のときだけ拾いましょう。',
        ]}
      />

      <AdSlot />

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        ベストスコアはこの端末にだけ保存されます。
      </p>
    </div>
  )
}
