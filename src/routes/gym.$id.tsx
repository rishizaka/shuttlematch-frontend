import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ExternalLink, MapPin, Train } from 'lucide-react'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Card, CardBody } from '../components/ui/Card'
import { gymOgMeta } from '../lib/og'
import { findGym, formatGymDate } from '../lib/gyms'

export const Route = createFileRoute('/gym/$id')({
  // データは同梱の静的配列なので loader は同期。存在しない id は 404 として扱う。
  loader: ({ params }) => {
    const gym = findGym(params.id)
    if (!gym) throw notFound()
    return gym
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? gymOgMeta(loaderData) : [],
  }),
  component: GymDetailPage,
  notFoundComponent: GymNotFound,
})

/** 体育館レビューの詳細ページ。 */
function GymDetailPage() {
  const gym = Route.useLoaderData()
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: 'TOP', to: '/' }, { label: '体育館レビュー', to: '/gym' }, { label: gym.name }]}
      />

      <div>
        <time dateTime={gym.date} className="text-sm text-slate-500">
          {formatGymDate(gym.date)}
        </time>
        <h1 className="mt-2 text-2xl font-bold leading-snug text-slate-900">{gym.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {gym.prefecture}
          {gym.city} ・ コート{gym.courtCount}面
        </p>
      </div>

      <Card>
        <CardBody className="space-y-2 py-4 text-sm text-slate-700">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {gym.address}
          </p>
          <p className="flex items-start gap-2">
            <Train className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {gym.access}
          </p>
          <p className="flex items-start gap-2">
            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <a
              href={gym.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              公式サイトで料金・予約方法を確認する
            </a>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-6 py-6">
          {gym.sections.map((section, i) => (
            <section key={i} className="space-y-3">
              {section.heading ? (
                <h2 className="text-base font-semibold text-slate-900">{section.heading}</h2>
              ) : null}
              {section.paragraphs.map((paragraph, j) => (
                <p key={j} className="text-sm leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-1.5 pl-5">
                  {section.bullets.map((bullet, j) => (
                    <li key={j} className="text-sm leading-relaxed text-slate-700">
                      {bullet}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}

function GymNotFound() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-600">このレビューは見つかりませんでした。</p>
      <Link to="/gym" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        体育館レビュー一覧へ
      </Link>
    </div>
  )
}
