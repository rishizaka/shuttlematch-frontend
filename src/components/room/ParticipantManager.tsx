import { useState } from 'react'
import { Plus, Share2 } from 'lucide-react'
import type { Participant } from '../../lib/types'
import {
  useAddParticipant,
  useMarkParticipantLeft,
  useReactivateParticipant,
  useRemoveParticipant,
  useRenameParticipant,
} from '../../hooks/queries'
import { Button } from '../ui/Button'
import { ErrorBlock } from '../ui/Spinner'
import { ParticipantList } from './ParticipantList'

/**
 * オーガナイザー向けの参加者管理(番号追加・削除/早退・名前変更)。
 * ルーム詳細にインラインで埋め込んで使う。
 * 生成前は削除、生成後(generated)は早退/復帰で在席状態を切り替える。
 */
export function ParticipantManager({
  roomId,
  participants,
  names,
  generated = false,
}: {
  roomId: string
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
  const [copied, setCopied] = useState(false)

  // 途中参加: 次の空き番号(現在の人数+1)を番号のまま追加する。名前は後から本人が申告できる。
  const addNumber = () => {
    add.mutate({ guestName: String(participants.length + 1) })
  }

  // 試合表の共有リンク。openExternalBrowser=1 は LINE 等のアプリ内ブラウザから
  // 既定(外部)ブラウザで開かせるためのパラメータ。
  const shareUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/rooms/${roomId}/matches?openExternalBrowser=1`

  const shareLink = async () => {
    if (typeof window === 'undefined') return
    // 共有シートがあれば使う(LINE などに直接共有できる)。
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '試合表', url: shareUrl })
        return
      } catch {
        // キャンセル・失敗時はコピーにフォールバック
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボード不可の環境では何もしない
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-2 text-xs text-slate-500">
          リンクを共有すると、LINE などのアプリ内ブラウザからでも既定のブラウザで試合表を開けます。
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={shareLink}>
          <Share2 className="h-4 w-4" />
          {copied ? 'コピーしました' : '試合表リンクを共有'}
        </Button>
      </div>

      <ParticipantList
        participants={participants}
        names={names}
        onRemove={generated ? undefined : (p) => remove.mutate(p.id)}
        removingId={remove.isPending ? (remove.variables as string) : null}
        onMarkLeft={generated ? (p) => markLeft.mutate(p.id) : undefined}
        onReactivate={generated ? (p) => reactivate.mutate(p.id) : undefined}
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
        <p className="text-xs text-slate-500">
          試合開始後の出入りは「早退／復帰」で切り替え、試合表の「未開始セットを再編成」で反映します。
        </p>
      ) : null}

      {add.isError ? <ErrorBlock message={(add.error as Error).message} /> : null}
      {markLeft.isError ? <ErrorBlock message={(markLeft.error as Error).message} /> : null}
      {reactivate.isError ? <ErrorBlock message={(reactivate.error as Error).message} /> : null}
      {rename.isError ? <ErrorBlock message={(rename.error as Error).message} /> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <p className="text-sm text-slate-600">
          途中参加はここで番号を1つ増やせます。名前は本人が試合表で申告できます。
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="sm:ml-auto"
          onClick={addNumber}
          disabled={add.isPending}
        >
          <Plus className="h-4 w-4" />
          {add.isPending ? '追加中…' : '番号を追加'}
        </Button>
      </div>
    </div>
  )
}
