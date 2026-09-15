import { test, expect } from '@playwright/test'
import { API_BASE, deleteRoom, quickCreateRoom } from './helpers'

// 参加者(非運営者)視点。新しいコンテキスト(localStorage 空)で開くので運営者にはならない。

// 簡易作成ルーム・1セット目が始まる前は「参加する」で自動採番される(QuickJoinBanner)。
test('参加者: 1セット目前は「参加する」導線になり、押した順に一番若い番号が割り当たる', async ({
  page,
  request,
}) => {
  const room = await quickCreateRoom(request, { participantCount: 10, courtCount: 2 })
  const roomId: string = room.id
  try {
    await page.goto(`/rooms/${roomId}/matches`)

    // 「自分の番号を入力しましょう」ではなく「参加する」が出る。
    const joinButton = page.getByRole('button', { name: '参加する' })
    await expect(joinButton).toBeVisible()
    await expect(
      page.getByRole('button', { name: /自分の番号を入力しましょう/ }),
    ).toBeHidden()

    // 参加者一覧は押す前から見える(番号だけの10人ぶん)。
    const roster = page.getByRole('button', { name: /参加者名簿/ })
    await expect(roster).toBeVisible()
    await expect(roster).toContainText('10人')

    await page.getByPlaceholder('あなたの名前（任意）').fill('たろう')
    await joinButton.click()

    // 一番若い1番が割り当たる。
    await expect(page.getByText(/あなた:\s*1番\s*・\s*たろう/)).toBeVisible()

    const after = await (await request.get(`/api/v1/rooms/${roomId}`)).json()
    expect(after.participants[0].guestName).toBe('たろう')
  } finally {
    await deleteRoom(request, roomId)
  }
})

// 1セット目が始まったあとは、従来通り番号を選ぶ導線(ClaimNumberModal)に戻る。
test('参加者: 1セット目が始まったあとは番号を選ぶ導線に戻る', async ({ page, request }) => {
  const room = await quickCreateRoom(request, { participantCount: 10, courtCount: 2 })
  const roomId: string = room.id
  try {
    await request.post(`${API_BASE}/api/v1/rooms/${roomId}/matches/sets/1/start`)

    await page.goto(`/rooms/${roomId}/matches`)

    // 「参加する」ではなく従来の「自分の番号を入力しましょう」に戻る。
    await expect(page.getByRole('button', { name: '参加する' })).toBeHidden()
    const note = page.getByRole('button', { name: /自分の番号を入力しましょう/ })
    await expect(note).toBeVisible()
    await note.click()

    const dialog = page.getByRole('dialog', { name: '自分の番号を設定' })
    const third = dialog.locator('option', { hasText: /^3番/ }).first()
    await dialog.getByRole('combobox').selectOption((await third.getAttribute('value'))!)
    await dialog.getByRole('button', { name: 'この番号にする' }).click()

    await expect(page.getByText(/あなた:\s*3番/)).toBeVisible()
    await expect(note).toBeHidden()
  } finally {
    await deleteRoom(request, roomId)
  }
})

// 名前を変更から違う番号に選び直したときの挙動。元の番号は番号の表示に戻り、
// 名簿に名前が浮いたまま残らない(revertPrevious)。
test('参加者: 名前を変更で違う番号に選び直すと、元の番号は番号表示に戻る', async ({
  page,
  request,
}) => {
  const room = await quickCreateRoom(request, { participantCount: 10, courtCount: 2 })
  const roomId: string = room.id
  try {
    await page.goto(`/rooms/${roomId}/matches`)

    // 参加する → 一番若い1番が割り当たる。
    await page.getByPlaceholder('あなたの名前（任意）').fill('たろう')
    await page.getByRole('button', { name: '参加する' }).click()
    await expect(page.getByText(/あなた:\s*1番\s*・\s*たろう/)).toBeVisible()

    // 「名前を変更」で選び直し、7番に切り替える。
    await page.getByRole('button', { name: '名前を変更' }).click()
    const dialog = page.getByRole('dialog', { name: '自分の番号を設定' })
    const seventh = dialog.locator('option', { hasText: /^7番/ }).first()
    await dialog.getByRole('combobox').selectOption((await seventh.getAttribute('value'))!)
    await dialog.getByPlaceholder('あなたの名前（任意）').fill('たろう')
    await dialog.getByRole('button', { name: 'この名前で参加' }).click()
    await expect(page.getByText(/あなた:\s*7番\s*・\s*たろう/)).toBeVisible()

    // 元の1番は名簿上「1」(番号表示)に戻り、「たろう」が浮いたまま残らない。
    await expect
      .poll(async () => {
        const r = await (await request.get(`/api/v1/rooms/${roomId}`)).json()
        return r.participants.map((p: { guestName: string }) => p.guestName)
      })
      .toEqual(['1', '2', '3', '4', '5', '6', 'たろう', '8', '9', '10'])
  } finally {
    await deleteRoom(request, roomId)
  }
})

