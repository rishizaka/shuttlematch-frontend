import { Link } from '@tanstack/react-router'
import { ArrowRight, Calendar, LayoutGrid, Lock, MapPin } from 'lucide-react'
import type { PublicRoom } from '../../lib/types'
import { formatDateTime, roomStatusLabel } from '../../lib/format'

/**
 * 一覧に並ぶランダム表のカード。
 *
 * `roomId` が渡されたときだけ乱数表へのリンクになる。渡せるのは次の2通り。
 * - 終了したもの: 一覧 API が roomId を返す(過去の乱数表は記録として誰でも見られる)
 * - 開催中のもの: 「作成した」「参加した」などで既に roomId を知っている端末だけ
 *   (照合は `lib/public-room-id.ts`)
 *
 * どちらでもない開催中のものは、何が開催されているかは見えるが押せないカードとして
 * 並ぶ。中に入るには共有URL(`/r/{shareCode}`)が要るので、押せない理由をその場に書く
 * (ホバーの無いモバイルでは、押して反応しないのが不具合に見えてしまう)。
 */
export function RoomCard({ room, roomId }: { room: PublicRoom; roomId?: string | null }) {
  const closed = room.status === 'CLOSED'

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="jp-tight text-[17px] font-semibold leading-snug text-slate-900">
          {room.title}
        </h3>
        <StatusPill status={room.status} />
      </div>

      <dl className="mt-3.5 space-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-2.5">
          <Calendar className="h-[15px] w-[15px] shrink-0 text-slate-400" aria-hidden />
          <dt className="sr-only">開催日時</dt>
          <dd className="tab">{formatDateTime(room.heldAt)}</dd>
        </div>
        {room.location ? (
          <div className="flex items-center gap-2.5">
            <MapPin className="h-[15px] w-[15px] shrink-0 text-slate-400" aria-hidden />
            <dt className="sr-only">場所</dt>
            <dd>{room.location}</dd>
          </div>
        ) : null}
        {room.courtCount ? (
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="h-[15px] w-[15px] shrink-0 text-slate-400" aria-hidden />
            <dt className="sr-only">コート数</dt>
            <dd>
              <span className="tab">{room.courtCount}</span> 面
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <div className="flex items-baseline gap-1">
          <dt className="sr-only">参加人数</dt>
          <span className="fig text-2xl text-slate-900">{room.participantCount}</span>
          {room.capacity ? (
            <span className="tab text-[13px] text-slate-400">/ {room.capacity}</span>
          ) : null}
          <span className="ml-0.5 text-xs font-semibold text-slate-500">名</span>
        </div>

        {roomId ? (
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-brand-900 transition-colors group-hover:bg-accent-400"
            aria-hidden
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            共有URLが必要
          </span>
        )}
      </div>
    </>
  )

  if (!roomId) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">{body}</div>
  }

  return (
    <Link
      to="/rooms/$roomId/matches"
      params={{ roomId }}
      search={{ openExternalBrowser: 1 }}
      // 浮き上がりは共通の .lift に任せる(reduced-motion の面倒も見てくれる)。
      className={
        'lift group block rounded-2xl border bg-white p-5 shadow-sm hover:border-accent-400 ' +
        (closed ? 'border-slate-200' : 'border-accent-200')
      }
    >
      {body}
    </Link>
  )
}

/**
 * ステータスの表示。終了だけを灰色にし、それ以外(準備中・受付中・生成済み)は
 * 「今まさに動いている」ことが一目で分かるようゴールドの点を添える。
 * 文言は `roomStatusLabel` のまま変えない — 運営者は準備中と受付中を区別して使う。
 */
function StatusPill({ status }: { status: PublicRoom['status'] }) {
  const label = roomStatusLabel(status)

  if (status === 'CLOSED') {
    return (
      <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
        {label}
      </span>
    )
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700">
      <LiveDot />
      {label}
    </span>
  )
}

/** 開催中であることを示す、脈打つ点。 */
export function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span className={'relative flex h-2 w-2 shrink-0 ' + className} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
    </span>
  )
}
