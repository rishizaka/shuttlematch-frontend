import { useState } from 'react'
import { Link2, Plus, X } from 'lucide-react'
import type { FixedPair, Participant } from '../../lib/types'
import { useAddFixedPair, useRemoveFixedPair } from '../../hooks/queries'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { ErrorBlock } from '../ui/Spinner'
import { useToast } from '../ui/Toast'

/**
 * 固定ペア(常に同じチームで組む2人)の追加・解除UI。
 * 受付ロビー(初回生成前)と、生成後の参加者管理の両方で使う。
 *
 * 解除は×を押した時点で確定してしまうと事故になるので、確認モーダルを挟む。
 * 生成後(onRemoved あり)は「解除する」で解除から未開始セットの再編成まで
 * 一続きで実行し、全部終わるまでモーダルを閉じない
 * (解除だけ済んで再編成が漏れ、試合表に古い固定ペアが残るのを防ぐ)。
 */
export function FixedPairEditor({
  roomId,
  participants,
  fixedPairs = [],
  onAdded,
  onRemoved,
}: {
  roomId: string
  participants: Participant[]
  fixedPairs?: FixedPair[]
  /** 追加が成功したとき。渡されなければ編集側でトーストを出す(生成前)。 */
  onAdded?: () => void
  /**
   * 解除が成功したあとに続けてやること(生成後の再編成)。
   * 終わるまでモーダルを開いたまま待つので Promise を返すこと。
   * 渡されなければ編集側でトーストを出す(生成前)。
   */
  onRemoved?: () => Promise<unknown>
}) {
  const addFixedPair = useAddFixedPair(roomId)
  const removeFixedPair = useRemoveFixedPair(roomId)
  const { showToast } = useToast()
  const [pairA, setPairA] = useState('')
  const [pairB, setPairB] = useState('')
  // 解除の確認中の固定ペア(null なら確認していない)。
  const [removingPair, setRemovingPair] = useState<FixedPair | null>(null)
  // 解除〜再編成が終わるまで true。モーダルのボタンを止めるのに使う。
  const [applying, setApplying] = useState(false)

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
          if (onAdded) onAdded()
          else showToast('固定ペアを追加しました')
        },
      },
    )
  }

  // 確認モーダルの「解除する」。解除 → (生成後なら)再編成 まで続けて走らせる。
  const confirmRemoval = async () => {
    if (!removingPair) return
    setApplying(true)
    try {
      await removeFixedPair.mutateAsync({
        participantA: removingPair.participantA,
        participantB: removingPair.participantB,
      })
      if (onRemoved) await onRemoved()
      else showToast('固定ペアを解除しました')
    } catch {
      // 解除・再編成いずれの失敗も、文言は下の ErrorBlock と親が出す。
      // モーダルは閉じる(開いたままだと後ろのエラーが読めない)。
    } finally {
      setApplying(false)
      setRemovingPair(null)
    }
  }

  return (
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
                onClick={() => setRemovingPair(fp)}
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

      {removingPair ? (
        <ConfirmModal
          title="固定ペアを解除しますか？"
          description={
            `${numberOf(removingPair.participantA)}番 と ${numberOf(removingPair.participantB)}番 の固定を外します。` +
            (onRemoved
              ? '続けて未開始セットを再編成します(開始済みはそのまま)。'
              : '')
          }
          confirmLabel="解除する"
          cancelLabel="やめる"
          confirming={applying}
          onConfirm={() => void confirmRemoval()}
          onCancel={() => setRemovingPair(null)}
        />
      ) : null}
    </div>
  )
}
