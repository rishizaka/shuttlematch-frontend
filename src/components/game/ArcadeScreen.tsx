import type { ReactNode } from 'react'

/**
 * レトロなアーケード筐体の画面を模した枠。
 * ランキングまわり(冠アイコンのモーダル・ゲームオーバーのランクイン欄)で共通に使う。
 *
 * 走査線とにじみは styles.css の .arcade-scanlines / .arcade-glow。
 */
export function ArcadeScreen({
  title,
  children,
  className = '',
}: {
  /** 画面上部に出す見出し(HIGH SCORE など)。 */
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={
        'arcade-scanlines relative overflow-hidden rounded-lg border-2 border-[#2b3566] bg-[#080a18] p-3 font-mono shadow-[inset_0_0_24px_rgba(60,90,200,0.25)] ' +
        className
      }
    >
      {title ? (
        <p className="arcade-glow mb-2 text-center text-xs font-bold tracking-[0.3em] text-[#ffd24a]">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  )
}
