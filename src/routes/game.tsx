import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, Trophy } from 'lucide-react'
import { AdSlot } from '../components/game/AdSlot'
import { GAMES } from '../components/game/catalog'

export const Route = createFileRoute('/game')({
  head: () => ({
    meta: [
      { title: 'ミニゲーム — 待ち時間のおともに | ShuttleMatch' },
      {
        name: 'description',
        content:
          '試合の待ち時間に片手で遊べるバドミントンミニゲーム。シャトルフラップ、スマッシュレイン、シャトポコスキーほか。きみはどれが得意？',
      },
    ],
  }),
  component: GameHubPage,
})

function GameHubPage() {
  // ベストスコアは localStorage にあるためマウント後に読む(SSR では出さない)
  const [bests, setBests] = useState<Record<string, number>>({})
  useEffect(() => {
    const next: Record<string, number> = {}
    for (const g of GAMES) {
      const v = Number(localStorage.getItem(g.bestKey) ?? '0')
      if (Number.isFinite(v) && v > 0) next[g.bestKey] = v
    }
    setBests(next)
  }, [])

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">ミニゲーム</h1>
        <p className="text-sm text-slate-500">
          試合の待ち時間に、片手でどうぞ。スコアを重ねるとレベルアップして難易度が上がります。
        </p>
      </div>

      <div className="space-y-3">
        {GAMES.map((g) => (
          <Link
            key={g.to}
            to={g.to}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md active:scale-[0.99]"
          >
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl ${g.iconBg}`}
            >
              {g.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{g.name}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{g.description}</p>
              {bests[g.bestKey] ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Trophy className="h-3.5 w-3.5" />
                  ベスト {bests[g.bestKey]}
                </p>
              ) : null}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>

      <AdSlot />

      <p className="text-center text-[11px] text-slate-400">
        ベストスコアはこの端末にだけ保存されます。
      </p>
    </div>
  )
}
