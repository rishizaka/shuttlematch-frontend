import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useCreateUser } from '../hooks/queries'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export const Route = createFileRoute('/signup')({ component: SignupPage })

function SignupPage() {
  const router = useRouter()
  const { login } = useCurrentUser()
  const createUser = useCreateUser()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    createUser.mutate(
      { name, email },
      {
        onSuccess: (user) => {
          login(user)
          void router.navigate({ to: '/' })
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader
          title="新規登録"
          description="氏名とメールアドレスでアカウントを作成します。"
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <Field label="氏名" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="山田 太郎"
              />
            </Field>
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
            {createUser.isError ? (
              <p className="text-sm text-red-600">{(createUser.error as Error).message}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={createUser.isPending}>
              {createUser.isPending ? '作成中…' : 'アカウントを作成'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            すでにアカウントをお持ちですか？{' '}
            <Link to="/login" className="text-emerald-600 hover:underline">
              ログイン
            </Link>
          </p>
        </CardBody>
      </Card>
      <p className="mt-3 text-center text-xs text-slate-400">
        ※ 認証 (Cognito) は導入準備中のため、現状は簡易的なアカウント作成です。
      </p>
    </div>
  )
}
