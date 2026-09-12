import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, Crown, RotateCcw, Share2 } from 'lucide-react'
import { TIME_LIMIT, createShatopokoSkiGame, skiLevelOf } from '../components/game/shatopokoSki'
import { AdSlot } from '../components/game/AdSlot'
import { GameGuide } from '../components/game/GameGuide'
import { GameOverRanking } from '../components/game/GameOverRanking'
import { RankingModal } from '../components/game/RankingModal'
import { useToast } from '../components/ui/Toast'
import type { GamePhase } from '../components/game/shared'
import type { SkiHandle, SkiSnapshot } from '../components/game/shatopokoSki'

export const Route = createFileRoute('/game_/ski')({
  head: () => ({
    meta: [
      { title: 'シャトポコのスキー — 待ち時間のミニゲーム | ShuttleMatch' },
      {
        name: 'description',
        content:
          '3本のコースを横スワイプで滑り降りるダウンヒル。120秒でどこまで行けるか。加速アイテムで速く、金の羽根で倍率アップ。試合の待ち時間にどうぞ。',
      },
    ],
  }),
  component: SkiPage,
})

const BEST_KEY = 'shuttlematch:shatopoko-ski:best'

const EMPTY: SkiSnapshot = {
  distance: 0,
  feathers: 0,
  multiplier: 1,
  score: 0,
  speedStep: 0,
  timeLeft: TIME_LIMIT,
  level: 1,
}

/**
 * スコアに応じた称号。
 * 敷居は実測から。ほぼ操作せず転び続けても120秒で 5,000 前後は出る（基本速度が速いので
 * 距離だけは勝手に伸びる）ため、そこを下の方に置いてある。上を狙うには速度段を保つ必要がある。
 */
function rankOf(score: number): { emoji: string; label: string } {
  if (score >= 16000) return { emoji: '🏆', label: 'ゲレンデの主' }
  if (score >= 12000) return { emoji: '🥇', label: '上級コース制覇' }
  if (score >= 9000) return { emoji: '🥈', label: '中級者' }
  if (score >= 7000) return { emoji: '🥉', label: 'ボーゲン卒業' }
  if (score >= 4500) return { emoji: '⛷️', label: 'まずは滑れた' }
  return { emoji: '🐣', label: 'そり遊びから' }
}

function SkiPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<SkiHandle | null>(null)
  const { showToast } = useToast()

  const [phase, setPhase] = useState<GamePhase>('ready')
  const [stats, setStats] = useState<SkiSnapshot>(EMPTY)
  const [best, setBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const [showRanking, setShowRanking] = useState(false)
  // 結果画面に出す確定値。ゲームオーバー後も stats が動かないよう固定する。
  const [result, setResult] = useState<SkiSnapshot>(EMPTY)
  const bestRef = useRef(0)

  useEffect(() => {
    const stored = Number(localStorage.getItem(BEST_KEY) ?? '0')
    if (Number.isFinite(stored) && stored > 0) {
      setBest(stored)
      bestRef.current = stored
    }
  }, [])

  const handleGameOver = useCallback((finalScore: number) => {
    const snap = gameRef.current?.snapshot()
    if (snap) setResult(snap)
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
    // 開発時のみ ?s=1800（距離）/ ?step=30（速度段）を指定して途中から始められる。
    // テーマ・難易度と、到達に時間のかかる高速域の見え方を確かめる用。
    const params = new URLSearchParams(window.location.search)
    const dev = import.meta.env.DEV
    const startScore = dev ? Number(params.get('s')) || 0 : 0
    const startStep = dev ? Number(params.get('step')) || 0 : 0
    const game = createShatopokoSkiGame(
      canvas,
      {
        onPhaseChange: setPhase,
        onStats: setStats,
        onGameOver: handleGameOver,
      },
      { startScore, startStep },
    )
    gameRef.current = game
    return () => {
      gameRef.current = null
      game.dispose()
    }
  }, [handleGameOver])

  const share = async () => {
    const text = `シャトポコのスキーで ${result.score.toLocaleString('ja-JP')} 点とった！⛷️ ${result.distance.toLocaleString('ja-JP')}m × ${result.multiplier.toFixed(2)}倍。きみは超えられる？`
    const url = 'https://s-match.net/game/ski'
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

  const rank = rankOf(result.score)

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
          <h1 className="text-xl font-bold text-slate-900">シャトポコのスキー</h1>
          <p className="text-xs text-slate-500">{TIME_LIMIT}秒の一本勝負。横スワイプで移動。</p>
        </div>
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
            自己ベスト {best.toLocaleString('ja-JP')}
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <canvas
          ref={canvasRef}
          className="block h-[min(72dvh,560px)] w-full touch-none select-none"
        />

        {phase === 'over' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/45 p-6 backdrop-blur-[2px]">
            <div className="max-h-full w-full max-w-xs overflow-y-auto rounded-2xl bg-white p-5 text-center shadow-xl">
              <p className="text-3xl">{rank.emoji}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{rank.label}</p>
              <p className="mt-2 text-4xl font-black tabular-nums text-slate-900">
                {result.score.toLocaleString('ja-JP')}
              </p>
              {/* 掛け算の内訳。次にどちらを伸ばせばいいかが分かるようにする */}
              <p className="mt-1 text-xs tabular-nums text-slate-500">
                <span className="text-slate-400">{TIME_LIMIT}秒で</span>{' '}
                {result.distance.toLocaleString('ja-JP')} m
                <span className="mx-1 text-slate-300">×</span>
                <span className="font-semibold text-amber-600">
                  {result.multiplier.toFixed(2)}
                </span>
                <span className="ml-1 text-slate-400">(羽根 {result.feathers})</span>
              </p>
              {skiLevelOf(result.distance) >= 2 ? (
                <p className="mt-0.5 text-xs font-semibold text-brand-500">
                  レベル {skiLevelOf(result.distance)} 到達
                </p>
              ) : null}
              {isNewBest ? (
                <p className="mt-1 text-sm font-bold text-amber-600">🎉 自己ベスト更新!</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  ベストまであと {Math.max(best - result.score, 1).toLocaleString('ja-JP')} 点
                </p>
              )}
              <GameOverRanking game="ski" unit="点" score={result.score} />
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

      {/* ゲーム中は canvas 内の HUD が本体。ここは「掛け算で決まる」ことの補足 */}
      {phase !== 'over' ? (
        <p className="text-center text-[11px] text-slate-400">
          スコアは <span className="font-semibold text-slate-500">滑った距離 × 倍率</span>。
          転んでも終わりませんが、速度が振り出しに戻ります。
          {stats.speedStep > 0 ? (
            <span className="ml-1 font-semibold text-sky-600">加速 {stats.speedStep} 段</span>
          ) : null}
        </p>
      ) : null}

      <GameGuide
        howTo={[
          'シャトポコがゲレンデを滑り降ります。コースは縦に3本、横スワイプ(パソコンなら←→キー)で隣のコースへ移るだけで、曲がる操作もブレーキもありません。',
          '持ち時間は120秒。スコアは「滑った距離 × 倍率」で、金の羽根を1枚拾うごとに倍率が0.01ずつ上がります。距離だけ伸ばしても羽根だけ集めても伸びないので、速く滑りながら拾うのが最大化のコツです。',
          '転ばずに滑り続けると自然に加速し、ラケットに当たると「スマッシュ」で一段加速(羽根5枚ぶんの加点つき)します。ジャンプ台に乗ると羽根がひらいて宙に浮き、飛んでいる間は無敵で空中の羽根も拾えます。',
          '岩や立木にぶつかると転倒し、積み上げた速さがすべて0に戻ります。起き上がった直後はしばらく無敵なので、転んだあとは落ち着いて次のコースを選べます。距離600mごとにレベルが上がり、コースがせばまってお邪魔が増えます。',
        ]}
        tips={[
          '前方には岩や立木が現れますが、3本すべてがふさがることはありません。焦って早めに避けず、確実に空いているコースを選びましょう。',
          '速さに上限はないので、転ばずに滑り続けて距離をかせぎつつ、無理のない範囲でラケットと羽根を拾いにいくのが伸びます。',
          '転んでもそこで終わりではありません。速度は失いますが、無敵時間のうちに立て直せば120秒ぶん粘れます。攻めて損をするより、粘って距離を積み上げる方が結果的に伸びることも多いです。',
          'ジャンプ台は「乗るだけ」でも得ですが、飛んだ先に羽根が並んでいます。空中では横移動も効くので、着地点をずらして羽根を拾いにいきましょう。',
        ]}
      />

      <AdSlot />

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        ベストスコアはこの端末にだけ保存されます。
      </p>
      {showRanking ? (
        <RankingModal game="ski" unit="点" onClose={() => setShowRanking(false)} />
      ) : null}
    </div>
  )
}
