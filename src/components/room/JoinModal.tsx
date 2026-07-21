import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'

/**
 * 受付モードで名前を入れて参加するモーダル。参加すると番号が自動採番される。
 * 生成後(遅刻)の自己参加にも使う。
 */
export function JoinModal({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean
  error?: string | null
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')

  if (typeof document === 'undefined') return null

  const submit = () => {
    if (name.trim() && !pending) onSubmit(name.trim())
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="参加する"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">参加する</h2>
        <p className="mt-1 text-sm text-slate-500">
          名前を入れると番号が自動で割り振られます。
        </p>
        <input
          type="text"
          value={name}
          maxLength={30}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="あなたの名前"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex items-center gap-2">
          <Button className="flex-1" onClick={submit} disabled={!name.trim() || pending}>
            {pending ? '参加中…' : '参加する'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
