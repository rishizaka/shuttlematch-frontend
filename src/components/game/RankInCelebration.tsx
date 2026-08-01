import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { hasRankInScene, rankInDuration } from './rankInTiers'

/**
 * ランクインしたときに一度だけ挟む祝福モーダル。
 *
 * 1〜3位は three.js のシーン(順位が上ほど派手)、4〜5位は CSS だけの軽い演出にする。
 * three.js は 1〜3位のときだけ動的 import されるので、下位で入っただけの人や
 * ランクインしなかった人には読み込まれない。
 *
 * 演出が終わると自動で閉じる。待てない人のためにタップでも閉じられる。
 */
export function RankInCelebration({ rank, onDone }: { rank: number; onDone: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  // 動きを減らす設定の人には 3D を出さず、静止した表示だけにする。
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const use3d = hasRankInScene(rank) && !reduced
  // three.js の読み込みが終わってシーンが動き出したか。
  const [sceneStarted, setSceneStarted] = useState(false)

  useEffect(() => {
    if (!use3d) return
    const host = hostRef.current
    if (!host) return
    let disposer: { dispose: () => void } | null = null
    let disposed = false
    // 動的 import なので、返ってきた時点で既に閉じられていることがある。
    void import('./rankInScene').then(({ createRankInScene }) =>
      createRankInScene(host, rank).then((scene) => {
        if (disposed) scene.dispose()
        else {
          disposer = scene
          setSceneStarted(true)
        }
      }),
    )
    return () => {
      disposed = true
      disposer?.dispose()
    }
  }, [rank, use3d])

  // 演出の長さで自動的に閉じる。3D はシーンが動き出してから数えないと、
  // three.js の読み込みにかかった時間だけ演出が短く切られてしまう。
  useEffect(() => {
    if (use3d && !sceneStarted) return
    const ms = use3d ? rankInDuration(rank) : 1400
    const timer = setTimeout(onDone, ms)
    return () => clearTimeout(timer)
  }, [rank, use3d, sceneStarted, onDone])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#04050c]/85 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`${rank}位にランクイン`}
      onClick={onDone}
    >
      {use3d ? <div ref={hostRef} className="absolute inset-0" aria-hidden /> : null}

      {/* 3D を出さないとき(4〜5位・動きを減らす設定)の表示。
          3D のときも読み上げ用にテキストを残す。 */}
      <div
        className={
          'relative text-center font-mono ' + (use3d ? 'sr-only' : 'animate-arcade-blink')
        }
      >
        <p className="arcade-glow text-sm tracking-[0.3em] text-[#7de3ff]">R A N K I N !!</p>
        <p className="arcade-glow mt-2 text-6xl font-black tracking-widest text-[#ffd24a]">
          {rank}
          <span className="text-2xl">位</span>
        </p>
      </div>

      <p className="absolute bottom-8 left-0 right-0 text-center font-mono text-[10px] tracking-[0.2em] text-[#5d6ba0]">
        TAP TO SKIP
      </p>
    </div>,
    document.body,
  )
}
