import { test, expect } from '@playwright/test'
import { API_BASE, deleteRoom } from './helpers'

// 運営者視点の主要UI: 試合表表示 → 運営メニュー → ルーム削除 → ホームへ。
// SSR 作成フォームはハイドレーション待ちが不安定なため、ルームは API で用意し、
// 作成者(createdBy)を localStorage に注入してこのブラウザを運営者として扱う。
test('運営者: 試合表表示 → 運営メニュー → 削除 → ホームへ', async ({ page, request }) => {
  // ゲスト発行 → そのゲストを作成者にしてルーム作成(番号参加者+試合表つき)。
  const uid: string = await (
    await request.post(`${API_BASE}/api/v1/users/guest`, { data: { name: 'e2e-organizer' } })
  ).json().then((u) => u.id)
  const room = await (
    await request.post(`${API_BASE}/api/v1/rooms/quick`, {
      data: { title: `E2E QA ${Date.now()}`, courtCount: 2, participantCount: 10, createdBy: uid },
    })
  ).json()
  let roomId: string | null = room.id

  // このブラウザを運営者にする(user.id === room.createdBy)。
  await page.addInitScript((user) => {
    localStorage.setItem('shuttlematch.currentUser', JSON.stringify(user))
  }, { id: uid, name: 'e2e-organizer', email: null })

  try {
    await page.goto(`/rooms/${roomId}/matches`)

    // 試合表が描画される(第1セット・ヘッダーロゴ)。
    await expect(page.getByText('第1セット')).toBeVisible()
    await expect(page.locator('header img[alt="ShuttleMatch"]')).toBeVisible()

    // 運営者にだけ出る「運営メニュー」を開いてルーム削除。
    const menu = page.getByRole('button', { name: /運営メニュー/ })
    await expect(menu).toBeVisible()
    await menu.click()
    await page.getByRole('button', { name: '削除する' }).click() // 危険セクションのボタン
    const dialog = page.getByRole('dialog', { name: 'このルームを削除しますか？' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '削除する' }).click()

    // 削除後はホーム(/)へ戻る。
    await page.waitForURL((url) => new URL(url).pathname === '/')
    roomId = null // UI で削除済み
  } finally {
    if (roomId) await deleteRoom(request, roomId)
  }
})

// 早退(status=LEFT)と違い、こちらは参加者数そのものを減らす操作。試合開始前の
// 一番後ろの番号だけに許可される(途中の番号を消すと後続の番号が繰り上がるため)。
test('運営者: 生成後・未開始のあいだは末尾の参加者を削除できる(参加者数が減る)', async ({
  page,
  request,
}) => {
  const uid: string = await (
    await request.post(`${API_BASE}/api/v1/users/guest`, { data: { name: 'e2e-organizer2' } })
  ).json().then((u) => u.id)
  const room = await (
    await request.post(`${API_BASE}/api/v1/rooms/quick`, {
      data: { title: `E2E QA ${Date.now()}`, courtCount: 1, participantCount: 6, createdBy: uid },
    })
  ).json()
  const roomId: string = room.id

  await page.addInitScript((user) => {
    localStorage.setItem('shuttlematch.currentUser', JSON.stringify(user))
  }, { id: uid, name: 'e2e-organizer2', email: null })

  try {
    await page.goto(`/rooms/${roomId}/matches`)
    await expect(page.getByText('第1セット')).toBeVisible()

    const menu = page.getByRole('button', { name: /運営メニュー/ })
    await menu.click()

    // 削除ボタンは一番後ろ(6番)にだけ出る。途中の番号には出ない。
    await expect(page.getByLabel('6番を削除')).toBeVisible()
    await expect(page.getByLabel('3番を削除')).toBeHidden()

    // 削除 → 確認モーダル → 確定。
    await page.getByLabel('6番を削除').click()
    const dialog = page.getByRole('dialog', { name: '参加者を削除しますか？' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '削除する' }).click()
    await expect(page.getByText('参加者を削除しました')).toBeVisible()

    // 6番が消え、参加者数(参加 N)も5人に減る。早退と違って行ごと消える。
    await expect(page.getByLabel('6番を削除')).toBeHidden()
    await expect
      .poll(async () => {
        const r = await (await request.get(`${API_BASE}/api/v1/rooms/${roomId}`)).json()
        return r.participantCount
      })
      .toBe(5)

    // 第1セットを開始すると、新しい末尾(5番)の削除ボタンも消える
    // (1セットでも開始した後は末尾でも削除できない)。
    await page.getByRole('button', { name: /^第\d+セット開始/ }).first().click()
    const startDialog = page.getByRole('dialog')
    if (await startDialog.isVisible().catch(() => false)) {
      await startDialog.getByRole('button', { name: /開始|はい/ }).click()
    }
    await expect(page.getByLabel('5番を削除')).toBeHidden()
  } finally {
    await deleteRoom(request, roomId)
  }
})
