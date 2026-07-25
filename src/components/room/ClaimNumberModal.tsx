import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Participant } from '../../lib/types'
import { FREE_SLOT, isClaimableSlot, VISITOR_PLACEHOLDER } from '../../lib/guests'
import { Button } from '../ui/Button'

/**
 * 番号を選んで自分に割り当てるモーダル。
 * <ul>
 * <li>空き枠(番号だけ / 遅刻者・ビジター / フリー)を選ぶと、名前を付けて名簿に入る(rename)。</li>
 * <li>すでに名前がある番号も選べる。この場合は名簿には触れず、この端末の
 *     「自分の番号」として紐付けるだけ(重複可)。間違えて設定しても選び直すだけで
 *     直せるように、番号の指定は排他にしない。</li>
 * </ul>
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
  /** name が null のときは名簿を変更せず、この端末の番号の紐付けだけ行う。 */
  onSubmit: (participantId: string, name: string | null) => void
  onCancel: () => void
}) {
  const [participantId, setParticipantId] = useState('')
  const [name, setName] = useState('')

  if (typeof document === 'undefined') return null

  // 番号(並び順)。在席していれば実名入りの番号も候補にする(名簿は上書きしない)。
  const numberOf = new Map<string, number>()
  participants.forEach((p, i) => numberOf.set(p.id, i + 1))
  const slots = participants.filter((p) => p.status === 'ACTIVE')

  const selected = slots.find((p) => p.id === participantId)
  // 空き枠なら名前を付けて名簿に入る。実名入りなら端末の紐付けのみ。
  const claimable = selected ? isClaimableSlot(selected.guestName) : true

  const slotLabel = (p: Participant): string => {
    const t = p.guestName?.trim() ?? ''
    if (t === VISITOR_PLACEHOLDER) return '（遅刻者・ビジター）'
    if (t === FREE_SLOT) return '（フリー）'
    if (!t || /^\d+$/.test(t)) return '（空き）'
    return `（${t}）`
  }

  const submit = () => {
    if (!participantId || pending) return
    // 空き枠: 名前は任意(未入力なら「ゲスト」)。実名入り: 名簿は変えない(null)。
    onSubmit(participantId, claimable ? name.trim() || 'ゲスト' : null)
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
          自分の番号を選びます。空き枠なら名前も付けられます。
        </p>

        {slots.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            選べる番号がありません。「新しく参加」をお使いください。
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
                {slots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {numberOf.get(p.id)}番{slotLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            {claimable ? (
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
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                この番号には「{selected?.guestName?.trim()}」さんの名前が付いています。
                名簿はそのまま、この端末でこの番号を「自分」として扱います。
              </p>
            )}
          </div>
        )}

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex items-center gap-2">
          {slots.length > 0 ? (
            <Button className="flex-1" onClick={submit} disabled={!participantId || pending}>
              {pending ? '設定中…' : claimable ? 'この番号で参加' : 'この番号を自分にする'}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            {slots.length > 0 ? 'キャンセル' : '閉じる'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
