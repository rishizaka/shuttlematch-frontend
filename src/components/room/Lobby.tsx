import { useEffect, useMemo, useRef, useState } from 'react'
import { burst } from '../../lib/motion'
import { Share2, UserPlus, Users } from 'lucide-react'
import type { Room } from '../../lib/types'
import {
  useAddParticipant,
  useGenerateMatches,
  useJoinRoom,
  useRenameParticipant,
} from '../../hooks/queries'
import { getSelfParticipant } from '../../lib/local-store'
import { copyToClipboard } from '../../lib/clipboard'
import { shareOrigin } from '../../lib/og'
import { Button } from '../ui/Button'
import { ErrorBlock } from '../ui/Spinner'
import { useToast } from '../ui/Toast'
import { FixedPairEditor } from './FixedPairEditor'
import { RenameModal } from './RenameModal'
import { VISITOR_PLACEHOLDER } from '../../lib/guests'

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
  const rename = useRenameParticipant(room.id)
  const addGuest = useAddParticipant(room.id)
  const { showToast } = useToast()

  const [selfId, setSelfId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [guestName, setGuestName] = useState('')
  const [showRename, setShowRename] = useState(false)

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

  // 運営者による代理追加。名前は任意。未入力なら「遅刻者・ビジター」を既定名にする。
  // この既定名の枠は、後から本人が「番号を指定」で自分の番号として当てはめられる。
  // 番号は参加順で自動採番。
  const submitAddGuest = () => {
    if (addGuest.isPending) return
    addGuest.mutate(
      { guestName: guestName.trim() || VISITOR_PLACEHOLDER },
      {
        onSuccess: () => {
          setGuestName('')
          showToast('追加しました')
        },
      },
    )
  }

  const generateRef = useRef<HTMLButtonElement>(null)
  const doGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: () => {
        burst(generateRef.current, 28)
        showToast('乱数表をつくりました')
      },
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-slate-600">あなたは参加済みです</p>
              <p className="mt-0.5 text-lg font-bold text-brand-900">
                {myNumber}番 ・ {me?.guestName}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setShowRename(true)}
            >
              名前を変更
            </Button>
          </div>
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

      {/* 運営者: 遅刻者・ビジターゲストの代理追加。
          あらかじめ分かっている遅刻者や、スマホがない人を運営者が代わりに追加する。 */}
      {isOrganizer ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserPlus className="h-4 w-4 text-slate-400" />
            遅刻者・ビジターゲストの追加
          </div>
          <p className="mb-2 text-xs text-slate-400">
            あらかじめ分かっている遅刻者や、スマホがない人を代わりに追加します。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={guestName}
              maxLength={30}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAddGuest()
              }}
              placeholder="名前（任意）"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={submitAddGuest}
              disabled={addGuest.isPending}
            >
              {addGuest.isPending ? '追加中…' : '追加'}
            </Button>
          </div>
          {addGuest.isError ? (
            <div className="mt-2">
              <ErrorBlock message={(addGuest.error as Error).message} />
            </div>
          ) : null}
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
            ref={generateRef}
            type="button"
            className="w-full"
            onClick={doGenerate}
            disabled={count < 1 || generate.isPending}
          >
            {generate.isPending
              ? '生成中…'
              : remaining > 0
                ? `乱数表をつくる（${count}人＋ゲスト${remaining}）`
                : `乱数表をつくる（${count}人）`}
          </Button>
          {generate.isError ? (
            <div className="mt-2">
              <ErrorBlock message={(generate.error as Error).message} />
            </div>
          ) : null}
          <p className="mt-2 text-center text-xs text-slate-400">
            {remaining > 0
              ? `コート ${room.courtCount ?? 1} 面は ${required} 人で回します。足りない ${remaining} 人分はゲスト（空き番号）として用意し、後から参加できます。`
              : `コート ${room.courtCount ?? 1} 面・${count} 人で乱数表をつくります。`}
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-400">
          運営者が乱数表をつくるまでお待ちください。
        </p>
      )}

      {showRename && selfId ? (
        <RenameModal
          currentName={me?.guestName ?? undefined}
          pending={rename.isPending}
          error={rename.isError ? (rename.error as Error).message : null}
          onSubmit={(newName) =>
            rename.mutate(
              { participantId: selfId, name: newName },
              {
                onSuccess: () => {
                  setShowRename(false)
                  showToast('名前を変更しました')
                },
              },
            )
          }
          onCancel={() => setShowRename(false)}
        />
      ) : null}
    </div>
  )
}
