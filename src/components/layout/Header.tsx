import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'
import { History, Home, Menu, X } from 'lucide-react'

/**
 * サイト共通ヘッダー。ロゴとハンバーガーメニューのみ。
 * メニューは背景を暗くするオーバーレイ付きの右ドロワー(モーダル風)。
 * ログイン/新規登録は当面サービスとして提供しないため導線を出さない
 * (ページ・APIは残してある。再開時はメニューに項目を戻す)。
 */
export function Header() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  // メニュー表示中は背面ページのスクロールをロックする。
  useEffect(() => {
    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center" onClick={close}>
          <img
            src="/header-logo.png"
            alt="ShuttleMatch"
            className="h-8 w-auto"
            width={437}
            height={96}
          />
        </Link>

        <button
          type="button"
          aria-label="メニュー"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* open は クライアント操作でのみ true になるため、SSR で createPortal は実行されない。 */}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="メニュー">
              <button
                type="button"
                aria-label="メニューを閉じる"
                onClick={close}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
              />
              <div className="absolute right-0 top-0 flex h-full w-64 max-w-[80%] flex-col bg-white p-4 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">メニュー</span>
                  <button
                    type="button"
                    aria-label="閉じる"
                    onClick={close}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  <Link
                    to="/"
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Home className="h-4 w-4 text-slate-400" />
                    TOP
                  </Link>
                  <Link
                    to="/past"
                    onClick={close}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <History className="h-4 w-4 text-slate-400" />
                    過去の開催
                  </Link>
                </nav>
              </div>
            </div>,
            document.body,
          )
        : null}
    </header>
  )
}
