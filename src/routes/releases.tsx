import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Card, CardBody } from '../components/ui/Card'
import { RELEASES, formatReleaseDate } from '../lib/releases'
import type { ReleaseTag } from '../lib/releases'

export const Route = createFileRoute('/releases')({
  head: () => ({
    meta: [
      { title: 'リリースノート — ShuttleMatch' },
      {
        name: 'description',
        content: 'ShuttleMatch の新機能・改善・不具合修正のお知らせ一覧です。',
      },
    ],
  }),
  component: ReleasesPage,
})

const TAG_TONES: Record<ReleaseTag, 'brand' | 'blue' | 'amber'> = {
  新機能: 'brand',
  改善: 'blue',
  不具合修正: 'amber',
}

/** リリースノートの一覧ページ。新しい順に並べ、詳細(/release/{id})へリンクする。 */
function ReleasesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">リリースノート</h1>
        <p className="text-sm text-slate-500">ShuttleMatch の新機能・改善のお知らせです。</p>
      </div>

      {RELEASES.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">リリースノートはまだありません。</p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {RELEASES.map((release) => (
            <Link
              key={release.id}
              to="/release/$id"
              params={{ id: release.id }}
              className="block"
            >
              <Card className="transition hover:border-brand-300 hover:shadow">
                <CardBody className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <time dateTime={release.date} className="text-xs text-slate-500">
                        {formatReleaseDate(release.date)}
                      </time>
                      {release.tags.map((tag) => (
                        <Badge key={tag} tone={TAG_TONES[tag]}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <h2 className="mt-1.5 text-base font-semibold text-slate-900">
                      {release.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {release.summary}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
