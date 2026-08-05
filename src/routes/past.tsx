import { createFileRoute } from '@tanstack/react-router'
import { useRoomList } from '../hooks/queries'
import { useMyRoomIdByPublicId } from '../hooks/useMyRoomIds'
import { Card, CardBody } from '../components/ui/Card'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { RoomCard } from '../components/room/RoomCard'
import type { PublicRoom } from '../lib/types'

export const Route = createFileRoute('/past')({
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
        <p className="text-sm text-slate-500">終了したルームの一覧です。試合表は記録として閲覧できます。</p>
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
            <p className="text-sm text-slate-500">過去のルームはまだありません。</p>
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
