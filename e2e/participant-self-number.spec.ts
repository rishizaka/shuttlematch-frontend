import { test, expect } from '@playwright/test'
import { deleteRoom, quickCreateRoom } from './helpers'

// 参加者(非運営者)視点: 自分の番号を入力すると試合表で強調される導線。
// 新しいコンテキスト(localStorage 空)で開くので運営者にはならない。
test('参加者: 番号入力note → モーダルで設定 → あなたの番号が表示される', async ({
  page,
  request,
}) => {
  const room = await quickCreateRoom(request, { participantCount: 10, courtCount: 2 })
  const roomId: string = room.id
  try {
    await page.goto(`/rooms/${roomId}/matches`)

    // 未設定の参加者には薄黄色の note が出る
    const note = page.getByRole('button', { name: /自分の番号を入力しましょう/ })
    await expect(note).toBeVisible()
    await note.click()

    // モーダルで番号3を設定。名前は入れない = 名簿に載せず端末が覚えるだけ。
    const dialog = page.getByRole('dialog', { name: '自分の番号を設定' })
    await expect(dialog).toBeVisible()
    const third = dialog.locator('option', { hasText: /^3番/ }).first()
    await dialog.getByRole('combobox').selectOption((await third.getAttribute('value'))!)
    await dialog.getByRole('button', { name: 'この番号にする' }).click()

    // 設定後は「あなた: 3番」が表示され、note は消える
    await expect(page.getByText(/あなた:\s*3番/)).toBeVisible()
    await expect(note).toBeHidden()

    // 名前を入れていないので名簿は番号のまま(API には送っていない)。
    const after = await (await request.get(`/api/v1/rooms/${roomId}`)).json()
    expect(after.participants.map((p: { guestName: string }) => p.guestName)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    )
  } finally {
    await deleteRoom(request, roomId)
  }
})
