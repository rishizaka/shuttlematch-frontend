import { expect, test, type Page } from '@playwright/test'
import {
  ROOM_ID,
  ROOM_TITLE,
  SHARE_CODE,
  expectAxeWithinKnown,
  expectNoConsoleErrors,
  expectNoHorizontalOverflow,
  prepare,
} from './helpers'

/**
 * 短縮共有URL(/r/{共有コード}、スマホ幅)の UI 回帰。
 * 正しいコードは試合表へのリダイレクトだけ(行き先の画面は matches-participant.spec.ts が見ている)なので、
 * 見た目を固定するのは「見つからない」画面。
 * ネットワーク断の画面は SSR のサーバー側でしか起こせないので対象外。
 */

// e2e/ui/mock-api.mjs の NOT_FOUND_SHARE_CODE と揃える(モックが 404 を返すコード)
const NOT_FOUND_SHARE_CODE = 'nosuchcd'

test.beforeEach(async ({ page }) => {
  await prepare(page)
})

test('正しいコードなら試合表へリダイレクトする', async ({ page }) => {
  await page.goto(`/r/${SHARE_CODE}`)
  await expect(page).toHaveURL(`/rooms/${ROOM_ID}/matches`)
  await expect(page.getByText(ROOM_TITLE).first()).toBeVisible()
})

test.describe('見つからないコード', () => {
  async function openNotFound(page: Page) {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      // ページ自身を 404 で返すと、Chrome は必ず「404 を受け取った」とログに出す。これは狙いどおりなので除く
      // (API など他の URL の失敗は拾う)
      if (new URL(m.location().url).pathname === `/r/${NOT_FOUND_SHARE_CODE}` && m.text().includes('status of 404')) return
      errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    const res = await page.goto(`/r/${NOT_FOUND_SHARE_CODE}`)
    // 打ち間違いなどは障害ではないので 404(以前は 500 を返していた)
    expect(res?.status()).toBe(404)
    await expect(page.getByText('このリンクのランダム表が見つかりませんでした。')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    return errors
  }

  test('コンソールエラーが出ない(hydration mismatch を含む)', async ({ page }) => {
    await expectNoConsoleErrors(page, await openNotFound(page))
  })

  test('スマホ幅で横スクロールが出ない', async ({ page }) => {
    await openNotFound(page)
    await expectNoHorizontalOverflow(page)
  })

  test('アクセシビリティ違反が既知のものから増えていない', async ({ page }) => {
    await openNotFound(page)
    await expectAxeWithinKnown(page, 'shareCodeNotFound')
  })

  test('見た目が基準画像と一致する', async ({ page }) => {
    await openNotFound(page)
    await expect(page).toHaveScreenshot('share-code-not-found.png', { fullPage: true })
  })
})
