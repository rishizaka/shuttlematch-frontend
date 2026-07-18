import { Link, createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-lg font-semibold text-slate-900">ページが見つかりません</p>
      <p className="mt-2 text-sm text-slate-500">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        ダッシュボードへ戻る
      </Link>
    </div>
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
