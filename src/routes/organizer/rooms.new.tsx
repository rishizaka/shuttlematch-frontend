import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuickCreateRoom } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { userApi } from '../../lib/api'
import { defaultRoomTitle } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'

export const Route = createFileRoute('/organizer/rooms/new')({
  component: NewRoomPage,
})

function NewRoomPage() {
  const router = useRouter()
  const { user, login } = useCurrentUser()
  const create = useQuickCreateRoom()

  const [title, setTitle] = useState(defaultRoomTitle())
  const [participantCount, setParticipantCount] = useState('')
  const [courtCount, setCourtCount] = useState('2')
  const [attempted, setAttempted] = useState(false)
  // 未ログイン時のゲストユーザー発行の状態。
  const [issuingGuest, setIssuingGuest] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const courts = Number(courtCount)
  const people = Number(participantCount)
  const required = (courts || 1) * 4

  const titleError = !title.trim() ? 'タイトルを入力してください' : null
  const courtError = !courtCount || courts < 1 ? 'コート数を入力してください' : null
  const peopleError = !participantCount
    ? '参加人数を入力してください'
    : people < required
      ? `コート ${courts || 1} 面には最低 ${required} 人必要です`
      : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (titleError || courtError || peopleError) return

    // 未ログインならゲストユーザーを発行し、この端末のユーザーとして保存する。
    // 以後は通常ログインと同じく user.id === room.createdBy で運営者と判定される。
    let creatorId = user?.id
    if (!creatorId) {
      setGuestError(null)
      setIssuingGuest(true)
      try {
        const guest = await userApi.createGuest()
        login(guest)
        creatorId = guest.id
      } catch (err) {
        setGuestError(
          err instanceof Error ? err.message : 'ゲストユーザーの発行に失敗しました',
        )
        return
      } finally {
        setIssuingGuest(false)
      }
    }

    create.mutate(
      {
        title: title.trim(),
        courtCount: courts,
        participantCount: people,
        createdBy: creatorId,
      },
      {
        onSuccess: (room) => {
          void router.navigate({
            to: '/rooms/$roomId/matches',
            params: { roomId: room.id },
            search: { openExternalBrowser: 1 },
          })
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader
          title="ルームを作成"
          description="人数とコート数を入れるだけ。番号で試合表を作り、名前は後から付けられます。"
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="参加人数" htmlFor="participantCount">
              <Input
                id="participantCount"
                type="number"
                min={required}
                value={participantCount}
                onChange={(e) => setParticipantCount(e.target.value)}
                placeholder="例: 8"
              />
              {attempted && peopleError ? (
                <p className="mt-1 text-sm text-red-600">{peopleError}</p>
              ) : null}
            </Field>
            <Field label="コート数" htmlFor="courtCount">
              <Input
                id="courtCount"
                type="number"
                min={1}
                value={courtCount}
                onChange={(e) => setCourtCount(e.target.value)}
                placeholder="例: 2"
              />
              {attempted && courtError ? (
                <p className="mt-1 text-sm text-red-600">{courtError}</p>
              ) : null}
            </Field>
            <Field label="タイトル" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="7/2 夜練"
              />
              {attempted && titleError ? (
                <p className="mt-1 text-sm text-red-600">{titleError}</p>
              ) : null}
            </Field>
            {guestError ? <p className="text-sm text-red-600">{guestError}</p> : null}
            {create.isError ? (
              <p className="text-sm text-red-600">{(create.error as Error).message}</p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={create.isPending || issuingGuest}
            >
              {create.isPending || issuingGuest ? '作成中…' : '試合表を作成'}
            </Button>
            {!user ? (
              <p className="text-center text-xs text-slate-400">
                ログインなしで作成できます。この端末がルームの運営者になります。
              </p>
            ) : null}
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
