import { useState } from 'react'
import { Shuffle } from 'lucide-react'
import type { Room } from '../../lib/types'
import { useGenerateMatches } from '../../hooks/queries'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

/** 試合生成に必要な最低参加人数 (バックエンド仕様に合わせる)。 */
export const MIN_PARTICIPANTS = 4

export function GenerateMatchesButton({
  room,
  alreadyGenerated,
}: {
  room: Room
  alreadyGenerated: boolean
}) {
  const generate = useGenerateMatches(room.id)
  const [confirming, setConfirming] = useState(false)

  const enoughPlayers = room.participantCount >= MIN_PARTICIPANTS

  if (!enoughPlayers) {
    return (
      <p className="text-sm text-slate-500">
        試合生成には {MIN_PARTICIPANTS} 名以上の参加者が必要です。
      </p>
    )
  }

  const run = () => {
    generate.mutate(undefined, { onSettled: () => setConfirming(false) })
  }

  // 既に生成済みの場合は再生成として確認ダイアログを挟む。
  if (alreadyGenerated && confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">既存の試合を破棄して再生成しますか？</span>
        <Button variant="danger" onClick={run} disabled={generate.isPending}>
          {generate.isPending ? <Spinner /> : null}
          再生成する
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={generate.isPending}>
          やめる
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        onClick={alreadyGenerated ? () => setConfirming(true) : run}
        disabled={generate.isPending}
      >
        {generate.isPending ? <Spinner /> : <Shuffle className="h-4 w-4" />}
        {alreadyGenerated ? '試合を再生成する' : '試合を生成する'}
      </Button>
      {generate.isError ? (
        <p className="text-xs text-red-600">{(generate.error as Error).message}</p>
      ) : null}
    </div>
  )
}
