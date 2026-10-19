import { test, expect } from '@playwright/test'
import { API_BASE, deleteRoom, quickCreateRoom } from './helpers'

// 運営者用リンク(#organizer=トークン)で、作成した端末以外にも運営権を渡せること。
// ルームは API で用意し、ブラウザ側には何も注入しない(=トークンを持たない別端末)。

test('運営者用リンクを開いた別ブラウザが運営者になり、トークンはアドレスバーから消える', async ({
  page,
  request,
}) => {
  const room = await quickCreateRoom(request, { participantCount: 8, courtCount: 2 })
  try {
    // 何も持たない状態では運営メニューは出ない
    await page.goto(`/rooms/${room.id}/matches`)
    await expect(page.getByRole('button', { name: '第1セット開始' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /運営メニュー/ })).toHaveCount(0)

    // 運営者用リンクで開き直す
    await page.goto(`/rooms/${room.id}/matches#organizer=${encodeURIComponent(room.organizerToken)}`)
    await expect(page.getByText('この端末でも運営できるようになりました')).toBeVisible()
    await expect.poll(() => new URL(page.url()).hash).toBe('')
    expect(
      await page.evaluate((id) => localStorage.getItem(`shuttlematch.organizer.${id}`), room.id),
    ).toBe(room.organizerToken)

    // 運営操作ができる(セット開始が通る)
    await page.getByRole('button', { name: '第1セット開始' }).click()
    await expect
      .poll(async () => {
        const s = await (await request.get(`${API_BASE}/api/v1/rooms/${room.id}/matches`)).json()
        return s.matches.some((m: { startedAt: string | null }) => m.startedAt)
      })
      .toBe(true)

    // 運営メニューに「運営者用リンク」が出る(受け取った端末からもさらに渡せる)
    await page.getByRole('button', { name: /運営メニュー/ }).click()
    await expect(page.getByRole('heading', { name: '運営者用リンク' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'リンクをコピー' })).toBeVisible()
  } finally {
    await deleteRoom(request, room.id)
  }
})

test('偽の運営者用リンクでは運営者にならない', async ({ page, request }) => {
  const room = await quickCreateRoom(request, { participantCount: 8, courtCount: 2 })
  try {
    await page.goto(`/rooms/${room.id}/matches#organizer=not-a-real-token`)
    await expect(page.getByText('運営者用リンクが正しくないため、運営はできません')).toBeVisible()
    await expect.poll(() => new URL(page.url()).hash).toBe('')
    await expect(page.getByRole('button', { name: /運営メニュー/ })).toHaveCount(0)
    expect(
      await page.evaluate((id) => localStorage.getItem(`shuttlematch.organizer.${id}`), room.id),
    ).toBeNull()
  } finally {
    await deleteRoom(request, room.id)
  }
})

test('トークンを持たない作成者(導入前のランダム表)には運営者用リンクを出さない', async ({
  page,
  request,
}) => {
  const room = await quickCreateRoom(request, { participantCount: 8, courtCount: 2 })
  try {
    // 作成者ユーザーだけ注入し、トークンは入れない
    await page.addInitScript(
      (createdBy) =>
        localStorage.setItem(
          'shuttlematch.currentUser',
          JSON.stringify({ id: createdBy, name: 'e2e', email: null }),
        ),
      room.createdBy,
    )
    await page.goto(`/rooms/${room.id}/matches`)
    await page.getByRole('button', { name: /運営メニュー/ }).click()
    await expect(page.getByRole('heading', { name: 'スクショ用ページ' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '運営者用リンク' })).toHaveCount(0)
  } finally {
    await deleteRoom(request, room.id)
  }
})
