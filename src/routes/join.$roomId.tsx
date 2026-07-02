import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useAddParticipant, useRoom } from '../hooks/queries'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'

export const Route = createFileRoute('/join/$roomId')({ component: JoinPage })

/**
 * 招待リンク用の公開参加ページ。ログイン不要で、ニックネームを入力すると
 * ゲストとしてルームに参加できる。
 */
function JoinPage() {
  const { roomId } = Route.useParams()
  const { data: room, isLoading, isError } = useRoom(roomId)
  const add = useAddParticipant(roomId)
  const [nickname, setNickname] = useState('')
  const [joinedName, setJoinedName] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = nickname.trim()
    if (!name) return
    add.mutate({ guestName: name }, { onSuccess: () => setJoinedName(name) })
  }

  if (isLoading) return <LoadingBlock />
  if (isError || !room) {
    return <ErrorBlock message="ルームが見つかりません。招待リンクを確認してください。" />
  }

  const acceptsJoin = room.status === 'OPEN' || room.status === 'PREPARING'

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader
          title={room.title}
          description={joinedName ? undefined : 'ニックネームを入力して参加します。'}
        />
        <CardBody>
          {joinedName ? (
            <div className="space-y-4 text-center">
              <p className="text-3xl">🏸</p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{joinedName}</span> さんとして参加しました！
              </p>
              <Link
                to="/rooms/$roomId/matches"
                params={{ roomId }}
                search={{ openExternalBrowser: 1 }}
                className="inline-block text-sm text-emerald-600 hover:underline"
              >
                試合表を見る →
              </Link>
            </div>
          ) : !acceptsJoin ? (
            <p className="text-sm text-slate-500">
              このルームは現在参加を受け付けていません。
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="ニックネーム" htmlFor="nickname">
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  placeholder="やまだ"
                  autoFocus
                />
              </Field>
              {add.isError ? (
                <p className="text-sm text-red-600">{(add.error as Error).message}</p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={add.isPending || !nickname.trim()}
              >
                {add.isPending ? '参加中…' : '参加する'}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
