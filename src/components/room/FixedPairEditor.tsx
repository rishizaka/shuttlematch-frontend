import { useState } from 'react'
import { Link2, Plus, X } from 'lucide-react'
import type { FixedPair, Participant } from '../../lib/types'
import { useAddFixedPair, useRemoveFixedPair } from '../../hooks/queries'
import { Button } from '../ui/Button'
import { ErrorBlock } from '../ui/Spinner'
import { useToast } from '../ui/Toast'

/**
 * 固定ペア(常に同じチームで組む2人)の追加・解除UI。
 * 受付ロビー(初回生成前)と、生成後の参加者管理の両方で使う。
 * onChanged が渡されれば追加/解除の成功時にそれを呼ぶ(生成後の再編成確認など)。
 * 渡されなければ編集側でトーストを出す(生成前)。
 */
export function FixedPairEditor({
  roomId,
  participants,
  fixedPairs = [],
  onChanged,
}: {
  roomId: string
  participants: Participant[]
  fixedPairs?: FixedPair[]
  onChanged?: () => void
}) {
  const addFixedPair = useAddFixedPair(roomId)
  const removeFixedPair = useRemoveFixedPair(roomId)
  const { showToast } = useToast()
  const [pairA, setPairA] = useState('')
  const [pairB, setPairB] = useState('')

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
          if (onChanged) onChanged()
          else showToast('固定ペアを追加しました')
        },
      },
    )
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
                onClick={() =>
                  removeFixedPair.mutate(
                    { participantA: fp.participantA, participantB: fp.participantB },
                    {
                      onSuccess: () => {
                        if (onChanged) onChanged()
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
  )
}
