import { expect, test } from '@playwright/test'
import {
  actAsOrganizer,
  expectAxeWithinKnown,
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  openMatches,
  prepare,
} from './helpers'

/**
 * 試合表(運営者視点・スマホ幅)の UI 回帰。データは参加者視点と同じ
 * (10人2コート、1セット目開始済み)で、この端末が運営者トークンを持っている。
 * 運営メニュー・「第2セット開始」・「戻す」など運営者にだけ出る部品を含めて固定する。
 */
test.beforeEach(async ({ page }) => {
  await prepare(page)
  await actAsOrganizer(page)
})

test('運営者用の操作が出ている(このテストが参加者視点を撮っていない)', async ({ page }) => {
  await openMatches(page)
  await expect(page.getByRole('button', { name: '第2セット開始' })).toBeVisible()
})

test('コンソールエラーが出ない(hydration mismatch を含む)', async ({ page }) => {
  await expectNoConsoleErrors(page, await openMatches(page))
})

test('スマホ幅で横スクロールが出ない', async ({ page }) => {
  await openMatches(page)
  await expectNoHorizontalOverflow(page)
})

test('運営者の端末では、参加者の端末で開いた記録を送らない', async ({ page }) => {
  const sent: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/participant-opens')) sent.push(r.method())
  })
  await openMatches(page)
  await page.waitForTimeout(1500)
  expect(sent).toEqual([])
})

test('アクセシビリティ違反が既知のものから増えていない', async ({ page }) => {
  await openMatches(page)
  await expectAxeWithinKnown(page, 'matchesOrganizer')
})

test('見た目が基準画像と一致する', async ({ page }) => {
  await openMatches(page)
  await expect(page).toHaveScreenshot('matches-organizer.png', { fullPage: true })
})

/** 運営メニューを開いた状態。参加者の出入り・セット追加・運営者用リンクなど、畳まれていると見えない部品を固定する。 */
test.describe('運営メニューを開いた状態', () => {
  test.beforeEach(async ({ page }) => {
    await openMatches(page)
    const toggle = page.getByRole('button', { name: /運営メニュー/ })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // 開くアニメーション(半透明から不透明へ)が終わるまで待つ。途中で axe を回すと、
    // 半透明の文字を「コントラスト不足」と数えてしまう(以前はこれで 26 件の誤検出になっていた)
    await page
      .locator('.animate-accordion-in')
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
  })

  test('スマホ幅で横スクロールが出ない', async ({ page }) => {
    await expectNoHorizontalOverflow(page)
  })

  test('アクセシビリティ違反が既知のものから増えていない', async ({ page }) => {
    await expectAxeWithinKnown(page, 'matchesOrganizerMenu')
  })

  test('見た目が基準画像と一致する', async ({ page }) => {
    await expect(page).toHaveScreenshot('matches-organizer-menu.png', { fullPage: true })
  })
})
