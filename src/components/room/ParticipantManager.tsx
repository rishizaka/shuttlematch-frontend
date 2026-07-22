import { useState } from 'react'
import { Link2, Plus, Share2, X } from 'lucide-react'
import type { FixedPair, Participant } from '../../lib/types'
import {
  useAddFixedPair,
  useAddParticipant,
  useMarkParticipantLeft,
  useReactivateParticipant,
  useRemoveFixedPair,
  useRemoveParticipant,
  useReplanFutureSets,
} from '../../hooks/queries'
import { copyToClipboard } from '../../lib/clipboard'
import { shareOrigin } from '../../lib/og'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { ErrorBlock } from '../ui/Spinner'
import { useToast } from '../ui/Toast'
import { ParticipantList } from './ParticipantList'

/**
 * オーガナイザー向けの参加者管理(番号追加・削除/早退・名前変更)。
 * ルーム詳細にインラインで埋め込んで使う。
 * 生成前は削除、生成後(generated)は早退/復帰で在席状態を切り替える。
 */
export function ParticipantManager({
  roomId,
  shareCode,
  participants,
  fixedPairs = [],
  generated = false,
}: {
  roomId: string
  /** 共有コード。あれば短縮URL(/r/{code})で共有する。 */
  shareCode?: string
  participants: Participant[]
  /** 固定ペア(常に同じチームで組む2人)の一覧。 */
  fixedPairs?: FixedPair[]
  /** 試合生成済みか。生成後は削除ではなく早退/復帰を使う。 */
  generated?: boolean
}) {
  const add = useAddParticipant(roomId)
  const remove = useRemoveParticipant(roomId)
  const markLeft = useMarkParticipantLeft(roomId)
  const reactivate = useReactivateParticipant(roomId)
  const replan = useReplanFutureSets(roomId)
  const addFixedPair = useAddFixedPair(roomId)
  const removeFixedPair = useRemoveFixedPair(roomId)
  const { showToast } = useToast()
  // ゲスト追加・早退・復帰の後に「未開始セットを再編成しますか？」と確認するモーダルの開閉。
  const [showReplanConfirm, setShowReplanConfirm] = useState(false)
  // 固定ペア追加フォームで選択中の2人(participantId)。
  const [pairA, setPairA] = useState('')
  const [pairB, setPairB] = useState('')

  const askReplan = () => setShowReplanConfirm(true)

  // 参加者番号(一覧の並び順、1始まり)。固定ペアの表示に使う。
  const numberOf = (participantId: string) =>
    participants.findIndex((p) => p.id === participantId) + 1
  // 既にいずれかの固定ペアに属している参加者(1人1ペアなので選択肢から除外する)。
  const pairedIds = new Set(fixedPairs.flatMap((fp) => [fp.participantA, fp.participantB]))

  const submitFixedPair = () => {
    if (!pairA || !pairB || pairA === pairB) return
    addFixedPair.mutate(
      { participantA: pairA, participantB: pairB },
      {
        onSuccess: () => {
          setPairA('')
          setPairB('')
          if (generated) askReplan()
          else showToast('固定ペアを追加しました')
        },
      },
    )
  }

  // 途中参加: 次の空き番号(現在の人数+1)を番号のまま追加する。名前は後から本人が申告できる。
  // 試合生成後は追加をきっかけに再編成モーダルを出す。生成前(試合表がまだ無い)はトーストのみ。
  const addGuest = () => {
    add.mutate(
      { guestName: String(participants.length + 1) },
      {
        onSuccess: () => {
          if (generated) askReplan()
          else showToast('ゲストを追加しました')
        },
      },
    )
  }

  // 試合表の共有リンク。共有コードがあれば短縮URL(/r/{code})を使う。
  // openExternalBrowser=1 は LINE 等のアプリ内ブラウザから
  // 既定(外部)ブラウザで開かせるためのパラメータ。
  const origin = shareOrigin()
  const shareUrl = shareCode
    ? `${origin}/r/${shareCode}?openExternalBrowser=1`
    : `${origin}/rooms/${roomId}/matches?openExternalBrowser=1`

  const shareLink = async () => {
    if (typeof window === 'undefined') return
    const ok = await copyToClipboard(shareUrl)
    if (ok) showToast('リンクをコピーしました')
  }

  return (
    <div className="space-y-3">
      {/* アクション行: 共有と途中参加(ゲスト追加)。説明はツールチップ的な1行に集約する。 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={shareLink}>
          <Share2 className="h-4 w-4" />
          試合表を共有
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={addGuest}
          disabled={add.isPending}
        >
          <Plus className="h-4 w-4" />
          {add.isPending ? '追加中…' : 'ゲストを追加'}
        </Button>
      </div>

      <ParticipantList
        participants={participants}
        onRemove={generated ? undefined : (p) => remove.mutate(p.id)}
        removingId={remove.isPending ? (remove.variables as string) : null}
        onMarkLeft={generated ? (p) => markLeft.mutate(p.id, { onSuccess: askReplan }) : undefined}
        onReactivate={
          generated ? (p) => reactivate.mutate(p.id, { onSuccess: askReplan }) : undefined
        }
        updatingId={
          markLeft.isPending
            ? (markLeft.variables as string)
            : reactivate.isPending
              ? (reactivate.variables as string)
              : null
        }
      />

      {/* 固定ペア: 常に同じチームで組む2人を設定する。見た目は変わらず生成ロジックだけが守る。 */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Link2 className="h-4 w-4" />
          固定ペア
        </div>
        <p className="mt-1 text-xs text-slate-400">
          設定した2人は必ず同じチーム(味方)で一緒に出場し、休憩も同時になります(1人1ペアまで)。
        </p>

        {fixedPairs.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {fixedPairs.map((fp) => (
              <li
                key={`${fp.participantA}-${fp.participantB}`}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200"
              >
                <span>
                  {numberOf(fp.participantA)}番 &amp; {numberOf(fp.participantB)}番
                </span>
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                  aria-label="固定ペアを解除"
                  disabled={removeFixedPair.isPending}
                  onClick={() =>
                    removeFixedPair.mutate(
                      { participantA: fp.participantA, participantB: fp.participantB },
                      {
                        onSuccess: () => {
                          if (generated) askReplan()
                          else showToast('固定ペアを解除しました')
                        },
                      },
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/* 追加フォーム: ACTIVE かつ未ペアの参加者から2人を選ぶ。 */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
            value={pairA}
            onChange={(e) => setPairA(e.target.value)}
          >
            <option value="">選択</option>
            {participants
              .filter((p) => p.status === 'ACTIVE' && !pairedIds.has(p.id) && p.id !== pairB)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {numberOf(p.id)}番
                </option>
              ))}
          </select>
          <span className="text-sm text-slate-400">&amp;</span>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
            value={pairB}
            onChange={(e) => setPairB(e.target.value)}
          >
            <option value="">選択</option>
            {participants
              .filter((p) => p.status === 'ACTIVE' && !pairedIds.has(p.id) && p.id !== pairA)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {numberOf(p.id)}番
                </option>
              ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={submitFixedPair}
            disabled={!pairA || !pairB || addFixedPair.isPending}
          >
            <Plus className="h-4 w-4" />
            {addFixedPair.isPending ? '追加中…' : '追加'}
          </Button>
        </div>

        {addFixedPair.isError ? (
          <div className="mt-2">
            <ErrorBlock message={(addFixedPair.error as Error).message} />
          </div>
        ) : null}
        {removeFixedPair.isError ? (
          <div className="mt-2">
            <ErrorBlock message={(removeFixedPair.error as Error).message} />
          </div>
        ) : null}
      </div>

      {generated ? (
        <p className="text-xs text-slate-400">
          ゲストの追加・早退・復帰・固定ペアの変更は「未開始セットを再編成」で試合表に反映されます。
        </p>
      ) : null}

      {add.isError ? <ErrorBlock message={(add.error as Error).message} /> : null}
      {markLeft.isError ? <ErrorBlock message={(markLeft.error as Error).message} /> : null}
      {reactivate.isError ? <ErrorBlock message={(reactivate.error as Error).message} /> : null}

      {showReplanConfirm ? (
        <ConfirmModal
          title="試合表を再編成しますか？"
          description="出入りを反映して未開始セットを組み直します(開始済みはそのまま)。"
          confirming={replan.isPending}
          onConfirm={() =>
            replan.mutate(undefined, {
              onSuccess: () => {
                showToast('未開始セットを再編成しました')
                setShowReplanConfirm(false)
              },
            })
          }
          onCancel={() => setShowReplanConfirm(false)}
        />
      ) : null}
    </div>
  )
}
