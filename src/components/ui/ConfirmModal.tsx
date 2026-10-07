import { createPortal } from 'react-dom'
import { Button } from './Button'

/** 汎用の確認ダイアログ。「はい/いいえ」で分岐する操作に使う。 */
export function ConfirmModal({
  title,
  description,
  confirmLabel = 'はい',
  cancelLabel = 'いいえ',
  confirming = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  confirming?: boolean
  /** 破壊的操作(削除など)のとき確認ボタンを赤にする。 */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  // SSR では描画しない(クライアントで開かれる想定のモーダル)。
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="animate-announce-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="animate-announce-pop w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        <div className="mt-5 flex items-center gap-2">
          <Button
            className="flex-1"
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? '処理中…' : confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
