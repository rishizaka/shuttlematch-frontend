import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * /guide 配下(一覧・詳細)の共通レイアウト。
 *
 * ファイル名を guide.tsx / guide.$id.tsx と同じプレフィックスで揃えたため、
 * TanStack Router は guide.tsx を「/guide 配下のレイアウトルート」として扱う。
 * このファイル自身はコンテンツを持たず Outlet を返すだけにし、実際の一覧ページは
 * guide.index.tsx(/guide のインデックスルート)に置く。ここに一覧の中身を書くと、
 * 詳細ページ(/guide/$id)は URL だけ変わって画面が一覧のまま固まる
 * (Outlet が無いレイアウトルートの下では子ルートが描画されない)。
 */
export const Route = createFileRoute('/guide')({
  component: () => <Outlet />,
})
