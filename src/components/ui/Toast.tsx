import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
  /** 消える途中(退場アニメ中)。 */
  leaving?: boolean
}

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DISPLAY_MS = 2500
/** 退場アニメの長さ(styles.css の toast-out と合わせる)。 */
const LEAVE_MS = 220

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message }])
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    }, DISPLAY_MS)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, DISPLAY_MS + LEAVE_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              'pointer-events-none rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg ' +
              (t.leaving ? 'animate-toast-out' : 'animate-toast-in')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** ページ下部に短時間表示される通知を出す。ToastProvider の内側でのみ使用可能。 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
