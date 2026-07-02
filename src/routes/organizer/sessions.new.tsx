import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useCreateSession } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
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
  const [courtCount, setCourtCount] = useState('')
  const [attempted, setAttempted] = useState(false)

  const titleError = !title.trim() ? 'タイトルを入力してください' : null
  const courtError = !courtCount || Number(courtCount) < 1 ? 'コート数を入力してください' : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (titleError || courtError) return
    create.mutate(
      {
        title: title.trim(),
        // 開催日時はセッション作成日時を自動設定する。
        heldAt: new Date().toISOString(),
        location: null,
        capacity: null,
        courtCount: Number(courtCount),
        // 公開範囲は「誰でも参加」固定。
        visibility: 'PUBLIC',
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
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="タイトル" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="6/30 夜練"
              />
              {attempted && titleError ? (
                <p className="mt-1 text-sm text-red-600">{titleError}</p>
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
