import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Plus, UserRound } from 'lucide-react'
import { useAddMember, useCircle, useSessions } from '../../hooks/queries'
import { useCurrentUser, useKnownSessionIds } from '../../hooks/useCurrentUser'
import { addCircleId } from '../../lib/local-store'
import type { Circle, MemberRole } from '../../lib/types'
import { joinPolicyLabel, memberRoleLabel } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { SessionCard } from '../../components/session/SessionCard'

export const Route = createFileRoute('/circles/$circleId')({ component: CirclePage })

/** 現在ユーザーがこのサークルのオーガナイザーか。 */
function isOrganizer(circle: Circle, userId: string | undefined): boolean {
  if (!userId) return false
  if (circle.createdBy === userId) return true
  return circle.members.some((m) => m.userId === userId && m.role === 'ORGANIZER')
}

function CirclePage() {
  const { circleId } = Route.useParams()
  const { user } = useCurrentUser()
  const { data: circle, isLoading, isError, error } = useCircle(circleId)

  // 一度開いたサークルはダッシュボードに残す。
  useEffect(() => {
    if (circle) addCircleId(circle.id)
  }, [circle])

  if (isLoading) return <LoadingBlock />
  if (isError || !circle) {
    return <ErrorBlock message={error instanceof Error ? error.message : 'サークルを取得できませんでした'} />
  }

  const organizer = isOrganizer(circle, user?.id)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{circle.name}</h1>
          {circle.description ? (
            <p className="mt-1 text-slate-600">{circle.description}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            <Badge>{joinPolicyLabel(circle.joinPolicy)}</Badge>
            {organizer ? <Badge tone="emerald">オーガナイザー</Badge> : null}
          </div>
        </div>
        {organizer ? (
          <Link
            to="/organizer/sessions/new"
            search={{ circleId: circle.id }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            セッションを作成
          </Link>
        ) : null}
      </div>

      <InviteBox circleId={circle.id} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SessionsOfCircle circleId={circle.id} />
        </div>
        <div className="space-y-6">
          <MembersCard circle={circle} />
          {organizer ? <AddMemberCard circleId={circle.id} /> : null}
        </div>
      </div>
    </div>
  )
}

function InviteBox({ circleId }: { circleId: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">招待用サークル ID</p>
          <code className="text-sm text-slate-500">{circleId}</code>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(circleId)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'コピーしました' : 'コピー'}
        </Button>
      </CardBody>
    </Card>
  )
}

function SessionsOfCircle({ circleId }: { circleId: string }) {
  const sessionIds = useKnownSessionIds()
  const sessions = useSessions(sessionIds)
  const ofCircle = sessions
    .map((q) => q.data)
    .filter((s) => s && s.circleId === circleId)

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">セッション</h2>
      {ofCircle.length === 0 ? (
        <p className="text-sm text-slate-500">このサークルのセッションはまだありません。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ofCircle.map((s) => (s ? <SessionCard key={s.id} session={s} /> : null))}
        </div>
      )}
    </section>
  )
}

function MembersCard({ circle }: { circle: Circle }) {
  return (
    <Card>
      <CardHeader title={`メンバー (${circle.members.length})`} />
      <CardBody>
        <ul className="divide-y divide-slate-100">
          {circle.members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2 text-slate-800">
                <UserRound className="h-4 w-4 text-slate-400" aria-hidden />
                {m.userId.slice(0, 8)}
              </span>
              <Badge tone={m.role === 'ORGANIZER' ? 'emerald' : 'slate'}>
                {memberRoleLabel(m.role)}
              </Badge>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

function AddMemberCard({ circleId }: { circleId: string }) {
  const add = useAddMember(circleId)
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<MemberRole>('PLAYER')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    add.mutate({ userId: userId.trim(), role }, { onSuccess: () => setUserId('') })
  }

  return (
    <Card>
      <CardHeader title="メンバーを追加" />
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <Field label="ユーザー ID" htmlFor="member-id">
            <Input
              id="member-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              placeholder="UUID"
            />
          </Field>
          <Field label="役割" htmlFor="member-role">
            <Select id="member-role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
              <option value="PLAYER">プレイヤー</option>
              <option value="ORGANIZER">オーガナイザー</option>
            </Select>
          </Field>
          {add.isError ? (
            <p className="text-sm text-red-600">{(add.error as Error).message}</p>
          ) : null}
          <Button type="submit" size="sm" disabled={add.isPending || !userId.trim()}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
