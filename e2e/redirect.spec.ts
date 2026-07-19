import { test, expect } from '@playwright/test'
import { deleteRoom, quickCreateRoom } from './helpers'

// 旧ルーム詳細 URL は試合表へリダイレクトされる(廃止済みの互換動作)。
test('リダイレクト: /rooms/{id} → /rooms/{id}/matches', async ({ page, request }) => {
  const room = await quickCreateRoom(request, { participantCount: 8, courtCount: 2 })
  const roomId: string = room.id
  try {
    await page.goto(`/rooms/${roomId}`)
    await page.waitForURL(new RegExp(`/rooms/${roomId}/matches`))
    await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/matches`))
    await expect(page.getByText('第1セット')).toBeVisible()
  } finally {
    await deleteRoom(request, roomId)
  }
})
