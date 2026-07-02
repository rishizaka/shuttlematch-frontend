import { Link } from '@tanstack/react-router'
import type { Session, User } from '../../lib/types'
import { JoinButton } from './JoinButton'

export type ParticipationMode = 'login' | 'join'

/**
 * ユーザーの状態から参加動線を決める。未ログインは閲覧のみ、ログイン済みは参加。
 */
export function resolveParticipationMode(user: User | null): ParticipationMode {
  return user ? 'join' : 'login'
}

/**
 * ルームへの参加動線。未ログインは閲覧のみ、ログイン済みは参加ボタン。
 */
export function ParticipationPanel({
  session,
  user,
}: {
  session: Session
  user: User | null
}) {
  const mode = resolveParticipationMode(user)

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
