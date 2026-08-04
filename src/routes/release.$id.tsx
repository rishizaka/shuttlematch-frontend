import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card, CardBody } from '../components/ui/Card'
import { releaseOgMeta } from '../lib/og'
import { findRelease, formatReleaseDate } from '../lib/releases'
import type { ReleaseTag } from '../lib/releases'

export const Route = createFileRoute('/release/$id')({
  // データは同梱の静的配列なので loader は同期。存在しない id は 404 として扱う。
  loader: ({ params }) => {
    const release = findRelease(params.id)
    if (!release) throw notFound()
    return release
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? releaseOgMeta(loaderData) : [],
  }),
  component: ReleaseDetailPage,
  notFoundComponent: ReleaseNotFound,
})

const TAG_TONES: Record<ReleaseTag, 'brand' | 'blue' | 'amber'> = {
  新機能: 'brand',
  改善: 'blue',
  不具合修正: 'amber',
}

/** リリースノートの詳細ページ。 */
function ReleaseDetailPage() {
  const release = Route.useLoaderData()
  return (
    <div className="space-y-6">
      <Link
        to="/releases"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        リリースノート一覧へ
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <time dateTime={release.date} className="text-sm text-slate-500">
            {formatReleaseDate(release.date)}
          </time>
          {release.tags.map((tag) => (
            <Badge key={tag} tone={TAG_TONES[tag]}>
              {tag}
            </Badge>
          ))}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-snug text-slate-900">{release.title}</h1>
      </div>

      {release.hero ? (
        <img
          src={release.hero.src}
          alt={release.hero.alt}
          width={release.hero.width}
          height={release.hero.height}
          className="w-full rounded-xl border border-slate-200 shadow-sm"
        />
      ) : null}

      <Card>
        <CardBody className="space-y-6 py-6">
          {release.sections.map((section, i) => (
            <section key={i} className="space-y-3">
              {section.heading ? (
                <h2 className="text-base font-semibold text-slate-900">{section.heading}</h2>
              ) : null}
              {section.paragraphs.map((paragraph, j) => (
                <p key={j} className="text-sm leading-relaxed text-slate-700">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}

function ReleaseNotFound() {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-slate-600">このリリースノートは見つかりませんでした。</p>
      <Link
        to="/releases"
        className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
      >
        リリースノート一覧へ
      </Link>
    </div>
  )
}
