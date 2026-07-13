import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { roomApi } from '../lib/api'

/**
 * 短縮共有URL。/r/{共有コード} を試合表ページへリダイレクトする。
 * loader で解決するため SSR(クローラー含む)でもリダイレクトが効く。
 */
export const Route = createFileRoute('/r/$code')({
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

function ShortUrlError() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-600">このリンクのルームが見つかりませんでした。</p>
      <p className="mt-1 text-xs text-slate-400">URLが正しいか確認してください。</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:underline">
        TOPへ戻る
      </Link>
    </div>
  )
}
