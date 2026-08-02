import { Skeleton } from '../ui/Skeleton'

/**
 * 試合表の読み込み中に出す骨組み。
 *
 * リンクから開くとスケジュールが届くまで数秒かかることがあり、そのあいだ
 * 小さなスピナーだけだと「真っ白なページ」に見えてしまう。実際の並び
 * (セットの見出し + コートごとの番号チップ4つ)と同じ形を置いて、
 * 中身が届いたときに位置が動かないようにする。
 *
 * ルートの loader が SSR の時点でルームを取っているので、タイトルとコート数は
 * 分かっていれば本物を渡せる(その場合ここは推測しない)。
 */
export function MatchesSkeleton({
  title,
  courts = 2,
  sets = 4,
}: {
  /** 分かっていればルーム名。無ければ灰色の板で場所だけ取る。 */
  title?: string
  /** 1セットあたりのコート数。分からなければ 2。 */
  courts?: number
  /** 並べるセットの数。画面が埋まる程度でよい。 */
  sets?: number
}) {
  return (
    <div className="space-y-5 pb-24" role="status" aria-busy="true">
      <span className="sr-only">試合表を読み込み中です</span>

      {/* 見出し(「← ルーム一覧へ」+ ルーム名) */}
      <div className="animate-pulse">
        <Skeleton className="h-3.5 w-28" />
        {title ? (
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
        ) : (
          <Skeleton className="mt-2 h-8 w-48" />
        )}
      </div>

      <div className="animate-pulse space-y-5">
        {/* 参加者名簿のアコーディオン */}
        <Skeleton className="h-12 w-full rounded-2xl" />

        {/* セットごとの試合。見出しの横線まで含めて本物と同じ間隔にする。 */}
        <div className="space-y-3.5">
          {Array.from({ length: sets }, (_, set) => (
            <section key={set}>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20 shrink-0" />
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="mt-1.5 space-y-1">
                {Array.from({ length: Math.max(1, courts) }, (_, court) => (
                  <div key={court} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-7 shrink-0" />
                    <span className="flex items-center gap-1.5">
                      {Array.from({ length: 4 }, (_, player) => (
                        <Skeleton key={player} className="h-7 w-7 rounded-full" />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
