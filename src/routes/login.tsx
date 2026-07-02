import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { authApi } from '../lib/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const router = useRouter()
  const { login } = useCurrentUser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await authApi.login(email.trim(), password)
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
        <CardHeader title="ログイン" description="メールアドレスとパスワードでログインします。" />
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <Field label="メールアドレス" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="taro@example.com"
              />
            </Field>
            <Field label="パスワード" htmlFor="password">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email.trim() || !password}
            >
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
        ※ パスワード未設定の既存ユーザーは「abcd1234」でログインできます。
      </p>
    </div>
  )
}
