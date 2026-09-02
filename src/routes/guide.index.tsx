import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Card, CardBody } from '../components/ui/Card'
import { GUIDES, formatGuideDate } from '../lib/guides'

export const Route = createFileRoute('/guide/')({
  head: () => ({
    meta: [
      {
        title: 'バドミントンの試合表・ダブルスの組み方ガイド一覧 | ShuttleMatch',
      },
      {
        name: 'description',
        content:
          'バドミントンダブルスの試合表の作り方、ランダムな組み合わせの作り方、人数・コート数別の練習会の回し方をまとめたガイド一覧です。',
      },
    ],
  }),
  component: GuidePage,
})

/** ハウツー記事の一覧ページ。detail は /guide/{id} へリンクする。 */
function GuidePage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: 'ダブルス・組み合わせのShuttleMatch', to: '/' }, { label: '使い方ガイド' }]}
      />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">使い方ガイド</h1>
        <p className="text-sm text-slate-500">
          バドミントンの試合表・ダブルスの組み方に関する読み物です。
        </p>
      </div>

      <div className="space-y-3">
        {GUIDES.map((guide) => (
          <Link key={guide.id} to="/guide/$id" params={{ id: guide.id }} className="block">
            <Card className="transition hover:border-brand-300 hover:shadow">
              <CardBody className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <time dateTime={guide.date} className="text-xs text-slate-500">
                    {formatGuideDate(guide.date)}
                  </time>
                  <h2 className="mt-1.5 text-base font-semibold text-slate-900">{guide.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{guide.summary}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <p className="border-t border-slate-100 pt-4 text-sm">
        <Link to="/gym" className="font-medium text-brand-600 hover:underline">
          体育館レビューも見る
        </Link>
      </p>
    </div>
  )
}
