import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** アナウンスを自動で閉じるまでの時間 (ms)。 */
const AUTO_CLOSE_MS = 5000

/**
 * セット開始の全画面アナウンス。ポーリングで他端末のセット開始を検知したときに表示する。
 * 参加者が知りたい「自分は出るのか・どのコートか」を通知の中で答える。
 * タップどこでも閉じ、一定時間で自動的に閉じる。
 */
export function SetStartAnnouncement({
  setNumber,
  courtNumber,
  memberIndexes,
  identified,
  onClose,
}: {
  setNumber: number
  /** 自分が出るコート番号。出ない/不明なら null。 */
  courtNumber: number | null
  /** 自分が出るコートの参加者番号(自分を含む4人)。出ないなら null。 */
  memberIndexes: Array<{ index: number | string; self: boolean }> | null
  /** 自己申告済み(自分が誰か分かっている)か。false なら出場情報は出さない。 */
  identified: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [onClose])

  // SSR では描画しない(ポーリング検知によりクライアントでのみ開かれる)。
  if (typeof document === 'undefined') return null

  const playing = memberIndexes != null

  return createPortal(
    <button
      type="button"
      onClick={onClose}
      aria-label="閉じる"
      className="animate-announce-fade fixed inset-0 z-50 flex w-full items-center justify-center bg-slate-900/70 p-6 backdrop-blur-sm"
    >
      <div className="animate-announce-pop w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="text-4xl" aria-hidden>
          🏸
        </div>
        <p className="mt-3 text-3xl font-extrabold text-slate-900">第{setNumber}セット</p>
        <p className="mt-1 text-sm font-bold text-brand-600">開始しました！</p>

        {playing ? (
          <div className="mt-6 rounded-2xl bg-brand-50 px-4 py-4">
            <p className="text-xl font-bold text-brand-800">
              {courtNumber != null ? `あなたは ${courtNumber}コート` : 'あなたは出場します'}
            </p>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {memberIndexes.map((m, i) => (
                <span
                  key={i}
                  className={
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums ' +
                    (m.self
                      ? 'bg-brand-900 text-white'
                      : 'border border-brand-200 bg-white text-slate-700')
                  }
                >
                  {m.index}
                </span>
              ))}
            </div>
          </div>
        ) : identified ? (
          <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4">
            <p className="text-xl font-bold text-slate-600">今回は休憩です 🍵</p>
          </div>
        ) : null}

        <p className="mt-5 text-xs text-slate-400">タップで閉じる</p>
      </div>
    </button>,
    document.body,
  )
}
