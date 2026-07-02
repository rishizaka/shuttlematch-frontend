import { Check, UserRound, X } from 'lucide-react'
import {
  useApproveJoinRequest,
  useJoinRequests,
  useRejectJoinRequest,
} from '../../hooks/queries'
import { Card, CardBody, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { shortId } from '../../lib/format'

/**
 * 参加申請の一覧と承認/却下(オーガナイザー用)。
 */
export function JoinRequestsCard({ circleId }: { circleId: string }) {
  const { data: requests, isLoading } = useJoinRequests(circleId, 'PENDING')
  const approve = useApproveJoinRequest(circleId)
  const reject = useRejectJoinRequest(circleId)

  const pendingId =
    (approve.isPending && (approve.variables as string)) ||
    (reject.isPending && (reject.variables as string)) ||
    null

  return (
    <Card>
      <CardHeader
        title="参加申請"
        action={
          requests && requests.length > 0 ? (
            <Badge tone="amber">{requests.length}</Badge>
          ) : undefined
        }
      />
      <CardBody>
        {isLoading ? (
          <Spinner />
        ) : !requests || requests.length === 0 ? (
          <p className="text-sm text-slate-500">承認待ちの申請はありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-2 text-sm text-slate-800">
                  <UserRound className="h-4 w-4 text-slate-400" aria-hidden />
                  {shortId(r.userId)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => approve.mutate(r.id)}
                    disabled={pendingId === r.id}
                    aria-label="承認"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => reject.mutate(r.id)}
                    disabled={pendingId === r.id}
                    aria-label="却下"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    却下
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {approve.isError ? (
          <p className="mt-2 text-xs text-red-600">{(approve.error as Error).message}</p>
        ) : null}
      </CardBody>
    </Card>
  )
}
