import { test, expect, type BrowserContext } from '@playwright/test'
import { API_BASE, deleteRoom } from './helpers'

// 新モード(参加リンクで受付)のE2E:
// 運営者がコート数だけで受付ルームを作成 → 参加者が名前で参加(番号自動) → 運営者が生成 → 試合表。

// 別端末(=別コンテキスト)から名前で参加する。
async function joinAs(context: BrowserContext, baseURL: string, roomId: string, name: string) {
  const page = await context.newPage()
  await page.goto(`${baseURL}/rooms/${roomId}/matches`)
  const input = page.getByPlaceholder('あなたの名前')
  await expect(input).toBeVisible()
  await input.fill(name)
  await page.getByRole('button', { name: '参加する' }).click()
  await expect(page.getByText(/あなたは参加済みです/)).toBeVisible()
  await page.close()
}

test('受付モード: 作成 → 各自が名前で参加 → 生成 → 試合表', async ({ page, request, browser }) => {
  const baseURL = test.info().project.use.baseURL as string
  let roomId: string | null = null
  try {
    // 運営者: コート数だけで受付ルームを作成(モード切替 → 受付を開始)。
    await page.goto('/organizer/rooms/new')
    // ハイドレーション完了前だとクリックが効かないため、受付モードに切り替わるまでリトライ。
    await expect(async () => {
      await page.getByRole('button', { name: /参加リンクで受付/ }).click()
      await expect(page.getByRole('button', { name: /受付を開始/ })).toBeVisible({ timeout: 500 })
    }).toPass({ timeout: 15_000 })
    // コート数=2 のまま「受付を開始」
    await page.getByRole('button', { name: /受付を開始|作成中/ }).click()
    await page.waitForURL(/\/rooms\/[0-9a-f-]+\/matches/)
    roomId = new URL(page.url()).pathname.split('/')[2]

    // ロビー(受付中)が表示される。
    await expect(page.getByText('受付中')).toBeVisible()
    await expect(page.getByText(/参加者 \(0\)/)).toBeVisible()

    // 8人(2コート分)が別端末から名前で参加。1人(たろう)は端末を開いたままにして、
    // 生成後に「自分の番号が自動反映され、試合表へ自動で切り替わる」かを確認する。
    const meCtx = await browser.newContext()
    const mePage = await meCtx.newPage()
    await mePage.goto(`/rooms/${roomId}/matches`)
    await mePage.getByPlaceholder('あなたの名前').fill('たろう')
    await mePage.getByRole('button', { name: '参加する' }).click()
    await expect(mePage.getByText(/あなたは参加済みです/)).toBeVisible()

    const names = ['はなこ', 'じろう', 'さくら', 'けん', 'ゆい', 'そう', 'みか']
    for (const n of names) {
      const ctx = await browser.newContext()
      await joinAs(ctx, baseURL, roomId, n)
      await ctx.close()
    }

    // 運営者画面の名簿が8人になり、名前が並ぶ(ライブ更新)。
    await expect(page.getByText(/参加者 \(8\)/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('たろう')).toBeVisible()

    // 生成ボタンが有効になり、押すと試合表へ。
    const gen = page.getByRole('button', { name: /試合表を生成/ })
    await expect(gen).toBeEnabled()
    await gen.click()
    await expect(page.getByText('第1セット')).toBeVisible({ timeout: 10_000 })

    // 参加者の端末: 生成後、自動で試合表に切り替わり、自分の番号が自動反映される
    // (「自分の番号を入力しましょう」noteは出ない)。
    await expect(mePage.getByText('第1セット')).toBeVisible({ timeout: 15_000 })
    await expect(mePage.getByText(/あなた:\s*\d+番/)).toBeVisible({ timeout: 10_000 })
    await expect(
      mePage.getByRole('button', { name: /自分の番号を入力しましょう/ }),
    ).toBeHidden()
    await meCtx.close()

    // 生成後も参加者名簿(番号→名前)が全員に見える(アコーディオンを開くと名前が並ぶ)。
    const roster = page.getByRole('button', { name: /参加者名簿/ })
    await expect(roster).toBeVisible()
    await roster.click()
    await expect(page.getByText('たろう')).toBeVisible()

    // 生成後、APIで最低限(試合が生成されている)を確認。
    const sched = await (await request.get(`${API_BASE}/api/v1/rooms/${roomId}/matches`)).json()
    expect(sched.matches.length).toBeGreaterThan(0)
  } finally {
    if (roomId) await deleteRoom(request, roomId)
  }
})
