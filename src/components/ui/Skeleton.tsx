import { cn } from '../../lib/cn'

/**
 * 読み込み中の場所取りに置く灰色の板。大きさと角丸は呼び出し側で決める。
 *
 * ちらつきの元になるので、点滅(animate-pulse)は板ごとに掛けず、
 * 骨組み全体をくるむ親に一度だけ掛けること。
 */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('block rounded bg-slate-200', className)} aria-hidden />
}
