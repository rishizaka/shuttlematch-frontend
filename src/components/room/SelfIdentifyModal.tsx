import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Participant } from '../../lib/types'
import { isUnclaimedGuestName, participantDisplayName } from '../../lib/format'
import { Button } from '../ui/Button'

/**
 * 試合表を開いたときに「あなたの番号とニックネームは？」と尋ねるモーダル。
 * 番号(参加者)を選んでニックネームを入力すると、その参加者の名前を更新する。
 * 参加者は自己申告するまで試合表を見せない想定(キャンセルで戻す)。
 * 運営者はスキップして先に進める(cancelLabel で文言を差し替える)。
 */
export function SelfIdentifyModal({
  participants,
  names,
  submitting,
  onSubmit,
  onCancel,
  cancelLabel = 'キャンセル',
}: {
  participants: Participant[]
  names?: ReadonlyMap<string, string>
  submitting: boolean
  onSubmit: (participantId: string, nickname: string) => void
  /** キャンセル時のハンドラ。呼び出し側で戻す/閉じるを決める。 */
  onCancel: () => void
  /** キャンセルボタンの文言。 */
  cancelLabel?: string
}) {
  const [numberStr, setNumberStr] = useState('')
  const [nickname, setNickname] = useState('')
  const [attempted, setAttempted] = useState(false)

  // 表示中は背面ページのスクロールをロックする。
  // スクロール(特に macOS のバウンス)でオーバーレイの外に背面が見えるのを防ぐ。
  useEffect(() => {
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  // 番号がまだ既定名(数字)のままなら空き、名前が付いていたら使用中。
  const isTaken = (p: Participant) => !isUnclaimedGuestName(p)

  const num = Number(numberStr)
  const inRange = Number.isInteger(num) && num >= 1 && num <= participants.length
  const target = inRange ? participants[num - 1] : null
  const taken = target ? isTaken(target) : false

  // 番号自体の問題(範囲外・使用中)は入力中に即表示する。
  const numberError = !numberStr
    ? '番号を入力してください'
    : !inRange
      ? 'その番号は見つかりません'
      : taken
        ? `${num} 番は使用中です（${participantDisplayName(target as Participant, names)}）`
        : null
  // 数字だけの名前は「未申告(機械採番のまま)」の判定と衝突するため許可しない。
  const error =
    numberError ??
    (!nickname.trim()
      ? 'ニックネームを入力してください'
      : /^\d+$/.test(nickname.trim())
        ? '数字だけのニックネームは使えません'
        : null)

  // 範囲外・使用中は即時、それ以外(未入力・ニックネーム未入力)は決定を押してから表示。
  const shownError = numberStr && !inRange ? numberError : taken ? numberError : attempted ? error : null

  const submit = () => {
    setAttempted(true)
    if (error || !target) return
    onSubmit(target.id, nickname.trim())
  }

  // SSR では描画しない(クライアントで開かれる想定のモーダル)。
  if (typeof document === 'undefined') return null

  // body 直下へポータル描画する。ページ側のレイアウト(space-y 等の margin)が
  // fixed 要素の高さ計算に影響し、オーバーレイが下端まで届かなくなるのを防ぐ。
  // 背景は濃い色 + ぼかしで、申告するまで試合表の内容を読めないようにする。
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-900/90 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="自己紹介"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">あなたの番号とニックネームは？</h2>
        <p className="mt-1 text-sm text-slate-500">
          自分の番号を選んで名前を入れると、試合表にニックネームが表示されます。
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            番号
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={numberStr}
              onChange={(e) => setNumberStr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="あなたの番号"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            ニックネーム
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="例: たろう"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>

          {shownError ? <p className="text-sm text-red-600">{shownError}</p> : null}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? '登録中…' : '決定'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
