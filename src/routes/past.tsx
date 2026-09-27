import { createFileRoute } from '@tanstack/react-router'
import { useRoomList } from '../hooks/queries'
import { useMyRoomIdByPublicId } from '../hooks/useMyRoomIds'
import { Card, CardBody } from '../components/ui/Card'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { RoomCard } from '../components/room/RoomCard'
import type { PublicRoom } from '../lib/types'

export const Route = createFileRoute('/past')({
  // 指定しないとルート既定(TOPと同じ)になり、中身の違うページに同じ title と
  // description が並ぶ。
  head: () => ({
    meta: [
      { title: '過去の開催 — バドミントン練習会の試合表の記録 | ShuttleMatch' },
      {
        name: 'description',
        content:
          'これまでに ShuttleMatch で作られたバドミントン練習会の試合表(ダブルスの組み合わせ)の記録です。終了した試合表は誰でも見られます。',
      },
    ],
  }),
  component: PastRoomsPage,
})

/** 過去の開催(終了済みルーム全件)の一覧ページ。ハンバーガーメニューから遷移する。 */
function PastRoomsPage() {
  const closed = useRoomList({ status: 'CLOSED' })
  // 一覧に roomId は入っていない。自分が作成・参加したルームだけリンクになる。
  const myRoomIds = useMyRoomIdByPublicId()

  const past: PublicRoom[] = (closed.data ?? [])
    .slice()
    .sort((a, b) => (a.heldAt < b.heldAt ? 1 : -1))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">過去の開催</h1>
        <p className="text-sm text-slate-500">終了したランダム表の一覧です。試合表は記録として閲覧できます。</p>
      </div>

      {closed.isLoading ? (
        <LoadingBlock />
      ) : closed.error ? (
        <ErrorBlock
          message={
            closed.error instanceof Error ? closed.error.message : '一覧を取得できませんでした'
          }
          onRetry={() => void closed.refetch()}
        />
      ) : past.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">過去のランダム表はまだありません。</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {past.map((s) => (
            <RoomCard key={s.publicId} room={s} roomId={s.id ?? myRoomIds.get(s.publicId)} />
          ))}
        </div>
      )}
    </div>
  )
}
