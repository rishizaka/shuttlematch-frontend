import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useSessionList } from '../hooks/queries'
import { Card, CardBody } from '../components/ui/Card'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { SessionCard } from '../components/session/SessionCard'
import type { Session } from '../lib/types'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  // 開催中 = 募集中(OPEN) + 試合表生成済み(GENERATED)。過去 = 終了済み(CLOSED)。
  const open = useSessionList('OPEN')
  const generated = useSessionList('GENERATED')
  const closed = useSessionList('CLOSED')

  const active: Session[] = [...(open.data ?? []), ...(generated.data ?? [])].sort(
    (a, b) => (a.heldAt < b.heldAt ? 1 : -1),
  )
  const past: Session[] = (closed.data ?? []).slice().sort((a, b) => (a.heldAt < b.heldAt ? 1 : -1))

  const loading = open.isLoading || generated.isLoading || closed.isLoading
  const error = open.error ?? generated.error ?? closed.error

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ルーム</h1>
          <p className="text-sm text-slate-500">練習会ごとにルームを作って試合表を共有します。</p>
        </div>
        <Link
          to="/organizer/sessions/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          ルームを作成
        </Link>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error instanceof Error ? error.message : '一覧を取得できませんでした'} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">開催中</h2>
            {active.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="text-sm text-slate-500">開催中のルームはありません。</p>
                </CardBody>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">過去</h2>
            {past.length === 0 ? (
              <p className="text-sm text-slate-400">過去のルームはまだありません。</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {past.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
