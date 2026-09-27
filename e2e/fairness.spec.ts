import { test, expect, type Page } from '@playwright/test'
import {
  analyzeFairness,
  API_BASE,
  createRoomAsOrganizer,
  deleteRoom,
  getSchedule,
  numberMap,
  playersOf,
} from './helpers'

// ブラウザから実際に試合表を生成・操作し、その結果の試合表に偏りが無いかを検証する。
// 出場回数・休み回数・休みスパン(最大連続出場)・同じコートに一緒になった回数(ペア偏り)を見る。

// --- UI 操作ヘルパー ---
async function openOrganizerMenu(page: Page) {
  const menu = page.getByRole('button', { name: /運営メニュー/ })
  await expect(menu).toBeVisible()
  // 既に開いていなければ開く(aria-expanded を見る)
  if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click()
}

// ページ最下部の「セットを追加」を開き、ステッパーを count に合わせて追加する。
// (運営メニュー内には置いていない。重複を避けて最下部に一本化してある)
async function addSetsViaUI(page: Page, count: number) {
  const opener = page.getByRole('button', { name: 'セットを追加' })
  await opener.scrollIntoViewIfNeeded()
  await opener.click()

  const stepUp = page.getByRole('button', { name: '追加セット数を増やす' })
  const stepDown = page.getByRole('button', { name: '追加セット数を減らす' })
  await expect(stepUp).toBeVisible()
  // 既定は3。count まで増減する。
  const readCount = async () =>
    Number(await stepUp.locator('xpath=preceding-sibling::span[1]').innerText())
  for (let i = 0; i < 40 && (await readCount()) < count; i++) await stepUp.click()
  for (let i = 0; i < 40 && (await readCount()) > count; i++) await stepDown.click()
  // ステッパーと同じ行にある「追加」ボタン(固定ペアの追加ボタンとは別)。
  const row = page.locator('div.flex.items-center.gap-2', {
    has: page.getByRole('button', { name: '追加セット数を増やす' }),
  })
  await row.getByRole('button', { name: '追加', exact: true }).click()
  await expect(page.getByText('セットを追加しました')).toBeVisible()
}

const configs = [
  { n: 6, courts: 1, label: '6人1コート' },
  { n: 10, courts: 2, label: '10人2コート' },
  { n: 13, courts: 2, label: '13人2コート' },
]

// backend の MatchingDomainService.DEFAULT_SET_COUNT と同じ値(この e2e は frontend の
// リポジトリなので直接参照できず、値をここに写している。backend 側でこの定数を
// 変えたら、ここも合わせて直すこと)。
const DEFAULT_SET_COUNT = 20

for (const { n, courts, label } of configs) {
  test(`偏りなし(${label}): 生成 + UIでセット追加しても公平`, async ({ page, request }) => {
    const room = await createRoomAsOrganizer(page, request, {
      participantCount: n,
      courtCount: courts,
    })
    const roomId: string = room.id
    const nums = numberMap(room.participants)
    try {
      await page.goto(`/rooms/${roomId}/matches`)
      await expect(page.getByText('第1セット')).toBeVisible()

      // UI からセットを +6 追加(既定のDEFAULT_SET_COUNT → +6)。
      const totalSets = DEFAULT_SET_COUNT + 6
      await addSetsViaUI(page, 6)
      // 画面にも増えたことが反映される(最終セットが出る)。
      await expect(page.getByText(`第${totalSets}セット`)).toBeVisible()

      // 結果の試合表(UI がレンダするのと同じデータ)を取得して偏りを検証。
      const schedule = await getSchedule(request, roomId)
      const a = analyzeFairness(schedule.matches, nums)
      const restPerSet = n - 4 * courts
      const streakBound = Math.ceil(n / restPerSet) + 1

      expect(a.sets).toBe(totalSets)
      expect(a.playDiff, '出場回数の偏り').toBeLessThanOrEqual(1)
      expect(a.restDiff, '休み回数の偏り').toBeLessThanOrEqual(1)
      expect(a.maxStreak, '最大連続出場(休みスパン)').toBeLessThanOrEqual(streakBound)
      // 同じコートに一緒になった回数(ペア偏り): 突出したペアが無い。
      expect(a.coocMax, 'ペア偏り(同コート最多)').toBeLessThanOrEqual(
        Math.ceil(a.coocAvg * 2) + 2,
      )
    } finally {
      await deleteRoom(request, roomId)
    }
  })
}

