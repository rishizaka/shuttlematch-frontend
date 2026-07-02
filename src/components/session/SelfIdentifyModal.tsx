import { useState } from 'react'
import type { Participant } from '../../lib/types'
import { participantDisplayName } from '../../lib/format'
import { Button } from '../ui/Button'

/**
 * 試合表を開いたときに「あなたの番号とニックネームは？」と尋ねるモーダル。
 * 番号(参加者)を選んでニックネームを入力すると、その参加者の名前を更新する。
 */
export function SelfIdentifyModal({
  participants,
  names,
  submitting,
  onSubmit,
  onSkip,
}: {
  participants: Participant[]
  names?: ReadonlyMap<string, string>
  submitting: boolean
  onSubmit: (participantId: string, nickname: string) => void
  onSkip: () => void
}) {
  const [numberStr, setNumberStr] = useState('')
  const [nickname, setNickname] = useState('')
  const [attempted, setAttempted] = useState(false)

  // 番号(index+1)がまだ既定名のままなら空き、名前が付いていたら使用中。
  const isTaken = (p: Participant, index: number) =>
    !p.guest || (p.guestName ?? '').trim() !== String(index + 1)

  const num = Number(numberStr)
  const inRange = Number.isInteger(num) && num >= 1 && num <= participants.length
  const target = inRange ? participants[num - 1] : null
  const taken = target ? isTaken(target, num - 1) : false

  // 番号自体の問題(範囲外・使用中)は入力中に即表示する。
  const numberError = !numberStr
    ? '番号を入力してください'
    : !inRange
      ? 'その番号は見つかりません'
      : taken
        ? `${num} 番は使用中です（${participantDisplayName(target as Participant, names)}）`
        : null
  const error = numberError ?? (!nickname.trim() ? 'ニックネームを入力してください' : null)

  // 範囲外・使用中は即時、それ以外(未入力・ニックネーム未入力)は決定を押してから表示。
  const shownError = numberStr && !inRange ? numberError : taken ? numberError : attempted ? error : null

  const submit = () => {
    setAttempted(true)
    if (error || !target) return
    onSubmit(target.id, nickname.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </label>

          {shownError ? <p className="text-sm text-red-600">{shownError}</p> : null}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Button className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? '登録中…' : '決定'}
          </Button>
          <Button variant="ghost" onClick={onSkip} disabled={submitting}>
            あとで
          </Button>
        </div>
      </div>
    </div>
  )
}
