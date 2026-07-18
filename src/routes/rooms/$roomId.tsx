import { createFileRoute, redirect } from '@tanstack/react-router'

// ルーム詳細ページは廃止した。運営者は試合表の運営メニューで、参加者は試合表だけで
// 完結する。旧 URL(ブックマーク・OGP リンク・履歴)は試合表へリダイレクトする。
export const Route = createFileRoute('/rooms/$roomId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/rooms/$roomId/matches',
      params: { roomId: params.roomId },
      search: { openExternalBrowser: 1 },
      replace: true,
    })
  },
})
