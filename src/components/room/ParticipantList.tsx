import { LogOut, RotateCcw, Trash2, Undo2, Unlink } from 'lucide-react'
import type { Participant } from '../../lib/types'
import { FREE_SLOT } from '../../lib/guests'
import { Badge } from '../ui/Badge'

/**
 * 「フリーにする」を出してよい在席枠か。
 *
 * 番号のまま(まだ誰も名乗っていない)の枠にも出す。人数を指定して作ったルームでも
 * 各自が ClaimNumberModal で自分の番号を選べるため、番号だけの枠にも「この枠は
 * 今のところ誰も来ない」という意思表示に意味がある。フリーにしても在席のまま
 * (試合表の枠は変わらない)なので、早退と違って再編成は不要。
 * 早退中と、既にフリーの枠には出さない(解くものが無い)。
 */
export function canMakeFree(p: Participant): boolean {
  if (p.status === 'LEFT') return false
  return p.guestName?.trim() !== FREE_SLOT
}

/** 現在フリー枠になっている在席者か。「フリーを解除」を出してよいかの判定に使う。 */
export function isFreeSlot(p: Participant): boolean {
  return p.status !== 'LEFT' && p.guestName?.trim() === FREE_SLOT
}

export function ParticipantList({
  participants,
  onRemove,
  removingId,
  onMarkLeft,
  onReactivate,
  onMakeFree,
  onUnfree,
  updatingId,
  selecting = false,
  selectedIds,
  onToggleSelect,
}: {
  participants: Participant[]
  /** 指定すると各行に削除ボタンを表示する (オーガナイザー用・生成前)。 */
  onRemove?: (participant: Participant) => void
  removingId?: string | null
  /** 指定すると在席者に早退ボタンを表示する (オーガナイザー用・生成後)。 */
  onMarkLeft?: (participant: Participant) => void
  /** 指定すると早退者に復帰ボタンを表示する (オーガナイザー用)。 */
  onReactivate?: (participant: Participant) => void
  /** 指定すると在席者に「フリーにする」(番号とユーザーの紐付け解除)を表示する。 */
  onMakeFree?: (participant: Participant) => void
  /** 指定するとフリー枠に「フリーを解除」(番号だけの枠に戻す)を表示する。 */
  onUnfree?: (participant: Participant) => void
  updatingId?: string | null
  /**
   * まとめて早退・まとめて復帰させるための複数選択モード。true の間は行ごとの
   * 操作ボタンを隠し、チェックボックスを出す(誤操作を避けるため、選択と個別操作は
   * 同時に出さない)。
   *
   * 早退にする/復帰にするは逆の操作なので、在席と早退中を混ぜて選ぶと
   * どちらの操作か決まらない。そこで、最初にチェックした1件の在席状態を見て、
   * それ以外の状態の行は選べなくする(グレーアウト)。1件も選んでいなければ
   * どちらの状態も選べる。
   */
  selecting?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleSelect?: (participant: Participant) => void
}) {
  if (participants.length === 0) {
    return <p className="py-4 text-sm text-slate-500">まだ参加者がいません。</p>
  }

  // 選択中の在席状態(在席/早退中)。1件も選んでいなければ null(どちらも選べる)。
  const lockedStatus = selecting
    ? (participants.find((p) => selectedIds?.has(p.id))?.status ?? null)
    : null

  return (
    <ul className="divide-y divide-slate-100">
      {participants.map((p, i) => {
        const left = p.status === 'LEFT'
        const locked = lockedStatus !== null && lockedStatus !== p.status
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <span
              className={
                'flex min-w-0 flex-1 items-center gap-2 text-sm ' +
                (left ? 'text-slate-400' : 'text-slate-800')
              }
            >
              {selecting ? (
                <input
                  type="checkbox"
                  checked={selectedIds?.has(p.id) ?? false}
                  disabled={locked}
                  onChange={() => onToggleSelect?.(p)}
                  aria-label={`${i + 1}番を選択`}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-30"
                />
              ) : null}
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums"
                aria-hidden
              >
                {i + 1}
              </span>
              {/* 受付モードなど名前が付いていれば名前を表示。番号運用(名前=番号)なら「ゲスト」。 */}
              <span className={'truncate ' + (left ? 'line-through' : '')}>
                {p.guestName && !/^\d+$/.test(p.guestName.trim()) ? p.guestName : 'ゲスト'}
              </span>
              {left ? <Badge tone="slate">早退</Badge> : null}
            </span>

            {/* 選択モード中は個別の操作ボタンを隠す(選択に集中させる。誤タップも防ぐ)。 */}
            {selecting ? null : (
              <span className="flex shrink-0 items-center gap-2">
                {onReactivate && left ? (
                  <button
                    type="button"
                    onClick={() => onReactivate(p)}
                    disabled={updatingId === p.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    復帰
                  </button>
                ) : null}
                {/* フリーにする: 番号とユーザーの紐付けを解き、誰でも入れる枠として残す。 */}
                {onMakeFree && canMakeFree(p) ? (
                  <button
                    type="button"
                    onClick={() => onMakeFree(p)}
                    disabled={updatingId === p.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-40"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    フリー
                  </button>
                ) : null}
                {/* フリーを解除: 番号だけの枠に戻す(フリーにするの逆)。こちらも在席のまま
                    試合表の枠は変わらないので、再編成は不要。 */}
                {onUnfree && isFreeSlot(p) ? (
                  <button
                    type="button"
                    onClick={() => onUnfree(p)}
                    disabled={updatingId === p.id}
                    aria-label={`${i + 1}番のフリーを解除`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    解除
                  </button>
                ) : null}
                {onMarkLeft && !left ? (
                  <button
                    type="button"
                    onClick={() => onMarkLeft(p)}
                    disabled={updatingId === p.id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-40"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    早退
                  </button>
                ) : null}
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(p)}
                    disabled={removingId === p.id}
                    aria-label={`${i + 1}番 を削除`}
                    className="text-slate-400 transition hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
