import { Link } from '@tanstack/react-router'
import type { Circle, Session, User } from '../../lib/types'
import { JoinButton } from './JoinButton'

export type ParticipationMode = 'login' | 'join'

/**
 * ユーザーの状態から参加動線を決める。
 * - login: 未ログイン(閲覧のみ)
 * - join : 参加ボタン
 */
export function resolveParticipationMode(
  _session: Pick<Session, 'visibility'>,
  user: User | null,
): ParticipationMode {
  if (!user) return 'login'
  return 'join'
}

/**
 * セッションへの参加動線。未ログインは閲覧のみ、ログイン済みは参加ボタン。
 */
export function ParticipationPanel({
  session,
  user,
}: {
  session: Session
  user: User | null
  circle?: Circle | undefined
  circleLoading?: boolean
}) {
  const mode = resolveParticipationMode(session, user)

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

  return <JoinButton session={session} user={user} />
}
