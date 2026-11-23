import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fixture from './fixtures/room-generated.json' with { type: 'json' }
import axeKnown from './axe-known-violations.json' with { type: 'json' }

/**
 * 試合表(参加者視点・スマホ幅)の UI 回帰。
 * 「良くしたら、テストで固定する」ための土台。直した UX が後の変更で戻らないようにする。
 *
 * - データはモック API の固定値(10人2コート、1セット目開始済み、この端末は番号未選択)。
 * - アクセシビリティ違反は「今ある違反(axe-known-violations.json)」を許容し、増えたら落とす。
 *   直して消えたらリストからも消す(消し忘れもテストが落として知らせる)。こうしてリストを減らしていく。
 */
const ROOM_ID = fixture.room.id

test.beforeEach(async ({ page }) => {
  // 経過時間などの表示を固定する(1セット目開始の 10 分後)
  await page.clock.setFixedTime(new Date('2026-11-24T10:15:00Z'))
  // 外部サービス(Cloudflare Web Analytics のビーコン等)は空で返す。本物に送ると、
  // テストのアクセスが解析に混ざるうえ、localhost からは CORS エラーになって結果が揺れる。
  await page.route(
    (url) => url.hostname !== 'localhost',
    (route) =>
      route.request().resourceType() === 'script'
        ? route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
        : route.fulfill({ status: 204, body: '' }),
  )
})

async function openMatches(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`/rooms/${ROOM_ID}/matches`)
  // ハイドレーションが済む(inert が外れる)まで待つ
  await expect(page.locator('main [inert]')).toHaveCount(0)
  await expect(page.getByText(fixture.room.title).first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return errors
}

test('コンソールエラーが出ない(hydration mismatch を含む)', async ({ page }) => {
  const errors = await openMatches(page)
  // 遅れて出るエラー(ポーリング・遅延描画)も拾う
  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
})

test('スマホ幅で横スクロールが出ない', async ({ page }) => {
  await openMatches(page)
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((n) => n.getBoundingClientRect().right > el.clientWidth + 1)
      .slice(0, 5)
      .map((n) => `${n.tagName.toLowerCase()}.${n.className}`.slice(0, 120))
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, wide }
  })
  expect(overflow.scrollWidth, `はみ出している要素: ${overflow.wide.join(' / ')}`).toBeLessThanOrEqual(
    overflow.clientWidth,
  )
})

test('アクセシビリティ違反が既知のものから増えていない', async ({ page }) => {
  await openMatches(page)
  const results = await new AxeBuilder({ page }).analyze()
  const found = [...new Set(results.violations.map((v) => v.id))].sort()
  const known = [...axeKnown.matchesParticipant].sort()
  const added = found.filter((id) => !known.includes(id))
  const fixed = known.filter((id) => !found.includes(id))
  const detail = results.violations
    .filter((v) => added.includes(v.id))
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}件, 例: ${v.nodes[0]?.target.join(' ')})`)
  expect(added, `新しい違反:\n${detail.join('\n')}`).toEqual([])
  expect(fixed, '直った違反は e2e/ui/axe-known-violations.json からも消す').toEqual([])
})

test('見た目が基準画像と一致する', async ({ page }) => {
  await openMatches(page)
  await expect(page).toHaveScreenshot('matches-participant.png', { fullPage: true })
})
