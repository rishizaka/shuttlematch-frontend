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

test('アクセシビリティ違反が既知のものから増えていない', async ({ page }) => {
  await openMatches(page)
  await expectAxeWithinKnown(page, 'matchesOrganizer')
})

test('見た目が基準画像と一致する', async ({ page }) => {
  await openMatches(page)
  await expect(page).toHaveScreenshot('matches-organizer.png', { fullPage: true })
})
