import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, MapPin } from 'lucide-react'
import { Card, CardBody } from '../components/ui/Card'
import { GYMS, formatGymDate } from '../lib/gyms'

export const Route = createFileRoute('/gym/')({
  head: () => ({
    meta: [
      { title: 'バドミントンが使える体育館レビュー一覧 | ShuttleMatch' },
      {
        name: 'description',
        content:
          '運営者が実際にダブルス練習会で使った体育館のレビュー一覧です。アクセス・コート数・料金の目安と、現地で気づいたポイントをまとめています。',
      },
    ],
  }),
  component: GymListPage,
})

/** 体育館レビューの一覧ページ。detail は /gym/{id} へリンクする。 */
function GymListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">体育館レビュー</h1>
        <p className="text-sm text-slate-500">
          バドミントンのダブルス練習会で実際に使った体育館のレビューです。
        </p>
      </div>

      <div className="space-y-3">
        {GYMS.map((gym) => (
          <Link key={gym.id} to="/gym/$id" params={{ id: gym.id }} className="block">
            <Card className="transition hover:border-brand-300 hover:shadow">
              <CardBody className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <time dateTime={gym.date} className="text-xs text-slate-500">
                    {formatGymDate(gym.date)}
                  </time>
                  <h2 className="mt-1.5 text-base font-semibold text-slate-900">{gym.name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {gym.prefecture}
                    {gym.city} ・ コート{gym.courtCount}面
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{gym.summary}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