test('偏りなし(10人2コート): 早退・遅刻・再編成しても公平', async ({ page, request }) => {
  const room = await createRoomAsOrganizer(page, request, { participantCount: 10, courtCount: 2 })
  const roomId: string = room.id
  try {
    await page.goto(`/rooms/${roomId}/matches`)
    await expect(page.getByText('第1セット')).toBeVisible()
    await openOrganizerMenu(page)

    // 第1セットを開始(以降を「未開始」にして再編成の対象を作る)。
    await page.getByRole('button', { name: /^第\d+セット開始/ }).first().click()
    const startDialog = page.getByRole('dialog')
    if (await startDialog.isVisible().catch(() => false)) {
      await startDialog.getByRole('button', { name: /開始|はい/ }).click()
    }

    // 10番を早退させる。未開始セットの再編成はサーバー側が同じ操作の中で自動で行うため、
    // (以前あった)「再編成しますか？」の確認は出ない。
    await openOrganizerMenu(page)
    await page.getByRole('button', { name: '早退' }).last().click()
    await expect(page.getByText(/早退にしました/)).toBeVisible()

    // 遅刻(ゲスト追加=11番)して再編成する。
    await openOrganizerMenu(page)
    await page.getByRole('button', { name: /ゲストを追加/ }).click()
    const replan2 = page.getByRole('dialog', { name: '試合表を再編成しますか？' })
    await expect(replan2).toBeVisible()
    await replan2.getByRole('button', { name: 'はい' }).click()
    await expect(page.getByText('未開始セットを再編成しました')).toBeVisible()

    // 2回の再編成が反映されるまで待つ: 未開始(≥2)に早退者(10番)が居らず遅刻者(11番)が居る。
    const numsForCheck = numberMap((await (await request.get(`${API_BASE}/api/v1/rooms/${roomId}`)).json()).participants)
    const leaverId = numsForCheck.get(10)!
    const lateId = numsForCheck.get(11)!
    await expect
      .poll(
        async () => {
          const s = await getSchedule(request, roomId)
          const futureIds = new Set(
            s.matches.filter((m: { setNumber: number }) => m.setNumber >= 2).flatMap(playersOf),
          )
          return !futureIds.has(leaverId) && futureIds.has(lateId)
        },
        { timeout: 10_000 },
      )
      .toBe(true)

    // 早退者は未開始セットに登場しない(P12)を明示検証済み(poll条件)。
    // 未開始セット(≥2)だけを、そこに実際に出ている番号で自己完結的に集計して偏りを見る。
    const schedule = await getSchedule(request, roomId)
    const fresh = await (await request.get(`${API_BASE}/api/v1/rooms/${roomId}`)).json()
    const nums = numberMap(fresh.participants)
    const future = schedule.matches.filter((m: { setNumber: number }) => m.setNumber >= 2)
    const idToNum = new Map<string, number>()
    for (const [num, id] of nums) idToNum.set(id, num)
    const roster = new Set<number>(future.flatMap(playersOf).map((id: string) => idToNum.get(id)!))
    const a = analyzeFairness(future, nums, roster)

    expect(a.restDiff, '在席者の休み回数の偏り(未開始)').toBeLessThanOrEqual(1)
    expect(a.maxStreak, '在席者の最大連続出場(未開始)').toBeLessThanOrEqual(6)
  } finally {
    await deleteRoom(request, roomId)
  }
})
