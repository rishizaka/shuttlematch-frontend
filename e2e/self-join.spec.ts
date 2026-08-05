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
    // 主催者のニックネームを入力(受付モードは必須)。コート数=2 のまま「受付を開始」。
    await page.getByLabel('あなたのニックネーム').fill('しゅさい')
    await page.getByRole('button', { name: /受付を開始|作成中/ }).click()
    await page.waitForURL(/\/rooms\/[0-9a-f-]+\/matches/)
    roomId = new URL(page.url()).pathname.split('/')[2]

    // ロビー(受付中)が表示され、主催者が1番として参加済みになっている。
    await expect(page.getByText('受付中')).toBeVisible()
    await expect(page.getByText(/あなたは参加済みです/)).toBeVisible()
    await expect(page.getByText(/参加者 \(1\)/)).toBeVisible()

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

    // 運営者画面の名簿が9人(主催者1 + たろう + 7)になり、名前が並ぶ(ライブ更新)。
    await expect(page.getByText(/参加者 \(9\)/)).toBeVisible({ timeout: 10_000 })
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

    // 番号タップでニックネームがツールチップ表示される。
    await mePage.getByRole('button', { name: /たろう/ }).first().click()
    await expect(mePage.getByRole('tooltip')).toHaveText('たろう')
    await meCtx.close()

    // 遅刻者: 生成後の試合表から新しく番号を増やす導線は無い。運営者が用意した
    // 空き番号を指定して入る(案内は番号運用のルームと同じ1枚のnote)。
    await request.post(`${API_BASE}/api/v1/rooms/${roomId}/participants`, {
      data: { guestName: '99' },
    })
    const claimCtx = await browser.newContext()
    const claimPage = await claimCtx.newPage()
    await claimPage.goto(`/rooms/${roomId}/matches`)
    await expect(claimPage.getByText('第1セット')).toBeVisible({ timeout: 10_000 })
    await expect(claimPage.getByRole('button', { name: /新しく参加/ })).toBeHidden()
    await claimPage.getByRole('button', { name: /自分の番号を入力しましょう/ }).click()
    const claimDialog = claimPage.getByRole('dialog', { name: '自分の番号を設定' })
    // 候補には実名入りの番号も並ぶので、「空き」の枠を選ぶ。
    const openOption = claimDialog.locator('option', { hasText: '空き' }).first()
    await claimDialog
      .getByRole('combobox')
      .selectOption((await openOption.getAttribute('value'))!)
    await claimDialog.getByPlaceholder('あなたの名前').fill('あとから')
    await claimDialog.getByRole('button', { name: 'この名前で参加' }).click()
    await expect(claimPage.getByText(/あなた:\s*\d+番/)).toBeVisible({ timeout: 10_000 })

    // 参加者(非運営者)には参加者名簿(番号→名前)が見える。運営者側は名簿を出さない。
    const roster = claimPage.getByRole('button', { name: /参加者名簿/ })
    await expect(roster).toBeVisible()
    await roster.click()
    await expect(claimPage.getByText('たろう')).toBeVisible()
    await expect(page.getByRole('button', { name: /参加者名簿/ })).toBeHidden()
    await claimCtx.close()

    // 実名入りの番号も指定できる(名簿は変えず端末の紐付けのみ・重複可)。
    // 間違えて設定しても選び直すだけで直せるように、番号の指定は排他にしない。
    const dupCtx = await browser.newContext()
    const dupPage = await dupCtx.newPage()
    await dupPage.goto(`/rooms/${roomId}/matches`)
    await expect(dupPage.getByText('第1セット')).toBeVisible({ timeout: 10_000 })
    await dupPage.getByRole('button', { name: /自分の番号を入力しましょう/ }).click()
    const dupDialog = dupPage.getByRole('dialog', { name: '自分の番号を設定' })
    const namedOption = dupDialog.locator('option', { hasText: 'あとから' }).first()
    await dupDialog
      .getByRole('combobox')
      .selectOption((await namedOption.getAttribute('value'))!)
    // 実名枠では名前入力は出ず、名簿を変えない旨の説明が出る。
    await expect(dupDialog.getByText(/名簿はそのまま/)).toBeVisible()
    await dupDialog.getByRole('button', { name: 'この番号にする' }).click()
    await expect(dupPage.getByText(/あなた:\s*\d+番/)).toBeVisible({ timeout: 10_000 })
    // 名簿の名前は上書きされていない(「あとから」のまま)。
    // ヘッダーの「あなた: N番 ・ あとから」にも含まれるので、名簿の行だけを完全一致で見る。
    const dupRoster = dupPage.getByRole('button', { name: /参加者名簿/ })
    await dupRoster.click()
    await expect(dupPage.getByText('あとから', { exact: true })).toBeVisible()
    await dupCtx.close()

    // 生成後、APIで最低限(試合が生成されている)を確認。
    const sched = await (await request.get(`${API_BASE}/api/v1/rooms/${roomId}/matches`)).json()
    expect(sched.matches.length).toBeGreaterThan(0)
  } finally {
    if (roomId) await deleteRoom(request, roomId)
  }
})
