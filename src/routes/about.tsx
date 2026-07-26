import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronDown, ListChecks, Shuffle, Smartphone, Sparkles } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'ShuttleMatch について — バドミントンの試合表を、公平に・よく混ざる形で' },
      {
        name: 'description',
        content:
          'ShuttleMatch はバドミントン練習会の試合表を自動生成・共有するサービス。出場回数は常に公平、同じ顔ぶれで固まらないマッチング、受付モードや再編成で当日運営もかんたん。',
      },
    ],
  }),
  component: AboutPage,
})

/**
 * three.js のシーンを sticky な全画面キャンバスとして敷き、
 * コンテンツがその上をスクロールする。スクロール進行度がカメラワークになる。
 * three.js 本体はシーン生成時に動的 import され、初期バンドルには載らない。
 */
function SceneLayer({ wrapRef }: { wrapRef: RefObject<HTMLDivElement | null> }) {
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let scene: { dispose: () => void } | null = null
    const getProgress = () => {
      const wrap = wrapRef.current
      if (!wrap) return 0
      const rect = wrap.getBoundingClientRect()
      const max = rect.height - window.innerHeight
      return max > 0 ? Math.min(Math.max(-rect.top / max, 0), 1) : 0
    }
    void import('../components/about/badmintonScene').then(({ createBadmintonScene }) =>
      createBadmintonScene(host, getProgress).then((s) => {
        if (disposed) s.dispose()
        else scene = s
      }),
    )
    return () => {
      disposed = true
      scene?.dispose()
    }
  }, [wrapRef])
  return <div ref={hostRef} className="sticky top-0 h-screen w-full" aria-hidden />
}

/** 画面に入ったらふわっと出す(IntersectionObserver)。 */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={
        'transition-all duration-700 ease-out will-change-transform ' +
        (shown ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0')
      }
    >
      {children}
    </div>
  )
}

/** コンテンツ用のガラス風カード。背後の 3D が透ける。 */
function Glass({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        'rounded-3xl border border-white/10 bg-slate-950/55 p-8 shadow-2xl backdrop-blur-md sm:p-10 ' +
        className
      }
    >
      {children}
    </div>
  )
}

function AboutPage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  return (
    // 親レイアウト(max-w-5xl + padding)を抜けて全幅・全高で敷く。
    <div
      ref={wrapRef}
      className="relative left-1/2 -my-6 w-screen -translate-x-1/2 bg-[#060f22] text-slate-100"
    >
      <SceneLayer wrapRef={wrapRef} />

      {/* キャンバス(100vh)の上に重ねるため、その分だけ引き上げる */}
      <div className="relative z-10 -mt-[100vh]">
        {/* Hero */}
        <section className="relative flex h-screen flex-col items-center justify-center px-6 text-center">
          <Reveal>
            <p className="mb-4 text-sm font-semibold tracking-[0.3em] text-brand-300">
              SHUTTLEMATCH
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-6xl">
              コートの上のことだけ、
              <br />
              考えよう。
            </h1>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              ShuttleMatch は、バドミントン練習会の試合表を
              自動でつくって共有するサービスです。
              組み合わせに悩む時間を、ラリーの時間に。
            </p>
          </Reveal>
          <Reveal delay={440}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/organizer/rooms/new"
                className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/50 transition hover:bg-brand-400"
              >
                試合表を作ってみる
              </Link>
              <Link
                to="/"
                className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                今日のルームを見る
              </Link>
            </div>
          </Reveal>
          <div className="pointer-events-none absolute bottom-8 animate-bounce text-slate-400">
            <ChevronDown className="h-6 w-6" />
          </div>
        </section>

        {/* 公平な輪番 */}
        <section className="flex min-h-screen items-center px-6 py-24">
          <div className="mx-auto w-full max-w-2xl">
            <Reveal>
              <Glass>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/25 text-brand-300">
                  <ListChecks className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  出場回数の差は、いつでも
                  <span className="mx-1 text-4xl font-black text-brand-300 sm:text-5xl">1</span>
                  以内。
                </h2>
                <p className="mt-4 leading-relaxed text-slate-300">
                  誰が何回出たかをずっと数えながら、次のセットの出場者を選びます。
                  たくさん休む人も、出ずっぱりの人も出しません。
                  連続の休みはゼロ、連続の出場も抑えて、身体にもやさしい輪番にします。
                </p>
              </Glass>
            </Reveal>
          </div>
        </section>

        {/* よく混ざる */}
        <section className="flex min-h-screen items-center px-6 py-24">
          <div className="ml-auto w-full max-w-2xl lg:mr-[8vw]">
            <Reveal>
              <Glass>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/25 text-brand-300">
                  <Shuffle className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  同じ顔ぶれで、固まらない。
                </h2>
                <p className="mt-4 leading-relaxed text-slate-300">
                  「またこの4人…」をなくすため、誰と誰が同じコートに入ったかを
                  全ペアぶん記録し、毎セット、できるだけ新鮮な顔合わせになる
                  組み合わせを探索します。試合表を何通りも作って、いちばん
                  混ざったものだけをお出しします。
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  後ろで跳ねている15個の玉が、その様子です。
                </p>
              </Glass>
            </Reveal>
          </div>
        </section>

        {/* 当日運営 */}
        <section className="flex min-h-screen items-center px-6 py-24">
          <div className="mr-auto w-full max-w-2xl lg:ml-[8vw]">
            <Reveal>
              <Glass>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/25 text-brand-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  当日の「いつもの」に、ぜんぶ対応。
                </h2>
                <ul className="mt-5 space-y-3 leading-relaxed text-slate-300">
                  <li>
                    <span className="font-semibold text-white">受付モード</span> —
                    リンクを共有するだけ。参加者が名前を書くと番号が決まります。
                  </li>
                  <li>
                    <span className="font-semibold text-white">遅刻・早退・途中参加</span> —
                    未開始のセットだけをワンタップで組み直し。消化済みの試合はそのまま。
                  </li>
                  <li>
                    <span className="font-semibold text-white">セット追加</span> —
                    「もう1セットだけ」も、公平さと混ざりを引き継いで継ぎ足せます。
                  </li>
                  <li>
                    <span className="font-semibold text-white">固定ペア</span> —
                    いつも一緒に組みたい2人は、ずっと同じチームに。
                  </li>
                </ul>
              </Glass>
            </Reveal>
          </div>
        </section>

        {/* 通知 + CTA */}
        <section className="flex min-h-[90vh] flex-col items-center justify-center px-6 py-24 text-center">
          <Reveal>
            <div className="mx-auto mb-10 max-w-xl">
              <div className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/25 text-brand-300">
                <Smartphone className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                「次、あなたの試合です」まで届く。
              </h2>
              <p className="mt-4 leading-relaxed text-slate-300">
                モバイルアプリなら、セット開始をプッシュ通知でお知らせ。
                自分の番号を設定しておけば「第3セット・コート2」まで教えてくれます。
              </p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <h2 className="text-3xl font-bold text-white sm:text-5xl">
              今日の練習会から、どうぞ。
            </h2>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/organizer/rooms/new"
                className="rounded-xl bg-brand-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-900/50 transition hover:bg-brand-400"
              >
                ルームを作成する
              </Link>
              <Link
                to="/"
                className="rounded-xl border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                ルーム一覧へ
              </Link>
            </div>
          </Reveal>
          <p className="mt-16 text-xs text-slate-500">
            ShuttleMatch — Spring Boot / React / Three.js
          </p>
        </section>
      </div>
    </div>
  )
}
