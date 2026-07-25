import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Participant } from '../../lib/types'
import { isClaimableSlot, VISITOR_PLACEHOLDER } from '../../lib/guests'
import { Button } from '../ui/Button'

/**
 * 既存の「番号だけの枠(名前なし)」を選んで、自分の名前を付けて自分に割り当てるモーダル。
 * 運営者が先に番号だけのゲストを用意しておき、後から本人が当てはまる運用に使う。
 * 実名がすでに入っている番号は上書きを避けるため選べない(候補に出さない)。
 */
export function ClaimNumberModal({
  participants,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  participants: Participant[]
  pending: boolean
  error?: string | null
  onSubmit: (participantId: string, name: string) => void
  onCancel: () => void
}) {
  const [participantId, setParticipantId] = useState('')
  const [name, setName] = useState('')

  if (typeof document === 'undefined') return null

  // 番号(並び順)と、空き枠(番号だけ or 運営者が用意した「遅刻者・ビジター」)を候補にする。
  const numberOf = new Map<string, number>()
  participants.forEach((p, i) => numberOf.set(p.id, i + 1))
  const openSlots = participants.filter(
    (p) => p.status === 'ACTIVE' && isClaimableSlot(p.guestName),
  )

  const submit = () => {
    // 名前は任意。未入力なら「ゲスト」で割り当てる。番号の選択だけ必須。
    if (participantId && !pending) onSubmit(participantId, name.trim() || 'ゲスト')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="運営指定の番号で参加"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">運営指定の番号で参加</h2>
        <p className="mt-1 text-sm text-slate-500">
          運営者が用意した自分の番号を選び、名前を付けます。
        </p>

        {openSlots.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            選べる空き番号がありません。「新しく参加」をお使いください。
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              番号
              <select
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-base"
              >
                <option value="">選択</option>
                {openSlots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {numberOf.get(p.id)}番
                    {p.guestName?.trim() === VISITOR_PLACEHOLDER ? '（遅刻者・ビジター）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              名前（任意）
              <input
                type="text"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                placeholder="あなたの名前（任意）"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            </label>
          </div>
        )}

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex items-center gap-2">
          {openSlots.length > 0 ? (
            <Button
              className="flex-1"
              onClick={submit}
              disabled={!participantId || pending}
            >
              {pending ? '設定中…' : 'この番号で参加'}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {openSlots.length > 0 ? 'キャンセル' : '閉じる'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
