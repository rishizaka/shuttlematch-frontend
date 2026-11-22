import { createFileRoute } from '@tanstack/react-router'
import { queryKeys } from '../../hooks/queries'
import { matchApi, roomApi } from '../../lib/api'
import type { Room } from '../../lib/types'
import { roomOgMeta } from '../../lib/og'
import { MatchesSkeleton } from '../../features/match-schedule'
import { MatchesPage } from '../../features/matches-page'

// 試合表ページのルーティング(検索パラメータ・SSR の loader・OGP)。画面と操作は features/matches-page。
export const Route = createFileRoute('/rooms/$roomId_/matches')({
  // LINE 等のアプリ内ブラウザから既定ブラウザで開かせるためのパラメータ。
  // リンク/アドレスバー共有時に URL へ残るよう、ルートの検索パラメータとして扱う。
  validateSearch: (search: Record<string, unknown>): { openExternalBrowser?: 1 } => ({
    openExternalBrowser:
      search.openExternalBrowser === 1 || search.openExternalBrowser === '1' ? 1 : undefined,
  }),
  // OGP(SNS のリンクカード)用。SSR の HTML にルーム名入りメタタグを含める。
  // あわせてルームと試合表を Query のキャッシュへ先に入れておく。SSR の HTML に試合表そのものが
  // 載り、ブラウザで JS が動いてから取りに行くのを待たずに済む(以前は SSR では骨組みだけで、
  // モバイル計測で LCP が 4.8 秒かかっていた)。キャッシュは SSR 連携でブラウザへ引き継がれ、
  // 以降のポーリングは useMatches / useRoom がそのまま続ける。
  loader: async ({ params, context }) => {
    const qc = context.queryClient
    let room: Room
    try {
      room = await qc.fetchQuery({
        queryKey: queryKeys.room(params.roomId),
        queryFn: () => roomApi.get(params.roomId),
      })
    } catch {
      return null
    }
    // 未生成(受付中)は 404 になるので取りに行かない。prefetchQuery は失敗しても投げない。
    if (room.status === 'GENERATED' || room.status === 'CLOSED') {
      await qc.prefetchQuery({
        queryKey: queryKeys.matches(params.roomId),
        queryFn: () => matchApi.get(params.roomId),
        retry: false,
      })
    }
    return room
  },
  // 試合表のリンクカードは画像なし(テキストのみ)。リンクでよく共有するため、
  // og:image は足さず、twitter:card も設定しない。
  // (twitter:card=summary を付けると画像枠を要求され、og:image が無いときに
  //  サイトアイコン(favicon)をサムネイルとして拾われてノイズになる)
  head: ({ loaderData, params }) => {
    // 共有用の試合表は練習会ごとに増え、公開していても検索流入の着地点には向かない。
    // 個別ページをインデックスさせず、検索評価はTOP・ガイド・サービス紹介に集約する。
    const robots = { name: 'robots', content: 'noindex,follow' }
    return loaderData
      ? { meta: [...roomOgMeta(loaderData, `/rooms/${params.roomId}/matches`, '試合表'), robots] }
      : { meta: [robots] }
  },
  // ルーム一覧などから遷移してきて loader を待つあいだ。初回表示(SSR)の待ちは
  // コンポーネント側の MatchesSkeleton が受け持つ。
  pendingComponent: () => <MatchesSkeleton />,
  component: MatchesRoute,
})

function MatchesRoute() {
  const { roomId } = Route.useParams()
  const seed = Route.useLoaderData()
  return <MatchesPage roomId={roomId} seed={seed} />
}
