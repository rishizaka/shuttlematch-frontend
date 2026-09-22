import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, History, Plus } from 'lucide-react'
import { useRoomList } from '../hooks/queries'
import { useMyRoomIdByPublicId } from '../hooks/useMyRoomIds'
import { Card, CardBody } from '../components/ui/Card'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { RoomCard } from '../components/room/RoomCard'
import { DoublesPracticePlanner } from '../components/home/DoublesPracticePlanner'
import { jstDayRange } from '../lib/format'
import type { PublicRoom } from '../lib/types'

export const Route = createFileRoute('/')({
  // TOP は検索の入口なので、ルート既定のメタに任せず、何をする道具なのかを書く。
  // 「乱数表」はこの道具の実体を指す固有の言葉で、検索で最も当てたい語。
  // 「組み合わせ表」も併記する(検索でよく使われる表記だが、これまで本文に
  // 一度も出ていなかった)。「自動作成」は誰でも名乗れる一般的な文言なので、
  // タイトルの締めからは外し、本文側の説明に軽く残す程度にする。
  // 他サイトの同種ページも「ダブルス組み合わせ表」を助詞なしの複合語で書いており、
  // それに合わせている。
  head: () => ({
    meta: [
      {
        title: 'バドミントンの乱数表・ダブルス組み合わせ表を無料作成 | ShuttleMatch',
      },
      {
        name: 'description',
        content:
          'バドミントンの乱数表(ダブルスの組み合わせ表)を、人数とコート数を入れるだけで作れる無料ツール。出場回数は公平に、同じ顔ぶれで固まらないように混ぜます。テニスなど4人1組で回す練習にも使えます。',
      },
    ],
  }),
  component: HomePage,
})

function HomePage() {
  // 開催中は日付で絞らず、終了していないルームをすべて出す。
  // heldAt は作成した時刻で固定され後から直せないので、前日の夜に作って翌日使う
  // ような場合に「開催中なのに TOP に出ない」ことが起きていた。
  // 終了済みは本日ぶんだけ(それ以前は /past にある)。
  const all = useRoomList()
  // 一覧に roomId は入っていない。自分が作成・参加したルームだけリンクになる。
  const myRoomIds = useMyRoomIdByPublicId()

  const byHeldAtDesc = (a: PublicRoom, b: PublicRoom) => (a.heldAt < b.heldAt ? 1 : -1)
  const rooms = all.data ?? []
  const active = rooms.filter((r) => r.status !== 'CLOSED').sort(byHeldAtDesc)
  const { from, to } = jstDayRange()
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  const closedToday = rooms
    .filter((r) => {
      if (r.status !== 'CLOSED') return false
      const heldAt = Date.parse(r.heldAt)
      return heldAt >= fromMs && heldAt < toMs
    })
    .sort(byHeldAtDesc)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* title だけでなく、画面で最初に読める h1 にも検索する人の言葉を置く。
              「組み合わせ表を作る」という目的を先に示すことで、初めて来た人にも
              ここが開催中ルームの一覧だけではなく、作成ツールであることが伝わる。 */}
          <h1 className="text-2xl font-bold text-slate-900">
            バドミントンのダブルス組み合わせ表を無料で作成
          </h1>
          <p className="text-sm text-slate-500">
            人数とコート数を入れるだけ。作った試合表はリンクとQRコードで共有できます。
          </p>
        </div>
        <Link
          to="/organizer/rooms/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          組み合わせ表を作る
        </Link>
      </div>

      <DoublesPracticePlanner />

      {all.isLoading ? (
        <LoadingBlock />
      ) : all.error ? (
        <ErrorBlock
          message={all.error instanceof Error ? all.error.message : '一覧を取得できませんでした'}
          onRetry={() => void all.refetch()}
        />
      ) : (
        <>
          {active.length === 0 && closedToday.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">開催中のルームはありません。</p>
              </CardBody>
            </Card>
          ) : null}

          {active.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">開催中</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((s) => (
                  <RoomCard key={s.publicId} room={s} roomId={s.id ?? myRoomIds.get(s.publicId)} />
                ))}
              </div>
            </section>
          ) : null}

          {closedToday.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">終了済み</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {closedToday.map((s) => (
                  <RoomCard key={s.publicId} room={s} roomId={s.id ?? myRoomIds.get(s.publicId)} />
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

      <SiteIntro />
    </div>
  )
}

/**
 * 検索から来た人に「これは何をする道具か」を伝える説明。
 *
 * 毎回使う運営者にとってはルーム一覧だけが用なので、いちばん下に小さく置く。
 * 文字を減らすと検索の受け皿にならないため、量は保ちつつ密度を下げてある。
 */
function SiteIntro() {
  return (
    <section className="border-t border-slate-100 pt-6 text-sm leading-relaxed text-slate-500">
      <h2 className="text-base font-semibold text-slate-700">
        バドミントンの乱数表(ダブルスの組み合わせ表)を、その場で作れます
      </h2>
      <p className="mt-2">
        「乱数表」は、ダブルス練習で誰と誰が同じコートに入るかをセットごとにまとめた表で、
        「組み合わせ表」とも呼ばれます。紙に手で書いたり前回の表を使い回したりして作られてきましたが、
        人数が増えるほど、出場回数を揃えながら顔ぶれも混ぜるのは手作業ではむずかしくなります。
      </p>
      <p className="mt-2">
        ShuttleMatchなら、人数とコート数を入れるだけでこの乱数表を作れます。
        できた試合表はリンクやQRコードで配れるので、参加者は自分がいつ・どのコートに入るかを各自のスマホで見られます。
      </p>
      <h3 className="mt-5 font-semibold text-slate-700">回数は公平に、顔ぶれは混ぜて</h3>
      <p className="mt-2">
        出場回数の差は常に1回以内に収まります。
        そのうえで「また同じ4人」にならないよう、誰と同じコートに入ったかを記録しながら組み合わせを選びます。
        遅刻・早退・途中参加があっても、まだ始めていないセットだけを組み直せます。
      </p>
      <h3 className="mt-5 font-semibold text-slate-700">テニスなど他の競技でも</h3>
      <p className="mt-2">
        乱数表の作り方は「4人で1コートを回す」ことだけを前提にしているので、
        テニスのダブルス練習など、同じ形で回す競技にもそのまま使えます。
        画面の言葉はバドミントン向けですが、番号とコートで運用するぶんには競技を選びません。
      </p>
      <p className="mt-5">
        <Link to="/about" className="font-medium text-brand-600 hover:underline">
          仕組みをもっと詳しく見る
        </Link>
        <span className="mx-2 text-slate-300">|</span>
        <Link
          to="/guide/$id"
          params={{ id: 'ten-players-two-courts-doubles-example' }}
          className="font-medium text-brand-600 hover:underline"
        >
          10人・2面の具体例を見る
        </Link>
        <span className="mx-2 text-slate-300">|</span>
        <Link to="/guide" className="font-medium text-brand-600 hover:underline">
          試合表の作り方ガイドを見る
        </Link>
      </p>
    </section>
  )
}
