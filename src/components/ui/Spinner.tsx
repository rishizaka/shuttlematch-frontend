import { Loader2, RotateCw } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden />
}

export function LoadingBlock({ label = '読み込み中…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-500" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      {message}
      {onRetry ? (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            <RotateCw className="h-3.5 w-3.5" />
            再試行
          </button>
        </div>
      ) : null}
    </div>
  )
}
