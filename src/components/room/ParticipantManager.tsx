import { useState } from 'react'
import { Plus, Share2 } from 'lucide-react'
import type { Participant } from '../../lib/types'
import {
  useAddParticipant,
  useMarkParticipantLeft,
  useReactivateParticipant,
  useRemoveParticipant,
  useRenameParticipant,
  useReplanFutureSets,
} from '../../hooks/queries'
import { copyToClipboard } from '../../lib/clipboard'
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
  names,
  generated = false,
}: {
  roomId: string
  /** 共有コード。あれば短縮URL(/r/{code})で共有する。 */
  shareCode?: string
  participants: Participant[]
  names?: ReadonlyMap<string, string>
  /** 試合生成済みか。生成後は削除ではなく早退/復帰を使う。 */
  generated?: boolean
}) {
  const add = useAddParticipant(roomId)
  const remove = useRemoveParticipant(roomId)
  const markLeft = useMarkParticipantLeft(roomId)
  const reactivate = useReactivateParticipant(roomId)
  const rename = useRenameParticipant(roomId)
  const replan = useReplanFutureSets(roomId)
  const { showToast } = useToast()
  // ゲスト追加・早退・復帰の後に「未開始セットを再編成しますか？」と確認するモーダルの開閉。
  const [showReplanConfirm, setShowReplanConfirm] = useState(false)

  const askReplan = () => setShowReplanConfirm(true)

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
  const shareUrl =
    typeof window === 'undefined'
      ? ''
      : shareCode
        ? `${window.location.origin}/r/${shareCode}?openExternalBrowser=1`
        : `${window.location.origin}/rooms/${roomId}/matches?openExternalBrowser=1`

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
        names={names}
        onRemove={generated ? undefined : (p) => remove.mutate(p.id)}
        removingId={remove.isPending ? (remove.variables as string) : null}
        onMarkLeft={generated ? (p) => markLeft.mutate(p.id, { onSuccess: askReplan }) : undefined}
        onReactivate={
          generated ? (p) => reactivate.mutate(p.id, { onSuccess: askReplan }) : undefined
        }
        onRename={(p, name) => rename.mutate({ participantId: p.id, name })}
        updatingId={
          markLeft.isPending
            ? (markLeft.variables as string)
            : reactivate.isPending
              ? (reactivate.variables as string)
              : null
        }
      />

      {generated ? (
        <p className="text-xs text-slate-400">
          ゲストの追加・早退・復帰は「未開始セットを再編成」で試合表に反映されます。
        </p>
      ) : null}

      {add.isError ? <ErrorBlock message={(add.error as Error).message} /> : null}
      {markLeft.isError ? <ErrorBlock message={(markLeft.error as Error).message} /> : null}
      {reactivate.isError ? <ErrorBlock message={(reactivate.error as Error).message} /> : null}
      {rename.isError ? <ErrorBlock message={(rename.error as Error).message} /> : null}

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
