import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { adminApi } from '../lib/api'
import { clearAdminToken, getAdminToken, setAdminToken } from '../lib/admin-token'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'

export const Route = createFileRoute('/admin')({
  // 運営者本人しか使わない画面。検索には出さない。
  head: () => ({ meta: [{ name: 'robots', content: 'noindex,nofollow' }] }),
  component: AdminPage,
})

/**
 * 管理者モードの設定画面。
 *
 * サーバーの `APP_ADMIN_TOKEN` と同じ値をここに貼ると、この端末だけ一覧に roomId が
 * 載るようになり、自分が作成・参加していないランダム表も開ける。
 * **できるのは閲覧だけ**で、削除や試合表の変更には効かない。
 */
function AdminPage() {
  const qc = useQueryClient()
  // SSR では localStorage を読めない。初期値を null(未確定)にしておき、マウント後に
  // useEffect で確定させる。**レンダー中に setState してはいけない** —
  // それをやると SSR の出力とクライアントの初回描画が食い違い、
  // ハイドレーション不一致になる(実際に React の警告が出た)。
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [token, setToken] = useState('')
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // マウント後に、この端末の保存状態を反映する。
  useEffect(() => {
    setEnabled(getAdminToken() !== null)
  }, [])

  const save = async () => {
    const value = token.trim()
    if (!value) {
      setError('トークンを入力してください')
      return
    }
    setChecking(true)
    setError(null)
    try {
      await adminApi.verify(value)
      setAdminToken(value)
      setToken('')
      setEnabled(true)
      // 一覧は roomId が増えた形に変わるので、キャッシュを捨てて取り直す。
      await qc.invalidateQueries()
    } catch {
      setError('このトークンでは確認できませんでした。サーバーの設定値と同じか確かめてください。')
    } finally {
      setChecking(false)
    }
  }

  const disable = async () => {
    clearAdminToken()
    setEnabled(false)
    await qc.invalidateQueries()
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader
          title="管理者モード"
          description="この端末だけ、すべてのランダム表を開けるようにします。"
        />
        <CardBody className="space-y-5">
          {enabled === null ? (
            // 端末の保存状態が分かるまで(マウント直後まで)の置き場。ここでフォームを
            // 出してしまうと、有効な端末で一瞬「未設定」に見えてしまう。
            <p className="text-sm text-slate-400">読み込み中…</p>
          ) : enabled ? (
            <>
              <p className="flex items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-700">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                この端末では管理者モードが有効です
              </p>
              <p className="text-sm leading-relaxed text-slate-600">
                TOP と「過去の開催」の一覧から、自分が作成・参加していないものも開けます。
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  TOP を見る →
                </Link>
                <Link
                  to="/past"
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  過去の開催を見る →
                </Link>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <Button variant="secondary" onClick={() => void disable()}>
                  この端末の管理者モードを解除
                </Button>
              </div>
            </>
          ) : (
            <>
              <Field label="管理者トークン" htmlFor="admin-token">
                <div className="flex gap-2">
                  <Input
                    id="admin-token"
                    type={visible ? 'text' : 'password'}
                    autoComplete="off"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="サーバーに設定した APP_ADMIN_TOKEN"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'トークンを隠す' : 'トークンを表示する'}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 text-slate-500 transition hover:bg-slate-50"
                  >
                    {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button onClick={() => void save()} disabled={checking} className="w-full">
                {checking ? '確認中…' : '保存して有効にする'}
              </Button>
            </>
          )}

          <div className="border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
            <p>
              できるのは<strong className="font-semibold text-slate-700">閲覧だけ</strong>です。
              削除・終了・試合表の作り直しには効きません。
            </p>
            <p className="mt-2">
              トークンはこの端末のブラウザに保存されます。共有の端末では使わないでください。
              漏れたと思ったら、サーバーの <code>APP_ADMIN_TOKEN</code> を変えれば無効になります。
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
