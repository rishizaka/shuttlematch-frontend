import { useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import type { FixedPair, Participant } from '../../lib/types'
import {
  useAddParticipant,
  useMarkParticipantLeft,
  useMarkParticipantsLeft,
  useReactivateParticipant,
  useReactivateParticipants,
  useRemoveParticipant,
  useRenameParticipant,
  useReplanFutureSets,
} from '../../hooks/queries'
import { FixedPairEditor } from './FixedPairEditor'
import { FREE_SLOT } from '../../lib/guests'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { ErrorBlock } from '../ui/Spinner'
import { useToast } from '../ui/Toast'
import { ParticipantList } from './ParticipantList'
import { ShareButtons } from './ShareButtons'

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
  noSetStarted = false,
}: {
  roomId: string
  /** 共有コード。あれば短縮URL(/r/{code})で共有する。 */
  shareCode?: string
  participants: Participant[]
  /** 固定ペア(常に同じチームで組む2人)の一覧。 */
  fixedPairs?: FixedPair[]
  /** 試合生成済みか。生成後は削除ではなく早退/復帰を使う。 */
  generated?: boolean
  /**
   * 生成後、まだどのセットも開始していないか。true の間だけ、一番後ろの番号の参加者を
   * 削除できる(参加者数そのものを減らす)。1セットでも開始すると削除できなくなる
   * (backend の RemoveParticipantUseCase と同じ条件)。generated=false のときは無視される
   * (生成前は誰でも削除できる従来通りの挙動のまま)。
   */
  noSetStarted?: boolean
}) {
  const add = useAddParticipant(roomId)
  const remove = useRemoveParticipant(roomId)
  const markLeft = useMarkParticipantLeft(roomId)
  const markLeftBulk = useMarkParticipantsLeft(roomId)
  const reactivate = useReactivateParticipant(roomId)
  const reactivateBulk = useReactivateParticipants(roomId)
  const rename = useRenameParticipant(roomId)
  const replan = useReplanFutureSets(roomId)
  const { showToast } = useToast()
  // ゲスト追加・早退・復帰の後に「未開始セットを再編成しますか？」と確認するモーダルの開閉。
  const [showReplanConfirm, setShowReplanConfirm] = useState(false)
  // 生成後・末尾の参加者を削除する前の確認モーダル(この参加者を指しているときだけ開く)。
  // 早退と違って元に戻せない(参加者数そのものが減る)ので、誤タップ防止に確認を挟む。
  const [confirmingRemove, setConfirmingRemove] = useState<Participant | null>(null)
  // まとめて早退・まとめて復帰させる複数選択モード。1人ずつ押すたびに再編成確認を
  // 挟むと、何人もまとめて操作したいときにモーダルを人数ぶん閉じることになるため、
  // 選んでから1回でまとめて処理し、再編成の確認も最後に1回だけ出す。
  // 早退と復帰は逆の操作なので、選択は在席・早退中のどちらか一方に固定する
  // (ParticipantList 側が最初の1件の状態でそれ以外をグレーアウトする)。
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const askReplan = () => setShowReplanConfirm(true)

  const cancelSelecting = () => {
    setSelecting(false)
    setSelectedIds(new Set())
  }

  const toggleSelect = (p: Participant) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(p.id)) next.delete(p.id)
      else next.add(p.id)
      return next
    })
  }

  // 選択中の在席状態から、バーに出す操作を決める。1件も選んでいなければ null。
  const bulkAction: 'leave' | 'reactivate' | null =
    selectedIds.size === 0
      ? null
      : participants.find((p) => selectedIds.has(p.id))?.status === 'LEFT'
        ? 'reactivate'
        : 'leave'
  const bulkPending = markLeftBulk.isPending || reactivateBulk.isPending

  const confirmBulkAction = () => {
    const ids = [...selectedIds]
    if (bulkAction === 'reactivate') {
      // 復帰は未開始セットへの反映が任意(戻すだけでは自動でローテーションに
      // 組み込まれない)なので、従来通りここで再編成を尋ねる。
      reactivateBulk.mutate(ids, {
        onSuccess: () => {
          cancelSelecting()
          askReplan()
        },
      })
    } else {
      // 早退はサーバー側が同じ操作の中で未開始セットも自動で組み直す
      // (MarkParticipantLeftUseCase 参照)ので、ここで尋ね直す必要は無い。
      markLeftBulk.mutate(ids, {
        onSuccess: () => {
          cancelSelecting()
          showToast('早退にしました(未開始セットも自動で組み直しました)')
        },
      })
    }
  }

  // 固定ペアの解除だけは、解除の確認モーダルで「解除する」を押した流れで
  // 再編成まで済ませる(確認を2回続けて出さないため)。
  // ゲストの追加・復帰・固定ペアの追加は従来どおり、あとから尋ねる。
  // 早退はサーバー側が自動で再編成するので、この一覧には含まれない。
  const replanAfterFixedPairRemoval = async () => {
    await replan.mutateAsync(undefined)
    showToast('固定ペアを解除し、未開始セットを再編成しました')
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

  return (
    <div className="space-y-3">
      {/* アクション行: 共有と途中参加(ゲスト追加)。説明はツールチップ的な1行に集約する。
          共有・QRは試合表ページのヘッダーにも全員向けに出ている(ShareButtons)。
          運営メニューの中にも残してあるのは、運営者がここで見慣れているのと、
          何かのついでに再共有したいときに探す場所が1つで済むため。 */}
      <div className="flex flex-wrap items-center gap-2">
        <ShareButtons roomId={roomId} shareCode={shareCode} />
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

      {/* まとめて早退・まとめて復帰させる複数選択モードの切り替え。1人だけ操作する
          既定の見た目・手順は変えず、必要なときだけ切り替えて使う。在席・早退中の
          どちらも2人未満ならまとめる意味が無いので出さない。 */}
      {generated &&
      (participants.filter((p) => p.status !== 'LEFT').length >= 2 ||
        participants.filter((p) => p.status === 'LEFT').length >= 2) ? (
        <div className="flex items-center justify-end">
          {selecting ? (
            <button
              type="button"
              onClick={cancelSelecting}
              className="text-xs font-medium text-slate-500 transition hover:text-slate-800"
            >
              キャンセル
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition hover:text-brand-700"
            >
              <ListChecks className="h-3.5 w-3.5" />
              複数選択
            </button>
          )}
        </div>
      ) : null}

      <ParticipantList
        participants={participants}
        onRemove={
          !generated
            ? (p) => remove.mutate(p.id)
            : noSetStarted
              ? (p) => setConfirmingRemove(p)
              : undefined
        }
        onlyLastRemovable={generated}
        removingId={remove.isPending ? (remove.variables as string) : null}
        onMarkLeft={
          generated
            ? (p) =>
                // 早退はサーバー側が同じ操作の中で未開始セットも自動で組み直すので、
                // ここで再編成を尋ね直す必要は無い(MarkParticipantLeftUseCase 参照)。
                markLeft.mutate(p.id, {
                  onSuccess: () => showToast('早退にしました(未開始セットも自動で組み直しました)'),
                })
            : undefined
        }
        onReactivate={
          generated ? (p) => reactivate.mutate(p.id, { onSuccess: askReplan }) : undefined
        }
        onMakeFree={(p) =>
          rename.mutate(
            { participantId: p.id, name: FREE_SLOT },
            { onSuccess: () => showToast('フリー枠にしました') },
          )
        }
        // フリーの逆。番号だけの枠に戻す(番号は一覧の並び順=表示されている番号と揃える)。
        onUnfree={(p) =>
          rename.mutate(
            { participantId: p.id, name: String(participants.findIndex((x) => x.id === p.id) + 1) },
            { onSuccess: () => showToast('フリーを解除しました') },
          )
        }
        updatingId={
          markLeft.isPending
            ? (markLeft.variables as string)
            : reactivate.isPending
              ? (reactivate.variables as string)
              : rename.isPending
                ? (rename.variables as { participantId: string }).participantId
                : null
        }
        selecting={selecting}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      {/* 選んだ人数ぶんをまとめて早退/復帰にするバー。1人も選んでいない間は出さない。
          ボタンの文言は選択中の在席状態で決まる(ParticipantList 側が選択を
          在席・早退中のどちらかに固定しているので、選んでいれば必ずどちらかになる)。 */}
      {selecting && selectedIds.size > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2.5">
          <span className="text-sm font-semibold text-brand-900">
            {selectedIds.size}人を選択中
            {bulkAction === 'reactivate' ? '(復帰)' : '(早退)'}
          </span>
          <Button size="sm" onClick={confirmBulkAction} disabled={bulkPending}>
            {bulkPending ? '処理中…' : bulkAction === 'reactivate' ? '復帰にする' : '早退にする'}
          </Button>
        </div>
      ) : null}
      {markLeftBulk.isError ? (
        <ErrorBlock message={(markLeftBulk.error as Error).message} />
      ) : null}
      {reactivateBulk.isError ? (
        <ErrorBlock message={(reactivateBulk.error as Error).message} />
      ) : null}

      {/* 固定ペア: 常に同じチームで組む2人を設定する。見た目は変わらず生成ロジックだけが守る。 */}
      <FixedPairEditor
        roomId={roomId}
        participants={participants}
        fixedPairs={fixedPairs}
        onAdded={generated ? askReplan : undefined}
        onRemoved={generated ? replanAfterFixedPairRemoval : undefined}
      />

      {generated ? (
        <p className="text-xs text-slate-400">
          早退は自動で未開始セットに反映されます。ゲストの追加・復帰・固定ペアの追加は
          「未開始セットを再編成」で試合表に反映されます。
        </p>
      ) : null}

      {add.isError ? <ErrorBlock message={(add.error as Error).message} /> : null}
      {markLeft.isError ? <ErrorBlock message={(markLeft.error as Error).message} /> : null}
      {reactivate.isError ? <ErrorBlock message={(reactivate.error as Error).message} /> : null}
      {/* 生成後の削除(末尾限定)の失敗。ライブ更新で他端末がセットを開始した直後など、
          クリックした時点では条件を満たしていてもサーバー側で弾かれることがある。 */}
      {remove.isError ? <ErrorBlock message={(remove.error as Error).message} /> : null}
      {/* 固定ペアの解除に続く再編成が失敗したときの受け皿。解除だけ済んでいる状態なので、
          黙って閉じると試合表が古いままなのに気付けない。 */}
      {replan.isError ? <ErrorBlock message={(replan.error as Error).message} /> : null}

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

      {confirmingRemove ? (
        <ConfirmModal
          title="参加者を削除しますか？"
          description={`${participants.findIndex((x) => x.id === confirmingRemove.id) + 1}番を削除します。早退と違い参加者数そのものが減り、元に戻せません。`}
          confirmLabel="削除する"
          danger
          confirming={remove.isPending}
          onConfirm={() =>
            remove.mutate(confirmingRemove.id, {
              onSuccess: () => {
                showToast('参加者を削除しました')
                setConfirmingRemove(null)
              },
            })
          }
          onCancel={() => setConfirmingRemove(null)}
        />
      ) : null}
    </div>
  )
}
