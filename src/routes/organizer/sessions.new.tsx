import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useCreateSession } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { toOffsetDateTime } from '../../lib/format'
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
  const create = useCreateSession(circleId)

  const [title, setTitle] = useState('')
  const [heldAt, setHeldAt] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate(
      {
        title,
        heldAt: toOffsetDateTime(heldAt),
        location: location || null,
        capacity: capacity ? Number(capacity) : null,
        // createdBy は本来オーガナイザー本人。認証導入前のため現在ユーザーの identity を渡す。
        createdBy: user?.id ?? '',
      },
      {
        onSuccess: (session) => {
          void router.navigate({
            to: '/sessions/$sessionId',
            params: { sessionId: session.id },
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
        <CardHeader title="セッションを作成" description="活動日 (練習会) を登録します。" />
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <Field label="タイトル" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="6/30 夜練"
              />
            </Field>
            <Field label="開催日時" htmlFor="heldAt">
              <Input
                id="heldAt"
                type="datetime-local"
                value={heldAt}
                onChange={(e) => setHeldAt(e.target.value)}
                required
              />
            </Field>
            <Field label="場所 (任意)" htmlFor="location">
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="区民体育館 第1コート"
              />
            </Field>
            <Field label="定員 (任意)" htmlFor="capacity">
              <Input
                id="capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </Field>
            {create.isError ? (
              <p className="text-sm text-red-600">{(create.error as Error).message}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? '作成中…' : 'セッションを作成'}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
