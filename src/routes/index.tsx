import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight, History, Plus } from 'lucide-react'
import { useRoomList } from '../hooks/queries'
import { useMyRoomIdByPublicId } from '../hooks/useMyRoomIds'
import { Card, CardBody } from '../components/ui/Card'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { RoomCard, LiveDot } from '../components/room/RoomCard'
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
  // 開催中は日付で絞らず、終了していないものをすべて出す。
  // heldAt は作成した時刻で固定され後から直せないので、前日の夜に作って翌日使う
  // ような場合に「開催中なのに TOP に出ない」ことが起きていた。
  // 終了済みは本日ぶんだけ(それ以前は /past にある)。
  const all = useRoomList()
  // 一覧に roomId は入っていない。自分が作成・参加したものだけリンクになる。
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
    <div className="space-y-10">
      <Hero liveCount={active.length} />

      <section id="live" className="scroll-mt-20 space-y-4">
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
                  <p className="text-sm text-slate-500">開催中のランダム表はありません。</p>
                </CardBody>
              </Card>
            ) : null}

            {active.length > 0 ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <LiveDot className="h-2.5 w-2.5" />
                  <h2 className="jp-tight text-xl font-semibold text-slate-900">開催中</h2>
                  <span className="fig inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-500 px-2 text-[13px] text-brand-900">
                    {active.length}
                  </span>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {active.map((s) => (
                    <RoomCard key={s.publicId} room={s} roomId={s.id ?? myRoomIds.get(s.publicId)} />
                  ))}
                </div>
              </section>
            ) : null}

            {closedToday.length > 0 ? (
              <section className="space-y-4 pt-4">
                <h2 className="jp-tight text-base font-semibold text-slate-500">終了済み</h2>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {closedToday.map((s) => (
                    <RoomCard key={s.publicId} room={s} roomId={s.id ?? myRoomIds.get(s.publicId)} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="pt-1">
              <Link
                to="/past"
                className="inline-flex items-center gap-1.5 border-b-2 border-transparent pb-0.5 text-sm font-semibold text-slate-500 transition hover:border-accent-400 hover:text-slate-900"
              >
                <History className="h-4 w-4" aria-hidden />
                過去の開催を見る
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </section>

      <DoublesPracticePlanner />

      <MobileCreateDock />

      <SiteIntro />
    </div>
  )
}

/**
 * 小さい画面でだけ下に居座る作成ボタン。
 *
 * ヘッダーのナビゲーションは `lg` 未満でハンバーガーに畳まれるので、モバイルでは
 * 「乱数表をつくる」が画面から消えてしまう。その穴を埋めるためのもの。
 *
 * ただし本文まで読み進めたら引っ込める。フッターのプライバシーポリシー・利用規約へは
 * 全ページから1クリックで到達できる必要があり(広告配信事業者の審査要件)、
 * 固定したままだとその導線に重なってしまう。
 */
function MobileCreateDock() {
  const [reachedIntro, setReachedIntro] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const target = sentinelRef.current
    // SSR と、IntersectionObserver を持たない環境では出したままにする。
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setReachedIntro(entry.isIntersecting)
      },
      {
        // 上方向に判定範囲を大きく広げ、「目印に到達した**以降ずっと**交差している」
        // 状態を作る。素の設定だと、目印が画面の上へ抜けても isIntersecting は false の
        // ままで変化が無いため**コールバックが一度も呼ばれず**、最下部まで一気に送ったときに
        // ボタンがフッターの規約リンクを覆い続けてしまう(実際にそうなっていた)。
        rootMargin: '100000px 0px 0px 0px',
      },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} className="h-px" aria-hidden />
      <div
        className={
          'fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 px-4 pt-3 ' +
          'pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur transition-opacity sm:hidden ' +
          (reachedIntro ? 'pointer-events-none opacity-0' : 'opacity-100')
        }
      >
        <Link
          to="/organizer/rooms/new"
          tabIndex={reachedIntro ? -1 : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-brand-900 shadow-md transition-colors hover:bg-accent-400"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
          乱数表をつくる
        </Link>
      </div>
    </>
  )
}

/**
 * 最初に目に入る一枚。この道具が何で、何ができるのかを濃紺の面に置く。
 *
 * 全幅にはしない — `__root.tsx` が本文を `max-w-5xl px-4` で包んでいるので、
 * はみ出させるには負のマージンが要る。角丸の面として見せるほうが素直で、
 * 他のページと余白の取り方も揃う。
 */
function Hero({ liveCount }: { liveCount: number }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-brand-800 px-6 py-9 text-white sm:px-10 sm:py-14">
      {/* 体育館の照明のような光。奥行きを出すだけなので操作は透過させる。 */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(115%_85%_at_78%_-15%,rgba(255,255,255,0.16),transparent_62%)]"
        aria-hidden
      />
      {/* コートの線。地紋なので薄く、右下から流し込む。
          狭い画面では本文の裏に回り込んで読みにくくなるので出さない。 */}
      <svg
        className="pointer-events-none absolute -bottom-24 -right-16 hidden w-[430px] opacity-[0.13] sm:block sm:w-[520px]"
        viewBox="0 0 400 300"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="30" y="20" width="340" height="260" />
        <rect x="52" y="20" width="296" height="260" />
        <line x1="30" y1="150" x2="370" y2="150" strokeWidth="3" />
        <line x1="30" y1="70" x2="370" y2="70" />
        <line x1="30" y1="230" x2="370" y2="230" />
        <line x1="200" y1="20" x2="200" y2="70" />
        <line x1="200" y1="230" x2="200" y2="280" />
      </svg>

      <div className="relative max-w-2xl">
        <p className="mb-4 flex items-center gap-2 text-accent-200">
          {liveCount > 0 ? <LiveDot className="h-2.5 w-2.5" /> : null}
          <span className="lbl text-[10.5px]">
            {liveCount > 0 ? `開催中 ${liveCount} 件 · 登録なしで使える` : '登録なしで使える'}
          </span>
        </p>

        {/* title だけでなく、画面で最初に読める h1 にも検索する人の言葉を置く。
            「組み合わせ表を作る」という目的を先に示すことで、初めて来た人にも
            ここが開催中の一覧だけではなく、作成ツールであることが伝わる。
            「無料」だけ色を変えているが、読み上げ・検索に渡る文字列は変えていない。 */}
        <h1 className="jp-tight text-[27px] font-semibold leading-[1.34] sm:text-[40px]">
          バドミントンのダブルス組み合わせ表を
          <span className="text-accent-400">無料</span>で作成
        </h1>
        <p className="mt-3.5 max-w-xl text-[15px] leading-relaxed text-brand-100">
          人数とコート数を入れるだけ。作った試合表はリンクとQRコードで共有できます。
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 sm:mt-7">
          <Link
            to="/organizer/rooms/new"
            className="lift inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-brand-900 shadow-md hover:bg-accent-400"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
            乱数表をつくる
          </Link>
          {liveCount > 0 ? (
            <a
              href="#live"
              className="border-b-2 border-transparent pb-0.5 text-sm font-semibold text-brand-100 transition hover:border-accent-400 hover:text-white"
            >
              開催中のランダム表を見る
            </a>
          ) : null}
        </div>

        {/* 本文で説明している特徴の要約。ここで新しい約束はしない。
            「QRコードで共有」はすぐ上のリード文と同じことなので入れない。 */}
        <ul className="mt-6 flex flex-wrap gap-2 sm:mt-8">
          {['出場回数の差は1回以内', '同じ顔ぶれで固まらない', '遅刻・早退に対応'].map((fact) => (
            <li
              key={fact}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-brand-50"
            >
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * 検索から来た人に「これは何をする道具か」を伝える説明。
 *
 * 毎回使う運営者にとっては一覧だけが用なので、いちばん下に小さく置く。
 * 文字を減らすと検索の受け皿にならないため、量は保ちつつ密度を下げてある。
 */
function SiteIntro() {
  return (
    <section className="border-t border-slate-200 pt-8">
      <div className="grid gap-7 lg:grid-cols-[1fr_250px]">
        <div className="max-w-[40em] text-sm leading-relaxed text-slate-500">
          <h2 className="jp-tight text-lg font-semibold leading-relaxed text-slate-900">
            バドミントンの乱数表(ダブルスの組み合わせ表)を、その場で作れます
          </h2>
          <p className="mt-3">
            「乱数表」は、ダブルス練習で誰と誰が同じコートに入るかをセットごとにまとめた表で、
            「組み合わせ表」とも呼ばれます。紙に手で書いたり前回の表を使い回したりして作られてきましたが、
            人数が増えるほど、出場回数を揃えながら顔ぶれも混ぜるのは手作業ではむずかしくなります。
          </p>
          <p className="mt-3">
            ShuttleMatchなら、人数とコート数を入れるだけでこの乱数表を作れます。
            できた試合表はリンクやQRコードで配れるので、参加者は自分がいつ・どのコートに入るかを各自のスマホで見られます。
          </p>
          <h3 className="jp-tight mt-6 text-[15px] font-semibold text-slate-900">
            回数は公平に、顔ぶれは混ぜて
          </h3>
          <p className="mt-2">
            出場回数の差は常に1回以内に収まります。
            そのうえで「また同じ4人」にならないよう、誰と同じコートに入ったかを記録しながら組み合わせを選びます。
            遅刻・早退・途中参加があっても、まだ始めていないセットだけを組み直せます。
          </p>
          <h3 className="jp-tight mt-6 text-[15px] font-semibold text-slate-900">
            テニスなど他の競技でも
          </h3>
          <p className="mt-2">
            乱数表の作り方は「4人で1コートを回す」ことだけを前提にしているので、
            テニスのダブルス練習など、同じ形で回す競技にもそのまま使えます。
            画面の言葉はバドミントン向けですが、番号とコートで運用するぶんには競技を選びません。
          </p>
          <p className="mt-6 flex flex-wrap items-center gap-y-2">
            <Link
              to="/about"
              className="border-b-2 border-accent-200 pb-px font-semibold text-slate-900 transition hover:bg-accent-50"
            >
              仕組みをもっと詳しく見る
            </Link>
            <span className="mx-3 text-slate-300">|</span>
            <Link
              to="/guide/$id"
              params={{ id: 'ten-players-two-courts-doubles-example' }}
              className="border-b-2 border-accent-200 pb-px font-semibold text-slate-900 transition hover:bg-accent-50"
            >
              10人・2面の具体例を見る
            </Link>
            <span className="mx-3 text-slate-300">|</span>
            <Link
              to="/guide"
              className="border-b-2 border-accent-200 pb-px font-semibold text-slate-900 transition hover:bg-accent-50"
            >
              試合表の作り方ガイドを見る
            </Link>
          </p>
        </div>

        {/* 本文のいちばん強い一文を抜いて添える。文面は本文からそのまま。 */}
        <aside className="h-fit rounded-2xl bg-accent-50 px-5 py-4 lg:sticky lg:top-20">
          <p className="lbl mb-2.5 text-[10.5px] text-accent-600">Fair rotation</p>
          <p className="jp-tight text-[15px] font-semibold leading-relaxed text-accent-700">
            出場回数の差は常に1回以内に収まります。
          </p>
        </aside>
      </div>
    </section>
  )
}
