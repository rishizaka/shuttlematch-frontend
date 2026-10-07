import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Participant } from '../../lib/types'
import { FREE_SLOT, isClaimableSlot, VISITOR_PLACEHOLDER } from '../../lib/guests'
import { Button } from '../ui/Button'

/**
 * 番号を選んで自分に割り当てるモーダル。人数を指定して作ったルーム(番号だけ)でも、
 * 受付で名前を集めたルームでも、参加者が自分を名乗るのはこの1枚で行う。
 * <ul>
 * <li>空き枠(番号だけ / 遅刻者・ビジター / フリー)を選び、<b>名前を入れると名簿に載る</b>
 *     (rename API)。他の参加者からも「N番=誰」が見えるようになる。</li>
 * <li><b>名前は任意。</b>入れなければ名簿には触れず、この端末が自分の番号を覚えるだけ
 *     (localStorage)。番号だけで運用したい人はこちら。</li>
 * <li>すでに名前がある番号も選べる。この場合も名簿は上書きせず紐付けるだけ(重複可)。
 *     間違えて設定しても選び直すだけで直せるように、番号の指定は排他にしない。
 *     選び直して違う番号に切り替えたときは、呼び出し側(ルーム画面の submitClaim)が
 *     直前の番号を番号の表示に戻す。このモーダル自身に「解除」操作は無い
 *     (選び直しだけで元の状態に戻るので不要)。</li>
 * <li><b>自分が今すでに名乗っている番号だけは例外</b>で、実名入りでも名前欄を出す
 *     (現在の名前を初期値にする)。「名前を変更」ボタンもこのモーダルを開くので、
 *     自分の名前のタイプミス修正が名前欄なしでは行えなくなってしまうため。</li>
 * </ul>
 */
export function ClaimNumberModal({
  participants,
  myParticipantId,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  participants: Participant[]
  /** 今すでに自分が名乗っている番号(あれば初期選択にし、実名入りでも名前欄を出す)。 */
  myParticipantId?: string | null
  pending: boolean
  error?: string | null
  /** name が null のときは名簿を変更せず、この端末の番号の紐付けだけ行う。 */
  onSubmit: (participantId: string, name: string | null) => void
  onCancel: () => void
}) {
  const [participantId, setParticipantId] = useState(myParticipantId ?? '')
  // 自分が今すでに名乗っている番号に、さらに実名が付いているなら(=名前を変更)、
  // 今の名前を初期値にする。タイプミス修正のたびに全部打ち直さずに済むように。
  // 番号のまま(まだ名乗っていない)なら空欄からにする("3" のような番号表示を
  // 名前欄に出してしまわないよう isClaimableSlot で弾く)。
  const [name, setName] = useState(() => {
    const mine = participants.find((p) => p.id === myParticipantId)
    return mine && !isClaimableSlot(mine.guestName) ? (mine.guestName ?? '') : ''
  })

  if (typeof document === 'undefined') return null

  // 番号(並び順)。実名入りの番号も候補にする(名簿は上書きしない)。
  // 早退中も候補から外さない。試合表には早退中も番号が見えているのに、ここで消えると
  // 「自分の番号が無い」ように見えてしまう(復帰したい本人が名乗れなくなる)。
  // 早退の解除(在席に戻す・未開始セットへの再編成)は運営者の「復帰」操作のままで、
  // ここでの選択・命名はそれとは独立に行える。
  const numberOf = new Map<string, number>()
  participants.forEach((p, i) => numberOf.set(p.id, i + 1))
  const slots = participants

  const selected = slots.find((p) => p.id === participantId)
  // 空き枠なら名前を付けて名簿に入る。実名入りなら端末の紐付けのみ。
  // ただし自分が今すでに名乗っている番号は、実名入りでも自分の名前の編集として扱う。
  const claimable = selected
    ? isClaimableSlot(selected.guestName) || selected.id === myParticipantId
    : true

  const slotLabel = (p: Participant): string => {
    const t = p.guestName?.trim() ?? ''
    const base = (() => {
      if (t === VISITOR_PLACEHOLDER) return '遅刻者・ビジター'
      if (t === FREE_SLOT) return 'フリー'
      if (!t || /^\d+$/.test(t)) return null
      return t
    })()
    if (p.status === 'LEFT') return base ? `（早退中・${base}）` : '（早退中）'
    return base ? `（${base}）` : '（空き）'
  }

  // 名前を入れたときだけ名簿に載せる。空欄のまま決定した人は「番号だけで使いたい」の
  // 意思表示なので、勝手に「ゲスト」として名簿に載せない(端末の紐付けだけ行う)。
  const claimingName = claimable ? name.trim() || null : null

  const submit = () => {
    if (!participantId || pending) return
    onSubmit(participantId, claimingName)
  }

  return createPortal(
    <div
      className="animate-announce-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="自分の番号を設定"
    >
      <div className="animate-announce-pop w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">あなたの番号は？</h2>
        <p className="mt-1 text-sm text-slate-500">
          自分の番号を選ぶと、試合表であなたの試合が強調表示されます。
        </p>

        {slots.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            選べる番号がありません。運営者に空き番号を追加してもらってください。
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
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  {claimingName
                    ? '名簿に載り、ほかの参加者からも「この番号はあなた」と分かります。'
                    : '空欄のままでも設定できます。その場合は名簿に載らず、この端末が番号を覚えるだけです。'}
                </span>
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
              {pending ? '設定中…' : claimingName ? 'この名前で参加' : 'この番号にする'}
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
