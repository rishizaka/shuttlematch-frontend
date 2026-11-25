import { expect, test, type Page } from '@playwright/test'
import { expectAxeWithinKnown, expectNoConsoleErrors, expectNoHorizontalOverflow, prepare } from './helpers'

/**
 * ミニゲーム(/game のハブと各ゲームのタイトル画面・スマホ幅)の UI 回帰。API は読み込み時には呼ばない
 * (ランキングはゲームオーバー後)ので、モックのデータは使わない。
 * canvas はタイトル画面でも動き続けるので、スクショでは塗りつぶして(mask)枠と周りの本文だけを比べる。
 */
const SCREENS = [
  { path: '/game', key: 'gameHub' },
  { path: '/game/flap', key: 'gameFlap' },
  { path: '/game/rain', key: 'gameRain' },
  { path: '/game/coin', key: 'gameCoin' },
  { path: '/game/flick', key: 'gameFlick' },
  { path: '/game/ski', key: 'gameSki' },
] as const

async function openGame(page: Page, path: string) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('h1')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return errors
}

test.beforeEach(async ({ page }) => {
  await prepare(page)
})

for (const { path, key } of SCREENS) {
  test.describe(path, () => {
    test('コンソールエラーが出ない(hydration mismatch を含む)', async ({ page }) => {
      await expectNoConsoleErrors(page, await openGame(page, path))
    })

    test('スマホ幅で横スクロールが出ない', async ({ page }) => {
      await openGame(page, path)
      await expectNoHorizontalOverflow(page)
    })

    test('アクセシビリティ違反が既知のものから増えていない', async ({ page }) => {
      await openGame(page, path)
      await expectAxeWithinKnown(page, key)
    })

    test('見た目が基準画像と一致する', async ({ page }) => {
      await openGame(page, path)
      await expect(page).toHaveScreenshot(`${key}.png`, { fullPage: true, mask: [page.locator('canvas')] })
    })
  })
}
