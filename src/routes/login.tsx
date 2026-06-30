import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { userApi } from '../lib/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const router = useRouter()
  const { login } = useCurrentUser()
  const [userId, setUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // 認証導入前のため、ユーザー ID で既存アカウントを復元する暫定フロー。
      const user = await userApi.get(userId.trim())
      login(user)
      void router.navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader
          title="ログイン"
          description="既存アカウントのユーザー ID で再開します。"
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="ユーザー ID"
              htmlFor="userId"
              hint="新規登録時に発行された UUID を入力してください。"
            >
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading || !userId.trim()}>
              {loading ? '確認中…' : 'ログイン'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            アカウントがありませんか？{' '}
            <Link to="/signup" className="text-emerald-600 hover:underline">
              新規登録
            </Link>
          </p>
        </CardBody>
      </Card>
      <p className="mt-3 text-center text-xs text-slate-400">
        ※ メール＋パスワード / Google ログインは Cognito 導入後に対応予定です。
      </p>
    </div>
  )
}
