import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuickCreateSession } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { defaultSessionTitle } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'

export const Route = createFileRoute('/organizer/sessions/new')({
  validateSearch: (search: Record<string, unknown>): { circleId: string } => ({
    circleId: typeof search.circleId === 'string' ? search.circleId : '',
  }),
  component: NewSessionPage,
})

function NewSessionPage() {
  const { circleId } = Route.useSearch()
  const router = useRouter()
  const { user } = useCurrentUser()
  const create = useQuickCreateSession(circleId)

  const [title, setTitle] = useState(defaultSessionTitle())
  const [participantCount, setParticipantCount] = useState('')
  const [courtCount, setCourtCount] = useState('1')
  const [attempted, setAttempted] = useState(false)

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (titleError || courtError || peopleError) return
    create.mutate(
      {
        title: title.trim(),
        courtCount: courts,
        participantCount: people,
        createdBy: user?.id ?? '',
      },
      {
        onSuccess: (session) => {
          void router.navigate({
            to: '/sessions/$sessionId/matches',
            params: { sessionId: session.id },
            search: { openExternalBrowser: 1 },
          })
        },
      },
    )
  }

  if (!circleId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-red-600">
            サークルが指定されていません。サークル画面から「セッションを作成」を開いてください。
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader
          title="セッションを作成"
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
            {create.isError ? (
              <p className="text-sm text-red-600">{(create.error as Error).message}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? '作成中…' : '試合表を作成'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