// 参加者が自分で押す「早退する」: 番号をフリーにして端末の紐付けを解く軽量操作。
// 運営者の早退(status=LEFT・再編成)とは別物で、出場・セット構成は変わらない。
test('参加者: 早退するボタンで自分の番号がフリーになり、端末の紐付けが解ける', async ({
  page,
  request,
}) => {
  const room = await quickCreateRoom(request, { participantCount: 10, courtCount: 2 })
  const roomId: string = room.id
  try {
    await page.goto(`/rooms/${roomId}/matches`)

    // 参加する → 一番若い1番として「はなこ」を名乗る。
    await page.getByPlaceholder('あなたの名前（任意）').fill('はなこ')
    await page.getByRole('button', { name: '参加する' }).click()
    await expect(page.getByText(/あなた:\s*1番\s*・\s*はなこ/)).toBeVisible()

    // 早退する → 確認 → フリーになる。
    await page.getByRole('button', { name: '早退する' }).click()
    await page
      .getByRole('dialog', { name: '早退しますか？' })
      .getByRole('button', { name: '早退する' })
      .click()

    // 「あなた:」表示が消え、参加する導線に戻る(端末の紐付けが解けた。1セット目前なので
    // 番号入力noteではなく QuickJoinBanner のまま)。
    await expect(page.getByText(/あなた:\s*1番/)).toBeHidden()
    await expect(page.getByRole('button', { name: '参加する' })).toBeVisible()

    // 名簿上は1番がフリーになり、在席(status=ACTIVE)のまま・人数も変わらない。
    const after = await (await request.get(`/api/v1/rooms/${roomId}`)).json()
    expect(after.participants).toHaveLength(10)
    const one = after.participants[0]
    expect(one.guestName).toBe('フリー')
    expect(one.status).toBe('ACTIVE')
  } finally {
    await deleteRoom(request, roomId)
  }
})

// QuickJoinBanner の「参加する」が失敗する(=本当に空き枠が無い)ときの保険。
// 念のため、従来の番号選択(自分の番号を入力しましょう)も併せて出す。
test('参加者: 参加するが失敗したら、念のため番号を選ぶ導線も出す', async ({ page, request }) => {
  const room = await quickCreateRoom(request, { participantCount: 4, courtCount: 1 })
  const roomId: string = room.id
  try {
    // 4人全員に実名を付け、空き枠を無くす(フリーでも遅刻者ビジターでもない状態)。
    for (const p of room.participants) {
      await request.post(`${API_BASE}/api/v1/rooms/${roomId}/participants/${p.id}/rename`, {
        data: { name: `person-${p.id.slice(0, 4)}` },
      })
    }

    await page.goto(`/rooms/${roomId}/matches`)

    // QuickJoinBanner は出るが、押しても空きが無いのでエラーになる。
    const joinButton = page.getByRole('button', { name: '参加する' })
    await expect(joinButton).toBeVisible()
    await joinButton.click()
    await expect(page.getByRole('alert')).toBeVisible()

    // 念のため、従来の番号選択の導線も出る(空きが無くても既存の番号を選び直せる)。
    const note = page.getByRole('button', { name: /自分の番号を入力しましょう/ })
    await expect(note).toBeVisible()
    await note.click()
    const dialog = page.getByRole('dialog', { name: '自分の番号を設定' })
    const first = dialog.locator('option').nth(1)
    await dialog.getByRole('combobox').selectOption((await first.getAttribute('value'))!)
    await dialog.getByRole('button', { name: 'この番号にする' }).click()
    await expect(page.getByText(/あなた:\s*1番/)).toBeVisible()
  } finally {
    await deleteRoom(request, roomId)
  }
})
