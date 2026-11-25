import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'
import { ApiError, isNetworkError, roomApi } from '../lib/api'

/**
 * 短縮共有URL。/r/{共有コード} を試合表ページへリダイレクトする。
 * loader で解決するため SSR(クローラー含む)でもリダイレクトが効く。
 */
export const Route = createFileRoute('/r/$code')({
  // 短縮URLは共有用のリダイレクトで、独立した検索結果を持たせない。
  head: () => ({ meta: [{ name: 'robots', content: 'noindex,follow' }] }),
  loader: async ({ params }) => {
    // 存在しないコードは打ち間違いなどでよく来るので 404 として扱う(notFound を投げると SSR が 404 を返す)。
    // 以前はそのまま例外にしていて、サーバー障害と同じ HTTP 500 になっていた。
    const room = await roomApi.getByCode(params.code).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) throw notFound()
      throw e
    })
    throw redirect({
      to: '/rooms/$roomId/matches',
      params: { roomId: room.id },
      replace: true,
    })
  },
  component: () => null,
  notFoundComponent: ShortUrlNotFound,
  errorComponent: ShortUrlError,
})

function ShortUrlNotFound() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-600">このリンクのランダム表が見つかりませんでした。</p>
      <p className="mt-1 text-xs text-slate-500">URLが正しいか確認してください。</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        TOPへ戻る
      </Link>
    </div>
  )
}

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
  // 404 は notFoundComponent に行くので、ここに来るのはサーバー側の失敗など。
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-600">ランダム表を開けませんでした。</p>
      <p className="mt-1 text-xs text-slate-500">時間をおいてもう一度開いてください。</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        TOPへ戻る
      </Link>
    </div>
  )
}
