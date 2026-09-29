import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Card, CardBody } from './Card'

/**
 * 「試合表を作る」への導線カード。/guide の記事詳細・一覧など、検索から来た読み物系
 * ページの主要な着地点に置く。記事を読んだだけで離脱させず、ツール本体へ1タップで
 * つなげるのが狙い(検索エンジンからの流入がここで完結してしまわないように)。
 */
export function CreateRoomCta() {
  return (
    <Card className="border-brand-200 bg-brand-50">
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-brand-800">
          試合表はShuttleMatchで無料ですぐ作れます。
        </p>
        <Link
          to="/organizer/rooms/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          乱数表をつくる
        </Link>
      </CardBody>
    </Card>
  )
}
