import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Card, CardBody } from '../components/ui/Card'
import { CreateRoomCta } from '../components/ui/CreateRoomCta'
import { guideOgMeta, SITE_NAME, SITE_ORIGIN } from '../lib/og'
import { GUIDE_AUTHOR, GUIDES, findGuide, formatGuideDate } from '../lib/guides'

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
  const related = (guide.relatedGuideIds ?? [])
    .map((id) => GUIDES.find((g) => g.id === id))
    .filter((g) => g != null)
  return (
    <div className="space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: guide.title,
            description: guide.summary,
            datePublished: guide.date,
            dateModified: guide.date,
            inLanguage: 'ja',
            mainEntityOfPage: `${SITE_ORIGIN}/guide/${guide.id}`,
            author: { '@type': 'Organization', name: GUIDE_AUTHOR, url: `${SITE_ORIGIN}/about` },
            publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_ORIGIN },
          }),
        }}
      />
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
        <p className="mt-2 text-xs text-slate-500">
          執筆:{' '}
          <Link to="/about" className="font-medium text-brand-600 hover:underline">
            {GUIDE_AUTHOR}
          </Link>
        </p>
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

      {related.length > 0 ? (
        <Card>
          <CardBody className="space-y-2 py-4">
            <h2 className="text-sm font-semibold text-slate-800">関連記事</h2>
            <ul className="space-y-1.5">
              {related.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/guide/$id"
                    params={{ id: g.id }}
                    className="text-sm font-medium text-brand-600 hover:underline"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

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
