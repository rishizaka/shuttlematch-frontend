import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { Circle, Session, User } from '../../lib/types'
import { useApplyForMembership } from '../../hooks/queries'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { JoinButton } from './JoinButton'

export type ParticipationMode = 'login' | 'join' | 'apply'

/**
 * セッションの状態とユーザーのメンバーシップから参加動線を決める。
 * - login: 未ログイン(閲覧のみ)
 * - join : 参加ボタン(公開、またはメンバー限定だがメンバー)
 * - apply: メンバー申請(メンバー限定 × 非メンバー)
 */
export function resolveParticipationMode(
  session: Pick<Session, 'visibility'>,
  user: User | null,
  isMember: boolean,
): ParticipationMode {
  if (!user) return 'login'
  if (session.visibility === 'MEMBERS_ONLY' && !isMember) return 'apply'
  return 'join'
}

/**
 * セッションへの参加動線。状態に応じて出し分ける。
 * - 未ログイン: 閲覧のみ(ログイン導線)
 * - 公開セッション: 参加ボタン
 * - メンバー限定 × メンバー: 参加ボタン
 * - メンバー限定 × 非メンバー: メンバー申請ボタン
 */
export function ParticipationPanel({
  session,
  user,
  circle,
  circleLoading,
}: {
  session: Session
  user: User | null
  circle: Circle | undefined
  circleLoading: boolean
}) {
  const isMember = circle?.members.some((m) => m.userId === user?.id) ?? false
  const mode = resolveParticipationMode(session, user, isMember)

  if (mode === 'login') {
    return (
      <div className="text-sm text-slate-600">
        <Link to="/login" className="font-medium text-emerald-600 hover:underline">
          ログイン
        </Link>{' '}
        すると参加できます。
      </div>
    )
  }

  if (mode === 'apply') {
    // メンバーシップ判定にはサークル情報が要るので、未取得なら待つ。
    if (circleLoading) {
      return <Spinner />
    }
    return <MembershipApplyPanel circleId={session.circleId} userId={user!.id} />
  }

  return <JoinButton session={session} user={user} />
}

function MembershipApplyPanel({ circleId, userId }: { circleId: string; userId: string }) {
  const apply = useApplyForMembership(circleId)
  const [applied, setApplied] = useState(false)

  if (applied || apply.isSuccess) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        参加申請を送信しました。オーガナイザーの承認をお待ちください。
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm text-slate-600">
        <Lock className="h-4 w-4 text-amber-500" aria-hidden />
        メンバー限定セッションです
      </div>
      <Button
        onClick={() => apply.mutate(userId, { onSuccess: () => setApplied(true) })}
        disabled={apply.isPending}
      >
        {apply.isPending ? <Spinner /> : null}
        メンバー申請をする
      </Button>
      {apply.isError ? (
        <p className="text-xs text-red-600">{(apply.error as Error).message}</p>
      ) : null}
    </div>
  )
}
