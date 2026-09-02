import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * /gym 配下(一覧・詳細)の共通レイアウト。
 *
 * ファイル名を gym.tsx / gym.$id.tsx と同じプレフィックスで揃えているため、
 * TanStack Router は gym.tsx を「/gym 配下のレイアウトルート」として扱う。
 * ここにコンテンツを書くと詳細ページ(/gym/$id)は URL だけ変わって画面が一覧のまま
 * 固まる(guide.tsx で実際に踏んだ不具合と同じ)ため、このファイルは Outlet だけを返し、
 * 一覧の中身は gym.index.tsx に置く。
 */
export const Route = createFileRoute('/gym')({
  component: () => <Outlet />,
})
