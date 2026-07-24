import { useEffect, useMemo, useState } from 'react'
import { Share2, UserPlus, Users } from 'lucide-react'
import type { Room } from '../../lib/types'
import { useGenerateMatches, useJoinRoom } from '../../hooks/queries'
import { getSelfParticipant } from '../../lib/local-store'
import { copyToClipboard } from '../../lib/clipboard'
import { shareOrigin } from '../../lib/og'
import { Button } from '../ui/Button'
import { ErrorBlock } from '../ui/Spinner'
import { useToast } from '../ui/Toast'
import { FixedPairEditor } from './FixedPairEditor'

/** 1試合あたりの人数。生成に必要な最低人数 = 4 × コート数。 */
const PLAYERS_PER_MATCH = 4

/**
 * 受付中(未生成)ルームのロビー。
 * 参加者は名前を入れて参加すると番号が自動採番される。運営者は集まったら試合表を生成する。
 * 全員に参加者名簿(番号+名前)がライブ表示される。
 */
export function Lobby({ room, isOrganizer }: { room: Room; isOrganizer: boolean }) {
  const join = useJoinRoom(room.id)
  const generate = useGenerateMatches(room.id)
  const { showToast } = useToast()

  const [selfId, setSelfId] = useState<string | null>(null)
  const [name, setName] = useState('')

  // マウント後に「自分の参加者ID」を localStorage から読む(参加済みか判定)。
  useEffect(() => {
    const stored = getSelfParticipant(room.id)
    if (stored?.participantId) setSelfId(stored.participantId)
  }, [room.id])

  // 参加者は参加順(join_order)で並ぶ。番号 = 一覧の並び順(1始まり)。
  const numberOf = useMemo(() => {
    const map = new Map<string, number>()
    room.participants.forEach((p, i) => map.set(p.id, i + 1))
    return map
  }, [room.participants])

  const joined = !!selfId && room.participants.some((p) => p.id === selfId)
  const myNumber = selfId ? numberOf.get(selfId) ?? null : null
  const me = selfId ? room.participants.find((p) => p.id === selfId) : null

  const required = PLAYERS_PER_MATCH * (room.courtCount ?? 1)
  const count = room.participants.length
  const remaining = Math.max(0, required - count)

  const origin = shareOrigin()
  const shareUrl = room.shareCode
    ? `${origin}/r/${room.shareCode}?openExternalBrowser=1`
    : `${origin}/rooms/${room.id}/matches?openExternalBrowser=1`

  const shareLink = async () => {
    if (typeof window === 'undefined') return
    if (await copyToClipboard(shareUrl)) showToast('参加リンクをコピーしました')
  }

  const submitJoin = () => {
    if (join.isPending) return
    // 名前は任意。未入力なら「ゲスト」で参加する。
    join.mutate(name.trim() || 'ゲスト', {
      onSuccess: (result) => {
        setSelfId(result.participantId)
        setName('')
        showToast(`${result.number}番で参加しました`)
      },
    })
  }

  const doGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: () => showToast('試合表を生成しました'),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{room.title}</h1>
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">
            受付中
          </span>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={shareLink}>
          <Share2 className="h-4 w-4" />
          参加リンクを共有
        </Button>
      </div>

      {/* 自分の参加状態 */}
      {joined ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
          <p className="text-sm text-slate-600">あなたは参加済みです</p>
          <p className="mt-0.5 text-lg font-bold text-brand-900">
            {myNumber}番 ・ {me?.guestName}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserPlus className="h-4 w-4 text-brand-600" />
            名前を入れて参加
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitJoin()
              }}
              placeholder="あなたの名前（任意）"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
            <Button type="button" onClick={submitJoin} disabled={join.isPending}>
              {join.isPending ? '参加中…' : '参加する'}
            </Button>
          </div>
          {join.isError ? (
            <div className="mt-2">
              <ErrorBlock message={(join.error as Error).message} />
            </div>
          ) : null}
        </div>
      )}

      {/* 参加者名簿(番号+名前・ライブ)。
          参加中のメンバーは「参加した人(または運営者)」だけに見せる。
          未参加の人には出さない(参加フォームだけを見せる)。 */}
      {joined || isOrganizer ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-slate-400" />
            参加者 ({count})
          </div>
          {count === 0 ? (
            <p className="py-2 text-sm text-slate-500">
              まだ参加者がいません。リンクを共有しましょう。
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {room.participants.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    className={
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ' +
                      (p.id === selfId
                        ? 'bg-accent-500 text-brand-900'
                        : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {numberOf.get(p.id)}
                  </span>
                  <span className="truncate text-slate-800">{p.guestName}</span>
                  {p.id === selfId ? (
                    <span className="ml-auto text-xs font-medium text-brand-600">あなた</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* 運営者: 固定ペアを事前設定(初回生成前でも設定できる)。2人以上いるとき。 */}
      {isOrganizer && count >= 2 ? (
        <FixedPairEditor
          roomId={room.id}
          participants={room.participants}
          fixedPairs={room.fixedPairs ?? []}
        />
      ) : null}

      {/* 運営者: 試合表を生成 */}
      {isOrganizer ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Button
            type="button"
            className="w-full"
            onClick={doGenerate}
            disabled={count < 1 || generate.isPending}
          >
            {generate.isPending
              ? '生成中…'
              : remaining > 0
                ? `試合表を生成（${count}人＋ゲスト${remaining}）`
                : `試合表を生成（${count}人）`}
          </Button>
          {generate.isError ? (
            <div className="mt-2">
              <ErrorBlock message={(generate.error as Error).message} />
            </div>
          ) : null}
          <p className="mt-2 text-center text-xs text-slate-400">
            {remaining > 0
              ? `コート ${room.courtCount ?? 1} 面は ${required} 人で回します。足りない ${remaining} 人分はゲスト（空き番号）として用意し、後から参加できます。`
              : `コート ${room.courtCount ?? 1} 面・${count} 人で試合表を作ります。`}
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-400">
          運営者が試合表を作成するまでお待ちください。
        </p>
      )}
    </div>
  )
}
