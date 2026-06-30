import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useAddParticipant,
  useRemoveParticipant,
  useSession,
  useUserNames,
} from '../../hooks/queries'
import type { Participant } from '../../lib/types'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { ErrorBlock, LoadingBlock } from '../../components/ui/Spinner'
import { ParticipantList } from '../../components/session/ParticipantList'

export const Route = createFileRoute('/organizer/sessions/$sessionId/participants')({
  component: ManageParticipantsPage,
})

function ManageParticipantsPage() {
  const { sessionId } = Route.useParams()
  const { data: session, isLoading, isError, error } = useSession(sessionId)
  const add = useAddParticipant(sessionId)
  const remove = useRemoveParticipant(sessionId)

  const [memberId, setMemberId] = useState('')
  const [guestName, setGuestName] = useState('')

  const userIds = (session?.participants ?? [])
    .map((p) => p.userId)
    .filter((id): id is string => !!id)
  const names = useUserNames(userIds)

  if (isLoading) return <LoadingBlock />
  if (isError || !session) {
    return <ErrorBlock message={error instanceof Error ? error.message : 'セッションを取得できませんでした'} />
  }

  const addMember = (e: React.FormEvent) => {
    e.preventDefault()
    add.mutate({ userId: memberId.trim() }, { onSuccess: () => setMemberId('') })
  }
  const addGuest = (e: React.FormEvent) => {
    e.preventDefault()
    add.mutate({ guestName: guestName.trim() }, { onSuccess: () => setGuestName('') })
  }
  const onRemove = (p: Participant) => remove.mutate(p.id)

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/sessions/$sessionId"
          params={{ sessionId }}
          className="text-sm text-emerald-600 hover:underline"
        >
          ← セッションへ戻る
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">参加者の管理</h1>
        <p className="text-sm text-slate-500">{session.title}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="メンバーを代理登録" description="サークルメンバーのユーザー ID で追加します。" />
          <CardBody>
            <form onSubmit={addMember} className="space-y-3">
              <Field label="ユーザー ID" htmlFor="participant-user-id">
                <Input
                  id="participant-user-id"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  required
                  placeholder="UUID"
                />
              </Field>
              <Button type="submit" size="sm" disabled={add.isPending || !memberId.trim()}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="ゲストを追加" description="アカウントの無い参加者を名前のみで追加します。" />
          <CardBody>
            <form onSubmit={addGuest} className="space-y-3">
              <Field label="ゲスト名" htmlFor="guest-name">
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                  placeholder="ゲスト 花子"
                />
              </Field>
              <Button type="submit" size="sm" variant="secondary" disabled={add.isPending || !guestName.trim()}>
                <Plus className="h-4 w-4" />
                追加
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      {add.isError ? (
        <ErrorBlock message={(add.error as Error).message} />
      ) : null}

      <Card>
        <CardHeader title={`参加者一覧 (${session.participantCount})`} />
        <CardBody>
          <ParticipantList
            participants={session.participants}
            names={names}
            onRemove={onRemove}
            removingId={remove.isPending ? (remove.variables as string) : null}
          />
        </CardBody>
      </Card>
    </div>
  )
}
