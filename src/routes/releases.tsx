import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Card, CardBody } from '../components/ui/Card'
import { cn } from '../lib/cn'
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
      <Breadcrumbs
        items={[{ label: 'ダブルス・組み合わせのShuttleMatch', to: '/' }, { label: 'リリースノート' }]}
      />

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
                {/* 画像があるカードは、狭い画面では見出し画像を上に回す。
                    横に並べたままだと本文が4行折り返しになって読みにくい */}
                <CardBody
                  className={cn(
                    'flex gap-4',
                    release.hero ? 'flex-col sm:flex-row sm:items-center' : 'items-center',
                  )}
                >
                  {release.hero ? (
                    <img
                      src={release.hero.thumb}
                      // 見出し画像は隣の文字で内容が分かるので、読み上げでは飛ばす
                      alt=""
                      width={release.hero.width}
                      height={release.hero.height}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/2] w-full rounded-lg object-cover sm:w-36 sm:shrink-0"
                    />
                  ) : null}
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
                  <ChevronRight
                    className={cn(
                      'h-5 w-5 shrink-0 text-slate-300',
                      // 縦積みのときは行き先を示す矢印が宙に浮くので隠す(カード全体がリンク)
                      release.hero && 'hidden sm:block',
                    )}
                  />
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
