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

    // 試合表が描画される(セット数・第1セット・ヘッダーロゴ)。
    await expect(page.getByText(/全\s*\d+\s*セット・\d+\s*試合/)).toBeVisible()
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
