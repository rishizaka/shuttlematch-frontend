import { expect, test, type Page } from '@playwright/test'
import {
  ROOM_ID,
  ROOM_TITLE,
  SHARE_CODE,
  expectAxeWithinKnown,
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
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/r/${NOT_FOUND_SHARE_CODE}`)
    await expect(page.getByText('このリンクのランダム表が見つかりませんでした。')).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    return errors
  }

  test('想定外のコンソールエラーが出ない', async ({ page }) => {
    const errors = await openNotFound(page)
    await page.waitForTimeout(1000)
    // 今は loader の例外がそのまま HTTP 500 になり、ブラウザがその 500 とエラー内容をコンソールに出す。
    // 「見つからない」は本来 404 なので、そう直したらこの許容を外して expect(errors).toEqual([]) にする。
    const unexpected = errors.filter(
      (e) =>
        !e.includes('status of 500') && !e.startsWith(`Error: mock: /api/v1/rooms/code/${NOT_FOUND_SHARE_CODE}`),
    )
    expect(unexpected).toEqual([])
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
