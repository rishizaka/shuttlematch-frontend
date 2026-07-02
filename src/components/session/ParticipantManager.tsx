import { useState } from 'react'
import { Link2, Plus } from 'lucide-react'
import type { Participant } from '../../lib/types'
import {
  useAddParticipant,
  useMarkParticipantLeft,
  useReactivateParticipant,
  useRemoveParticipant,
} from '../../hooks/queries'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { ErrorBlock } from '../ui/Spinner'
import { ParticipantList } from './ParticipantList'

/**
 * オーガナイザー向けの参加者管理(代理登録・ゲスト追加・削除/早退)。
 * セッション詳細にインラインで埋め込んで使う。
 * 生成前は削除、生成後(generated)は早退/復帰で在席状態を切り替える。
 */
export function ParticipantManager({
  sessionId,
  participants,
  names,
  generated = false,
}: {
  sessionId: string
  participants: Participant[]
  names?: ReadonlyMap<string, string>
  /** 試合生成済みか。生成後は削除ではなく早退/復帰を使う。 */
  generated?: boolean
}) {
  const add = useAddParticipant(sessionId)
  const remove = useRemoveParticipant(sessionId)
  const markLeft = useMarkParticipantLeft(sessionId)
  const reactivate = useReactivateParticipant(sessionId)
  const [guestName, setGuestName] = useState('')
  const [copied, setCopied] = useState(false)

  const addGuest = (e: React.FormEvent) => {
    e.preventDefault()
    add.mutate({ guestName: guestName.trim() }, { onSuccess: () => setGuestName('') })
  }

  const copyInvite = async () => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/join/${sessionId}`
    try {
      await navigator.clipboard.writeText(url)
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
          招待リンクを共有すると、ログインなしでニックネーム入力だけで参加できます。
        </p>
        <Button type="button" size="sm" variant="secondary" onClick={copyInvite}>
          <Link2 className="h-4 w-4" />
          {copied ? 'コピーしました' : '招待リンクをコピー'}
        </Button>
      </div>

      <ParticipantList
        participants={participants}
        names={names}
        onRemove={generated ? undefined : (p) => remove.mutate(p.id)}
        removingId={remove.isPending ? (remove.variables as string) : null}
        onMarkLeft={generated ? (p) => markLeft.mutate(p.id) : undefined}
        onReactivate={generated ? (p) => reactivate.mutate(p.id) : undefined}
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

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700">ゲストを追加</p>
        <form onSubmit={addGuest} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="ゲスト名（アカウント不要）" htmlFor="pm-guest-name">
              <Input
                id="pm-guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="ゲスト 花子"
              />
            </Field>
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={add.isPending || !guestName.trim()}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </form>
      </div>
    </div>
  )
}
