import { createFileRoute, useRouter } from '@tanstack/react-router'
import { burst } from '../../lib/motion'
import { useRef, useState } from 'react'
import { useQuickCreateRoom } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { userApi } from '../../lib/api'
import { defaultRoomTitle } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'

/** TOP の見積もりから引き継ぐ初期値。どちらも任意。 */
function parseCount(value: unknown): number | undefined {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : undefined
}

export const Route = createFileRoute('/organizer/rooms/new')({
  // 作成フォームは検索の着地点ではない。検索結果には、使い方まで説明しているTOPや
  // ガイドを出し、ここはそこから遷移した人だけが使えるようにする。
  head: () => ({ meta: [{ name: 'robots', content: 'noindex,follow' }] }),
  // TOP の「この条件で乱数表をつくる」から人数・コート数を引き継ぐ。
  // 読み取れない値は無視して従来の初期値にする(URL を直接編集されても壊れない)。
  // 戻り値の型は**省略可能なプロパティ**として明示する。これを省くと
  // `participantCount: number | undefined` という「値はundefinedでよいがキーは必須」の
  // 型になり、このルートへ張っている既存の <Link> すべてに search の指定を強制してしまう。
  validateSearch: (
    search: Record<string, unknown>,
  ): { participantCount?: number; courtCount?: number } => ({
    participantCount: parseCount(search.participantCount),
    courtCount: parseCount(search.courtCount),
  }),
  component: NewRoomPage,
})

/**
 * 乱数表の作成フォーム。人数とコート数を入れて、番号の参加者と試合表をその場で作る。
 *
 * 以前はもう一つ「参加リンクで受付」(コート数だけで受付を開始し、各自が名前で参加して
 * 番号が自動で決まる)という作り方があったが、2026-10-17 に取りやめた。作り方が2つあること
 * 自体が最初の分岐として重く、ほとんどが人数を入れて作る使い方だったため。
 */
function NewRoomPage() {
  const router = useRouter()
  const { user, login } = useCurrentUser()
  const quickCreate = useQuickCreateRoom()

  // TOP の見積もりで入れた人数・コート数があれば、それを初期値にする。
  const prefill = Route.useSearch()

  const [title, setTitle] = useState(defaultRoomTitle())
  const [participantCount, setParticipantCount] = useState(
    prefill.participantCount ? String(prefill.participantCount) : '',
  )
  const [courtCount, setCourtCount] = useState(
    prefill.courtCount ? String(prefill.courtCount) : '2',
  )
  const [attempted, setAttempted] = useState(false)
  const [issuingGuest, setIssuingGuest] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const courts = Number(courtCount)
  const people = Number(participantCount)
  const required = (courts || 1) * 4

  const titleError = !title.trim() ? 'タイトルを入力してください' : null
  const courtError = !courtCount || courts < 1 ? 'コート数を入力してください' : null
  const peopleError = !participantCount
    ? '参加人数を入力してください'
    : people < required
      ? `コート ${courts || 1} 面には最低 ${required} 人必要です`
      : null

  const pending = quickCreate.isPending || issuingGuest
  const createError = quickCreate.isError ? (quickCreate.error as Error).message : null

  const submitRef = useRef<HTMLButtonElement>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (titleError || courtError || peopleError) return

    // 未ログインならゲストユーザーを発行し、この端末のユーザーとして保存する。
    let creatorId = user?.id
    if (!creatorId) {
      setGuestError(null)
      setIssuingGuest(true)
      try {
        const guest = await userApi.createGuest()
        login(guest)
        creatorId = guest.id
      } catch (err) {
        setGuestError(err instanceof Error ? err.message : 'ゲストユーザーの発行に失敗しました')
        return
      } finally {
        setIssuingGuest(false)
      }
    }

    quickCreate.mutate(
      {
        title: title.trim(),
        courtCount: courts,
        participantCount: people,
        createdBy: creatorId,
      },
      {
        onSuccess: (room) => {
          burst(submitRef.current, 28)
          void router.navigate({
            to: '/rooms/$roomId/matches',
            params: { roomId: room.id },
            search: { openExternalBrowser: 1 },
          })
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader
          title="乱数表をつくる"
          description="人数とコート数を入れると、番号の参加者と試合表をその場で作ります。"
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="参加人数" htmlFor="participantCount">
              <Input
                id="participantCount"
                type="number"
                min={required}
                value={participantCount}
                onChange={(e) => setParticipantCount(e.target.value)}
                placeholder="例: 8"
              />
              {attempted && peopleError ? (
                <p className="mt-1 text-sm text-red-600">{peopleError}</p>
              ) : null}
            </Field>

            <Field label="コート数" htmlFor="courtCount">
              <Input
                id="courtCount"
                type="number"
                min={1}
                value={courtCount}
                onChange={(e) => setCourtCount(e.target.value)}
                placeholder="例: 2"
              />
              {attempted && courtError ? (
                <p className="mt-1 text-sm text-red-600">{courtError}</p>
              ) : null}
            </Field>

            <Field label="タイトル" htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="7/2 夜練"
              />
              {attempted && titleError ? (
                <p className="mt-1 text-sm text-red-600">{titleError}</p>
              ) : null}
            </Field>

            {guestError ? <p className="text-sm text-red-600">{guestError}</p> : null}
            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
            <Button ref={submitRef} type="submit" className="w-full" disabled={pending}>
              {pending ? '作成中…' : '乱数表をつくる'}
            </Button>
            {!user ? (
              <p className="text-center text-xs text-slate-400">
                ログインなしで作成できます。この端末がランダム表の運営者になります。
              </p>
            ) : null}
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
