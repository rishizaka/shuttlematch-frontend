import { Link, useRouter } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { Button } from '../ui/Button'

export function Header() {
  const { user, logout, isAuthenticated } = useCurrentUser()
  const router = useRouter()

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            🏸
          </span>
          <span className="text-lg font-bold text-slate-900">ShuttleMatch</span>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {isAuthenticated ? (
            <>
              <span className="hidden text-slate-600 sm:inline">{user?.name} さん</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout()
                  void router.navigate({ to: '/login' })
                }}
              >
                <LogOut className="h-4 w-4" />
                ログアウト
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-600 hover:text-slate-900">
                ログイン
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
              >
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
