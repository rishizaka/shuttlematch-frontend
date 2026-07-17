import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Participant } from '../../lib/types'
import { Button } from '../ui/Button'

/**
 * 「あなたの番号は？」を尋ねる任意設定のモーダル。
 * 番号(参加者一覧の並び順)を入れると、試合表で自分の試合が強調表示される。
 *
 * これは見やすさのためのローカル設定に過ぎない:
 * - 入力値は localStorage に保存するだけで、サーバー(DB)には送らない。
 * - そのため他の参加者と番号が重複しても構わない(各自の端末でだけ有効)。
 *   重複に気づいたら本人同士で相談して設定し直せばよい。
 */
export function SelfNumberModal({
  participants,
  initialNumber,
  onSubmit,
  onClear,
  onCancel,
}: {
  participants: Participant[]
  /** すでに設定済みの番号(あれば入力欄の初期値にする)。 */
  initialNumber?: number | null
  /** 番号確定時。渡すのは選ばれた参加者の ID。 */
  onSubmit: (participantId: string) => void
  /** 設定を解除する(番号なしに戻す)。設定済みのときだけ表示する。 */
  onClear?: () => void
  onCancel: () => void
}) {
  const [numberStr, setNumberStr] = useState(
    initialNumber != null ? String(initialNumber) : '',
  )
  const [attempted, setAttempted] = useState(false)

  // 表示中は背面ページのスクロールをロックする(macOS のバウンス対策)。
  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  const num = Number(numberStr)
  const inRange = Number.isInteger(num) && num >= 1 && num <= participants.length
  const target = inRange ? participants[num - 1] : null

  // 重複は許容するので、番号自体の範囲チェックだけ行う。
  const error = !numberStr
    ? '番号を入力してください'
    : !inRange
      ? 'その番号は見つかりません'
      : null
  // 範囲外は入力中に即表示、未入力は決定を押してから表示。
  const shownError = numberStr && !inRange ? error : attempted ? error : null

  const submit = () => {
    setAttempted(true)
    if (error || !target) return
    onSubmit(target.id)
  }

  // SSR では描画しない(クライアントで開かれる想定のモーダル)。
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="自分の番号を設定"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">あなたの番号は？</h2>
        <p className="mt-1 text-sm text-slate-500">
          自分の番号を入れると、試合表であなたの試合が強調表示されます(任意)。
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            番号
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={participants.length}
              value={numberStr}
              onChange={(e) => setNumberStr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="あなたの番号"
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>

          {shownError ? <p className="text-sm text-red-600">{shownError}</p> : null}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button className="flex-1" onClick={submit}>
            設定する
          </Button>
          {onClear ? (
            <Button variant="ghost" onClick={onClear}>
              解除
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onCancel}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
