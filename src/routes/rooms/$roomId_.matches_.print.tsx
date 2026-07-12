import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useMatches, useRoom } from '../../hooks/queries'
import { groupMatchesBySet } from '../../components/match/MatchScheduleList'
import type { Match } from '../../lib/types'

export const Route = createFileRoute('/rooms/$roomId_/matches_/print')({
  component: PrintPage,
})

/**
 * スクショ用の試合表。セット・コート・番号のみを表で表示する。
 * ヘッダーや操作ボタンは一切出さない(全画面の白背景でアプリのレイアウトを覆う)。
 * 戻るときはブラウザバック。
 */
function PrintPage() {
  const { roomId } = Route.useParams()
  const { data: room } = useRoom(roomId)
  const { data: schedule, isLoading, isError } = useMatches(roomId)

  // 参加者一覧の並び順を 1 始まりの番号として割り当てる(試合表ページと同じ規則)。
  const indexByParticipantId = useMemo(() => {
    const map = new Map<string, number>()
    ;(room?.participants ?? []).forEach((p, i) => map.set(p.id, i + 1))
    return map
  }, [room])

  const groups = useMemo(() => groupMatchesBySet(schedule?.matches ?? []), [schedule])

  // 列 = コート番号(昇順)。コート情報なし(1コート運用)は単一列にする。
  const courtNumbers = useMemo(() => {
    const s = new Set<number>()
    for (const g of groups) {
      for (const m of g.matches) {
        if (m.courtNumber != null) s.add(m.courtNumber)
      }
    }
    return Array.from(s).sort((a, b) => a - b)
  }, [groups])
  const columns: Array<number | null> = courtNumbers.length ? courtNumbers : [null]

  const numbersOf = (m: Match) =>
    [m.pairA.player1Id, m.pairA.player2Id, m.pairB.player1Id, m.pairB.player2Id].map(
      (id) => indexByParticipantId.get(id) ?? '?',
    )

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white p-3">
      {isLoading ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : isError || !schedule ? (
        <p className="text-sm text-slate-500">試合表を取得できませんでした。</p>
      ) : (
        <table className="w-full border-collapse text-center tabular-nums">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="w-12 py-1 font-semibold">セット</th>
              {columns.map((c) => (
                <th key={c ?? 0} className="py-1 font-semibold">
                  {c != null ? `${c}コート` : 'コート'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.setNumber} className="border-t border-slate-200">
                <td className="py-1.5 text-sm font-bold text-slate-500">{g.setNumber}</td>
                {columns.map((c, i) => {
                  const m =
                    c != null ? g.matches.find((x) => x.courtNumber === c) : g.matches[i]
                  return (
                    <td
                      key={c ?? i}
                      className="py-1.5 text-base font-semibold text-slate-900"
                    >
                      {/* 1桁でも2桁でも同じ幅にして、行を跨いで桁位置が揃うようにする。 */}
                      {m
                        ? numbersOf(m).map((n, j) => (
                            <span key={j}>
                              {j > 0 ? (
                                <span className="font-normal text-slate-300">,</span>
                              ) : null}
                              <span className="inline-block w-6 text-center">{n}</span>
                            </span>
                          ))
                        : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
