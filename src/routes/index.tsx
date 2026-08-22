import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, History, Plus } from 'lucide-react'
import { useRoomList } from '../hooks/queries'
import { useMyRoomIdByPublicId } from '../hooks/useMyRoomIds'
import { Card, CardBody } from '../components/ui/Card'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { RoomCard } from '../components/room/RoomCard'
import { jstDayRange } from '../lib/format'
import type { PublicRoom } from '../lib/types'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  // 開催中は日付で絞らず、終了していないルームをすべて出す。
  // heldAt は作成した時刻で固定され後から直せないので、前日の夜に作って翌日使う
  // ような場合に「開催中なのに TOP に出ない」ことが起きていた。
  // 終了済みは本日ぶんだけ(それ以前は /past にある)。
  const all = useRoomList()
  // 一覧に roomId は入っていない。自分が作成・参加したルームだけリンクになる。
  const myRoomIds = useMyRoomIdByPublicId()

  const byHeldAtDesc = (a: PublicRoom, b: PublicRoom) => (a.heldAt < b.heldAt ? 1 : -1)
  const rooms = all.data ?? []
  const active = rooms.filter((r) => r.status !== 'CLOSED').sort(byHeldAtDesc)
  const { from, to } = jstDayRange()
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  const closedToday = rooms
    .filter((r) => {
      if (r.status !== 'CLOSED') return false
      const heldAt = Date.parse(r.heldAt)
      return heldAt >= fromMs && heldAt < toMs
    })
    .sort(byHeldAtDesc)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ルーム</h1>
          <p className="text-sm text-slate-500">練習会ごとにルームを作って試合表を共有します。</p>
        </div>
        <Link
          to="/organizer/rooms/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          ルームを作成
        </Link>
      </div>

      {all.isLoading ? (
        <LoadingBlock />
      ) : all.error ? (
        <ErrorBlock
          message={all.error instanceof Error ? all.error.message : '一覧を取得できませんでした'}
          onRetry={() => void all.refetch()}
        />
      ) : (
        <>
          {active.length === 0 && closedToday.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">開催中のルームはありません。</p>
              </CardBody>
            </Card>
          ) : null}

          {active.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">開催中</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((s) => (
                  <RoomCard key={s.publicId} room={s} roomId={s.id ?? myRoomIds.get(s.publicId)} />
                ))}
              </div>
            </section>
          ) : null}

          {closedToday.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">終了済み</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {closedToday.map((s) => (
                  <RoomCard key={s.publicId} room={s} roomId={s.id ?? myRoomIds.get(s.publicId)} />
                ))}
              </div>
            </section>
          ) : null}

          <div className="border-t border-slate-100 pt-4">
            <Link
              to="/past"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-700"
            >
              <History className="h-4 w-4" />
              過去の開催を見る
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
