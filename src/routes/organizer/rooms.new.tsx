import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useCreateRoom, useQuickCreateRoom } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { userApi } from '../../lib/api'
import { defaultRoomTitle } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'

export const Route = createFileRoute('/organizer/rooms/new')({
  component: NewRoomPage,
})

// quick: 人数を入れて即・番号参加者+試合表を作る(従来)。
// reception: コート数だけで受付を開始し、各自が名前で参加→番号自動。
type Mode = 'quick' | 'reception'

function NewRoomPage() {
  const router = useRouter()
  const { user, login } = useCurrentUser()
  const quickCreate = useQuickCreateRoom()
  const createRoom = useCreateRoom()

  const [mode, setMode] = useState<Mode>('quick')
  const [title, setTitle] = useState(defaultRoomTitle())
  const [participantCount, setParticipantCount] = useState('')
  const [courtCount, setCourtCount] = useState('2')
  const [attempted, setAttempted] = useState(false)
  const [issuingGuest, setIssuingGuest] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const courts = Number(courtCount)
  const people = Number(participantCount)
  const required = (courts || 1) * 4
  // 入力人数が required に満たない分はゲスト(番号だけの空き枠)で埋めて始める。
  const guestFill = mode === 'quick' && people >= 1 ? Math.max(0, required - people) : 0

  const titleError = !title.trim() ? 'タイトルを入力してください' : null
  const courtError = !courtCount || courts < 1 ? 'コート数を入力してください' : null
  const peopleError =
    mode !== 'quick'
      ? null
      : !participantCount
        ? '参加人数を入力してください'
        : people < 1
          ? '参加人数は1人以上にしてください'
          : null

  const pending = quickCreate.isPending || createRoom.isPending || issuingGuest
  const createError = quickCreate.isError
    ? (quickCreate.error as Error).message
    : createRoom.isError
      ? (createRoom.error as Error).message
      : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (mode === 'quick' ? titleError || courtError || peopleError : courtError) return

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

    const goMatches = (roomId: string) =>
      void router.navigate({
        to: '/rooms/$roomId/matches',
        params: { roomId },
        search: { openExternalBrowser: 1 },
      })

    if (mode === 'quick') {
      quickCreate.mutate(
        {
          title: title.trim(),
          courtCount: courts,
          // 足りない分はゲスト枠で埋める(コート数 × 4 が試合表の最低人数)。
          participantCount: Math.max(people, required),
          createdBy: creatorId,
        },
        { onSuccess: (room) => goMatches(room.id) },
      )
    } else {
      // 受付モード: コート数だけで OPEN ルームを作成 → 受付ロビー(試合表ページの未生成状態)へ。
      createRoom.mutate(
        {
          title: defaultRoomTitle(),
          heldAt: new Date().toISOString(),
          courtCount: courts,
          createdBy: creatorId,
        },
        { onSuccess: (room) => goMatches(room.id) },
      )
    }
  }

  const modeButton = (m: Mode, title: string, desc: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={
        'rounded-xl border px-3 py-3 text-left text-sm transition ' +
        (mode === m
          ? 'border-brand-500 bg-brand-50 text-brand-900'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')
      }
    >
      <span className="block font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs opacity-80">{desc}</span>
    </button>
  )

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader title="ルームを作成" description="作り方を選べます。" />
        <CardBody>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {modeButton('quick', '人数を入れて作成', '番号で試合表をすぐ作る')}
            {modeButton('reception', '参加リンクで受付', '各自が名前で参加→番号自動')}
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'quick' ? (
              <Field label="参加人数" htmlFor="participantCount">
                <Input
                  id="participantCount"
                  type="number"
                  min={1}
                  value={participantCount}
                  onChange={(e) => setParticipantCount(e.target.value)}
                  placeholder="8"
                />
                {attempted && peopleError ? (
                  <p className="mt-1 text-sm text-red-600">{peopleError}</p>
                ) : guestFill > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    コート {courts || 1} 面は {required} 人で回します。足りない {guestFill}{' '}
                    人分はゲスト（空き番号）として用意し、後から参加できます。
                  </p>
                ) : null}
              </Field>
            ) : null}

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

            {mode === 'quick' ? (
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
            ) : (
              <p className="text-xs text-slate-500">
                受付モードでは、作成後に共有リンクを渡すと、各自が名前で参加して番号が自動で
                割り振られます。人数が集まったら「試合表を生成」を押します。
              </p>
            )}

            {guestError ? <p className="text-sm text-red-600">{guestError}</p> : null}
            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? '作成中…' : mode === 'quick' ? '試合表を作成' : '受付を開始'}
            </Button>
            {!user ? (
              <p className="text-center text-xs text-slate-400">
                ログインなしで作成できます。この端末がルームの運営者になります。
              </p>
            ) : null}
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
