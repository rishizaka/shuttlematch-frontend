import type { Session, User } from '../../lib/types'
import { useAddParticipant, useRemoveParticipant } from '../../hooks/queries'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

/** 参加登録が可能なステータスか (試合生成前まで)。 */
export function canJoin(session: Session): boolean {
  return session.status === 'PREPARING' || session.status === 'OPEN'
}

export function JoinButton({ session, user }: { session: Session; user: User | null }) {
  const add = useAddParticipant(session.id)
  const remove = useRemoveParticipant(session.id)

  if (!user) {
    return <p className="text-sm text-slate-500">参加するにはログインしてください。</p>
  }

  const mine = session.participants.find((p) => p.userId === user.id)
  const locked = !canJoin(session)

  if (mine) {
    return (
      <div className="space-y-1">
        <Button
          variant="secondary"
          onClick={() => remove.mutate(mine.id)}
          disabled={locked || remove.isPending}
        >
          {remove.isPending ? <Spinner /> : null}
          参加をキャンセル
        </Button>
        {locked ? (
          <p className="text-xs text-slate-500">試合生成後はキャンセルできません。</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        onClick={() => add.mutate({ userId: user.id })}
        disabled={locked || add.isPending}
      >
        {add.isPending ? <Spinner /> : null}
        参加する
      </Button>
      {locked ? (
        <p className="text-xs text-slate-500">このセッションは受付を終了しています。</p>
      ) : null}
      {add.isError ? (
        <p className="text-xs text-red-600">{(add.error as Error).message}</p>
      ) : null}
    </div>
  )
}
