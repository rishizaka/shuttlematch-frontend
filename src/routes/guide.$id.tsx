import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Card, CardBody } from '../components/ui/Card'
import { CreateRoomCta } from '../components/ui/CreateRoomCta'
import { guideOgMeta } from '../lib/og'
import { findGuide, formatGuideDate } from '../lib/guides'

export const Route = createFileRoute('/guide/$id')({
  // データは同梱の静的配列なので loader は同期。存在しない id は 404 として扱う。
  loader: ({ params }) => {
    const guide = findGuide(params.id)
    if (!guide) throw notFound()
    return guide
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? guideOgMeta(loaderData) : [],
  }),
  component: GuideDetailPage,
  notFoundComponent: GuideNotFound,
})

/** ハウツー記事の詳細ページ。 */
function GuideDetailPage() {
  const guide = Route.useLoaderData()
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'ダブルス・組み合わせのShuttleMatch', to: '/' },
          { label: '使い方ガイド', to: '/guide' },
          { label: guide.title },
        ]}
      />

      <div>
        <time dateTime={guide.date} className="text-sm text-slate-500">
          {formatGuideDate(guide.date)}
        </time>
        <h1 className="mt-2 text-2xl font-bold leading-snug text-slate-900">{guide.title}</h1>
      </div>

      <Card>
        <CardBody className="space-y-6 py-6">
          {guide.sections.map((section, i) => (
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

      <CreateRoomCta />
    </div>
  )
}

function GuideNotFound() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-600">この記事は見つかりませんでした。</p>
      <Link to="/guide" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        ガイド一覧へ
      </Link>
    </div>
  )
}
