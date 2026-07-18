import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, History, Plus } from 'lucide-react'
import { useRoomList } from '../hooks/queries'
import { Card, CardBody } from '../components/ui/Card'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { RoomCard } from '../components/room/RoomCard'
import { jstDayRange } from '../lib/format'
import { ogImageMeta } from '../lib/og'
import type { Room } from '../lib/types'

export const Route = createFileRoute('/')({
  // OG 画像はルート共通ではなくページ側 opt-in(試合表には出さないため)。
  head: () => ({ meta: ogImageMeta() }),
  component: HomePage,
})

function HomePage() {
  // TOP は本日の開催のみ。サーバ側で開催日時を絞り込み、1リクエストで取得する。
  const { from, to } = jstDayRange()
  const today = useRoomList({ heldFrom: from, heldTo: to })

  const byHeldAtDesc = (a: Room, b: Room) => (a.heldAt < b.heldAt ? 1 : -1)
  const rooms = today.data ?? []
  const active = rooms.filter((r) => r.status !== 'CLOSED').sort(byHeldAtDesc)
  const closedToday = rooms.filter((r) => r.status === 'CLOSED').sort(byHeldAtDesc)

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

      {today.isLoading ? (
        <LoadingBlock />
      ) : today.error ? (
        <ErrorBlock
          message={
            today.error instanceof Error ? today.error.message : '一覧を取得できませんでした'
          }
        />
      ) : (
        <>
          {rooms.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">本日のルームはまだありません。</p>
              </CardBody>
            </Card>
          ) : null}

          {active.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">開催中</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((s) => (
                  <RoomCard key={s.id} room={s} />
                ))}
              </div>
            </section>
          ) : null}

          {closedToday.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">終了済み</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {closedToday.map((s) => (
                  <RoomCard key={s.id} room={s} />
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
