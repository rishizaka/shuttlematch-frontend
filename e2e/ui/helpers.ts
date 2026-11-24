import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fixture from './fixtures/room-generated.json' with { type: 'json' }
import axeKnown from './axe-known-violations.json' with { type: 'json' }

/**
 * UI 回帰の共通部品。画面ごとの spec(e2e/ui/*.spec.ts)は test() をそれぞれのファイルに書く
 * (スクショの基準画像は spec ファイルごとのディレクトリに置かれるので、test() をここに移さない)。
 */
export const ROOM_ID = fixture.room.id
export const ROOM_TITLE = fixture.room.title

/** 各テストの前に: 時刻の固定と外部サービスの遮断。 */
export async function prepare(page: Page) {
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
}

/** この端末を運営者にする(作成時に受け取る運営者トークンを localStorage に入れておく)。 */
export async function actAsOrganizer(page: Page) {
  await page.addInitScript(
    ([roomId]) => window.localStorage.setItem(`shuttlematch.organizer.${roomId}`, 'ui-regression-token'),
    [ROOM_ID],
  )
}

/** 試合表を開き、ハイドレーションが済むまで待つ。出たコンソールエラーを集める配列を返す。 */
export async function openMatches(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`/rooms/${ROOM_ID}/matches`)
  await expect(page.locator('main [inert]')).toHaveCount(0)
  await expect(page.getByText(ROOM_TITLE).first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return errors
}

export async function expectNoConsoleErrors(page: Page, errors: string[]) {
  // 遅れて出るエラー(ポーリング・遅延描画)も拾う
  await page.waitForTimeout(1000)
  expect(errors).toEqual([])
}

export async function expectNoHorizontalOverflow(page: Page) {
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
}

/**
 * アクセシビリティ違反が既知リスト(axe-known-violations.json の screen キー)から増えていないか。
 * 直ったのにリストに残っていても落とす(リストは減らす一方)。
 */
export async function expectAxeWithinKnown(page: Page, screen: keyof typeof axeKnown) {
  const results = await new AxeBuilder({ page }).analyze()
  const found = [...new Set(results.violations.map((v) => v.id))].sort()
  // リストが空だと JSON の型が never[] になるので string[] として扱う
  const known: string[] = [...axeKnown[screen]].sort()
  const added = found.filter((id) => !known.includes(id))
  const fixed = known.filter((id) => !found.includes(id))
  const detail = results.violations
    .filter((v) => added.includes(v.id))
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}件, 例: ${v.nodes[0]?.target.join(' ')})`)
  expect(added, `新しい違反:\n${detail.join('\n')}`).toEqual([])
  expect(fixed, `直った違反は e2e/ui/axe-known-violations.json の ${screen} からも消す`).toEqual([])
}
