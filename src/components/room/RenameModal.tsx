import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'

/**
 * 自分のニックネームを変更するモーダル(受付モード)。
 * 名前は任意。未入力なら「ゲスト」になる。
 */
export function RenameModal({
  currentName,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  currentName?: string
  pending: boolean
  error?: string | null
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(currentName ?? '')

  if (typeof document === 'undefined') return null

  const submit = () => {
    if (!pending) onSubmit(name.trim() || 'ゲスト')
  }

  return createPortal(
    <div
      className="animate-announce-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="名前を変更"
    >
      <div className="animate-announce-pop w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">名前を変更</h2>
        <p className="mt-1 text-sm text-slate-500">
          ニックネームを変更します（任意）。未入力なら「ゲスト」になります。
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
          placeholder="あなたの名前（任意）"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex items-center gap-2">
          <Button className="flex-1" onClick={submit} disabled={pending}>
            {pending ? '変更中…' : '変更する'}
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
