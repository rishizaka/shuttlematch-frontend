import { expect, test } from '@playwright/test'
import {
  expectAxeWithinKnown,
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  openMatches,
  prepare,
} from './helpers'

/**
 * 試合表(参加者視点・スマホ幅)の UI 回帰。
 * 「良くしたら、テストで固定する」ための土台。直した UX が後の変更で戻らないようにする。
 *
 * - データはモック API の固定値(10人2コート、1セット目開始済み、この端末は番号未選択)。
 * - アクセシビリティ違反は「今ある違反(axe-known-violations.json)」を許容し、増えたら落とす。
 *   直して消えたらリストからも消す(消し忘れもテストが落として知らせる)。こうしてリストを減らしていく。
 */
test.beforeEach(async ({ page }) => {
  await prepare(page)
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
  await expectAxeWithinKnown(page, 'matchesParticipant')
})

test('見た目が基準画像と一致する', async ({ page }) => {
  await openMatches(page)
  await expect(page).toHaveScreenshot('matches-participant.png', { fullPage: true })
})
