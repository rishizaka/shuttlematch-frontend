import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '../ui/Button'
import { ErrorBlock } from '../ui/Spinner'

/**
 * 簡易作成ルームで、1セット目が始まる前だけ出す参加導線。
 *
 * 番号を1つずつ選ばせる(ClaimNumberModal)より、名前を入れて「参加する」を押すだけの方が
 * 分かりやすい。番号は押した順(サーバー側の行ロックで原子的)に一番若い空き番号が
 * 割り当たるので、同時に何人押しても取り合いにならない。1セット目が始まったら、
 * 従来通り番号を選ぶ導線(ClaimNumberModal)に切り替わる。
 */
export function QuickJoinBanner({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean
  error?: string | null
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState('')

  const submit = () => {
    if (!pending) onSubmit(name)
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <UserPlus className="h-4 w-4 text-amber-600" />
        参加する
      </div>
      <p className="mb-2 text-xs text-amber-700">
        まだ1セット目が始まっていません。押した順に番号が割り当たります。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="あなたの名前（任意）"
          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        />
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? '参加中…' : '参加する'}
        </Button>
      </div>
      {error ? (
        <div className="mt-2">
          <ErrorBlock message={error} />
        </div>
      ) : null}
    </div>
  )
}
