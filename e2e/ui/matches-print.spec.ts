import { expect, test } from '@playwright/test'
import fixture from './fixtures/room-generated.json' with { type: 'json' }

/**
 * スクショ用ページ(/rooms/{id}/matches/print)の UI 回帰。
 * 白い覆いが画面全体を覆い、ヘッダー・フッターを隠して、全セットの表だけを出すこと。
 * 以前、覆いがページ切り替えのアニメーション(transform)の中に閉じ込められ、
 * 表が1行目の途中で切れてヘッダーとフッターが見えたままになっていた。
 */
const SETS = new Set(fixture.matches.matches.map((m) => m.setNumber)).size

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) =>
      route.request().resourceType() === 'script'
        ? route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
        : route.fulfill({ status: 204, body: '' }),
  )
})

test('全画面を覆い、全セットの表だけが見える', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`/rooms/${fixture.room.id}/matches/print`)
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(SETS)

  // 覆いがビューポートと同じ大きさで、ヘッダーより手前にある
  const box = await page.locator('table').locator('..').boundingBox()
  const viewport = page.viewportSize()!
  expect(box).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height })
  const logo = page.locator('header').first()
  const topmost = await page.evaluate(() => {
    const h = document.querySelector('header')!.getBoundingClientRect()
    return document.elementFromPoint(h.left + 10, h.top + 10)?.closest('table, header, div.fixed')?.tagName
  })
  expect(topmost, 'ヘッダーの位置で一番手前にあるのが覆いではない').toBe('DIV')
  await expect(logo).toBeAttached()

  // 最後のセットまでスクロールすれば見える(途中で切れていない)
  await rows.last().scrollIntoViewIfNeeded()
  await expect(rows.last()).toBeInViewport()
  expect(errors).toEqual([])
})

test('見た目が基準画像と一致する', async ({ page }) => {
  await page.goto(`/rooms/${fixture.room.id}/matches/print`)
  await expect(page.locator('tbody tr')).toHaveCount(SETS)
  await page.evaluate(() => document.fonts.ready)
  // 覆いの中だけがスクロールするので、ビューポート分を撮る(fullPage は覆いの外の body の高さになる)
  await expect(page).toHaveScreenshot('matches-print.png')
})
