import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useCreateRoom, useQuickCreateRoom } from '../../hooks/queries'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { roomApi, userApi } from '../../lib/api'
import { setSelfParticipant } from '../../lib/local-store'
import { defaultRoomTitle } from '../../lib/format'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'

export const Route = createFileRoute('/organizer/rooms/new')({
  // 作成フォームは検索の着地点ではない。検索結果には、使い方まで説明しているTOPや
  // ガイドを出し、ここはそこから遷移した人だけが使えるようにする。
  head: () => ({ meta: [{ name: 'robots', content: 'noindex,follow' }] }),
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
  // 受付モードで主催者が自分を1番として参加させるためのニックネーム。
  const [organizerName, setOrganizerName] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [issuingGuest, setIssuingGuest] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const courts = Number(courtCount)
  const people = Number(participantCount)
  const required = (courts || 1) * 4

  const titleError = !title.trim() ? 'タイトルを入力してください' : null
  const courtError = !courtCount || courts < 1 ? 'コート数を入力してください' : null
  const peopleError =
    mode !== 'quick'
      ? null
      : !participantCount
        ? '参加人数を入力してください'
        : people < required
          ? `コート ${courts || 1} 面には最低 ${required} 人必要です`
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
          participantCount: people,
          createdBy: creatorId,
        },
        { onSuccess: (room) => goMatches(room.id) },
      )
    } else {
      // 受付モード: コート数だけで OPEN ルームを作成 → 主催者を1番として参加させ、
      // 受付ロビー(試合表ページの未生成状態)へ。
      createRoom.mutate(
        {
          title: defaultRoomTitle(),
          heldAt: new Date().toISOString(),
          courtCount: courts,
          createdBy: creatorId,
        },
        {
          onSuccess: async (room) => {
            // 主催者を最初の参加者(1番)として登録し、この端末の自分として保存する。
            // 参加に失敗しても受付自体は始められるので、ロビーへは必ず進む。
            try {
              // ニックネームは任意。未入力なら「ゲスト」で1番参加。
              const res = await roomApi.join(room.id, organizerName.trim() || 'ゲスト')
              setSelfParticipant(room.id, res.participantId)
            } catch {
              /* 主催者の自動参加に失敗してもロビーで手動参加できる */
            }
            goMatches(room.id)
          },
        },
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
        <CardHeader title="ランダム表をつくる" description="作り方を選べます。" />
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
                  min={required}
                  value={participantCount}
                  onChange={(e) => setParticipantCount(e.target.value)}
                  placeholder="例: 8"
                />
                {attempted && peopleError ? (
                  <p className="mt-1 text-sm text-red-600">{peopleError}</p>
                ) : null}
              </Field>
            ) : null}

            {mode === 'reception' ? (
              <Field label="あなたのニックネーム（任意）" htmlFor="organizerName">
                <Input
                  id="organizerName"
                  value={organizerName}
                  maxLength={30}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  placeholder="例: たろう"
                />
                <p className="mt-1 text-xs text-slate-500">
                  受付を開始すると、あなたも参加します。未入力なら「ゲスト」になります。
                </p>
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
                割り振られます。人数が集まったら「ランダム表をつくる」を押します。
              </p>
            )}

            {guestError ? <p className="text-sm text-red-600">{guestError}</p> : null}
            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? '作成中…' : mode === 'quick' ? 'ランダム表をつくる' : '受付を開始'}
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
