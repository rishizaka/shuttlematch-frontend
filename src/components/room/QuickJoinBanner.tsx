import { useRef, useState } from 'react'
import { burst } from '../../lib/motion'
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
 * <p>
 * 名前は必須。以前は空欄でも「ゲスト」として参加できたが、そうすると「番号のまま
 * (誰も参加していない)」枠と実際に空欄で参加した人(guestName="ゲスト")が運営者
 * から見分けづらくなる混乱が起きたため、必須にしてある(server 側も同様に必須)。
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
  // 送信ボタンを押す前は出さない(初期表示から赤い注意書きが見えると威圧的なため)。
  const [touched, setTouched] = useState(false)

  const trimmed = name.trim()
  const joinRef = useRef<HTMLButtonElement>(null)
  const submit = () => {
    if (pending) return
    if (!trimmed) {
      setTouched(true)
      return
    }
    burst(joinRef.current)
    onSubmit(trimmed)
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
          required
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="あなたの名前"
          aria-invalid={touched && !trimmed}
          className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        />
        <Button ref={joinRef} type="button" onClick={submit} disabled={pending}>
          {pending ? '参加中…' : '参加する'}
        </Button>
      </div>
      {touched && !trimmed ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">名前を入力してください。</p>
      ) : null}
      {error ? (
        <div className="mt-2">
          <ErrorBlock message={error} />
        </div>
      ) : null}
    </div>
  )
}
