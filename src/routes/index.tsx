import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useCurrentUser, useKnownCircleIds } from '../hooks/useCurrentUser'
import { useCircles, useCreateCircle, useSessionList } from '../hooks/queries'
import { circleApi } from '../lib/api'
import { addCircleId } from '../lib/local-store'
import type { JoinPolicy } from '../lib/types'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { Badge } from '../components/ui/Badge'
import { ErrorBlock, LoadingBlock } from '../components/ui/Spinner'
import { SessionCard } from '../components/session/SessionCard'
import { joinPolicyLabel } from '../lib/format'

export const Route = createFileRoute('/')({ component: Dashboard })

function Dashboard() {
  const { user, isAuthenticated } = useCurrentUser()

  return (
    <div className="space-y-8">
      {isAuthenticated && user ? (
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
          <p className="text-sm text-slate-500">こんにちは、{user.name} さん</p>
        </div>
      ) : (
        <GuestHero />
      )}

      <OpenSessionsSection />

      {isAuthenticated && user ? (
        <CirclesSection createdBy={user.id} userId={user.id} />
      ) : null}
    </div>
  )
}

function GuestHero() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
      <div className="text-4xl" aria-hidden>
        🏸
      </div>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">ShuttleMatch</h1>
      <p className="mt-2 text-slate-600">
        募集中の練習会をチェックして参加しよう。出欠管理とダブルスの組み合わせをかんたんに。
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Link
          to="/signup"
          className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700"
        >
          新規登録
        </Link>
        <Link
          to="/login"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          ログイン
        </Link>
      </div>
    </div>
  )
}

function OpenSessionsSection() {
  const { data: sessions, isLoading, isError, error } = useSessionList('OPEN')

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">募集中のセッション</h2>

      {isLoading ? <LoadingBlock /> : null}
      {isError ? (
        <ErrorBlock
          message={
            error instanceof Error
              ? `セッション一覧を取得できませんでした: ${error.message}`
              : 'セッション一覧を取得できませんでした'
          }
        />
      ) : null}

      {sessions && sessions.length === 0 ? (
        <p className="text-sm text-slate-500">現在募集中のセッションはありません。</p>
      ) : null}

      {sessions && sessions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function CirclesSection({ createdBy, userId }: { createdBy: string; userId: string }) {
  const circleIds = useKnownCircleIds()
  const circles = useCircles(circleIds)

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">マイサークル</h2>

      {circleIds.length === 0 ? (
        <p className="text-sm text-slate-500">
          まだサークルがありません。新しく作るか、招待 ID で参加しましょう。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {circles.map((q, i) =>
            q.data ? (
              <Link
                key={q.data.id}
                to="/circles/$circleId"
                params={{ circleId: q.data.id }}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{q.data.name}</span>
                  <Badge>{joinPolicyLabel(q.data.joinPolicy)}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                  <Users className="h-4 w-4" aria-hidden />
                  {q.data.members.length} 名
                </p>
              </Link>
            ) : (
              <div
                key={circleIds[i]}
                className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400"
              >
                {q.isLoading ? '読み込み中…' : '取得に失敗しました'}
              </div>
            ),
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <CreateCircleForm createdBy={createdBy} />
        <JoinCircleForm userId={userId} />
      </div>
    </section>
  )
}

function CreateCircleForm({ createdBy }: { createdBy: string }) {
  const create = useCreateCircle()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('OPEN')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate(
      { name, description: description || null, joinPolicy, createdBy },
      {
        onSuccess: () => {
          setName('')
          setDescription('')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader title="サークルを作成" />
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <Field label="サークル名" htmlFor="circle-name">
            <Input
              id="circle-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="渋谷バドミントンクラブ"
            />
          </Field>
          <Field label="説明 (任意)" htmlFor="circle-desc">
            <Textarea
              id="circle-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
          <Field label="参加方式" htmlFor="circle-policy">
            <Select
              id="circle-policy"
              value={joinPolicy}
              onChange={(e) => setJoinPolicy(e.target.value as JoinPolicy)}
            >
              <option value="OPEN">自由参加</option>
              <option value="APPROVAL">承認制</option>
            </Select>
          </Field>
          {create.isError ? (
            <p className="text-sm text-red-600">{(create.error as Error).message}</p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            <Plus className="h-4 w-4" />
            作成する
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

function JoinCircleForm({ userId }: { userId: string }) {
  const [circleId, setCircleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(null)
    setLoading(true)
    try {
      const id = circleId.trim()
      const circle = await circleApi.addMember(id, { userId, role: 'PLAYER' })
      addCircleId(circle.id)
      setDone(`「${circle.name}」に参加しました`)
      setCircleId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader title="サークルに参加" description="招待されたサークル ID を入力します。" />
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <Field label="サークル ID" htmlFor="join-circle-id">
            <Input
              id="join-circle-id"
              value={circleId}
              onChange={(e) => setCircleId(e.target.value)}
              required
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {done ? <p className="text-sm text-emerald-600">{done}</p> : null}
          <Button type="submit" variant="secondary" disabled={loading || !circleId.trim()}>
            参加する
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
