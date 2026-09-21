import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { isNetworkError, roomApi } from '../lib/api'

/**
 * 短縮共有URL。/r/{共有コード} を試合表ページへリダイレクトする。
 * loader で解決するため SSR(クローラー含む)でもリダイレクトが効く。
 */
export const Route = createFileRoute('/r/$code')({
  // 短縮URLは共有用のリダイレクトで、独立した検索結果を持たせない。
  head: () => ({ meta: [{ name: 'robots', content: 'noindex,follow' }] }),
  loader: async ({ params }) => {
    const room = await roomApi.getByCode(params.code)
    throw redirect({
      to: '/rooms/$roomId/matches',
      params: { roomId: room.id },
      replace: true,
    })
  },
  component: () => null,
  errorComponent: ShortUrlError,
})

function ShortUrlError({ error }: { error: unknown }) {
  // ネットワーク断は「リンクが間違っている」ではないので、文言を分けてリロードを促す。
  // loader で解決するページなので、再試行はページのリロードがそのまま再フェッチになる。
  if (isNetworkError(error)) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-slate-600">
          ネットワークに繋がらないようです。通信環境を確認してください。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <RotateCw className="h-4 w-4" />
          再読み込み
        </button>
      </div>
    )
  }
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-600">このリンクのルームが見つかりませんでした。</p>
      <p className="mt-1 text-xs text-slate-400">URLが正しいか確認してください。</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        TOPへ戻る
      </Link>
    </div>
  )
}
