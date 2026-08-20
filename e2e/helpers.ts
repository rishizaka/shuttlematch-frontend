import { expect, type APIRequestContext, type Page } from '@playwright/test'

/**
 * SSR フォームはハイドレーション完了時に controlled input が state(初期値)へ
 * リセットされる。全項目をまとめて入力→少し待って全項目が生き残っているか確認し、
 * どれかがリセットされていたら全体を入力し直す。ハイドレーションが済めば定着して抜ける。
 */
export async function fillFieldsStable(
  page: Page,
  fields: Array<[selector: string, value: string]>,
) {
  await expect(async () => {
    for (const [selector, value] of fields) {
      await page.locator(selector).fill(value)
    }
    await page.waitForTimeout(500) // ハイドレーションのリセットを待つ
    for (const [selector, value] of fields) {
      await expect(page.locator(selector)).toHaveValue(value, { timeout: 200 })
    }
  }).toPass({ timeout: 20_000 })
}

// E2E 用の backend API ベース。
//   ローカル: backend を直接叩く(http://localhost:8080)
//   本番    : フロント同一オリジン(3000)の /api プロキシ経由(E2E_BASE_URL を使う)
export const API_BASE = (
  process.env.E2E_API_BASE ||
  process.env.E2E_BASE_URL ||
  'http://localhost:8080'
).replace(/\/$/, '')

/** URL から roomId(UUID)を取り出す。/rooms/{id}/matches など。 */
export function roomIdFromUrl(url: string): string | null {
  const m = url.match(/\/rooms\/([0-9a-fA-F-]{36})/)
  return m ? m[1] : null
}

/** ゲストユーザーを発行して id を返す。 */
export async function createGuest(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/v1/users/guest`, {
    data: { name: 'e2e' },
  })
  return (await res.json()).id
}

/** かんたん作成で番号参加者+試合表を用意し、room を返す。 */
export async function quickCreateRoom(
  request: APIRequestContext,
  opts: { participantCount: number; courtCount: number; title?: string },
) {
  const createdBy = await createGuest(request)
  const res = await request.post(`${API_BASE}/api/v1/rooms/quick`, {
    data: {
      title: opts.title ?? `E2E QA ${Date.now()}`,
      courtCount: opts.courtCount,
      participantCount: opts.participantCount,
      createdBy,
    },
  })
  return res.json()
}

/**
 * 検証で作ったルームを配下データごと削除する(後始末)。
 * 削除には共有コードが要るので、ルームを引いてから消す。
 */
export async function deleteRoom(request: APIRequestContext, roomId: string) {
  try {
    const res = await request.get(`${API_BASE}/api/v1/rooms/${roomId}`)
    const shareCode = (await res.json()).shareCode as string
    await request.delete(
      `${API_BASE}/api/v1/rooms/${roomId}?shareCode=${encodeURIComponent(shareCode)}`,
    )
  } catch {
    // 後始末なので、失敗してもテスト結果は変えない
  }
}

/** 現在の試合表(スケジュール)を取得する。UI がレンダするのと同じデータ。 */
export async function getSchedule(request: APIRequestContext, roomId: string) {
  const res = await request.get(`${API_BASE}/api/v1/rooms/${roomId}/matches`)
  return res.json()
}

type Match = {
  setNumber: number
  courtNumber: number | null
  pairA: { player1Id: string; player2Id: string }
  pairB: { player1Id: string; player2Id: string }
}

/** 1試合の出場者4名(ParticipantId)。 */
export function playersOf(m: Match): string[] {
  return [m.pairA.player1Id, m.pairA.player2Id, m.pairB.player1Id, m.pairB.player2Id]
}

/**
 * 試合表の偏り指標を算出する。number は参加者一覧の並び順(1始まり)。
 * onlyPresent を渡すと、その番号集合(全期間在席の人)だけで公平性を評価する
 * (途中参加・早退者は出場総数が違って当然なので除外する)。
 */
export function analyzeFairness(
  matches: Match[],
  idByNumber: Map<number, string>,
  onlyPresent?: Set<number>,
) {
  const idToNum = new Map<string, number>()
  for (const [num, id] of idByNumber) idToNum.set(id, num)
  const sets = [...new Set(matches.map((m) => m.setNumber))].sort((a, b) => a - b)

  const playingBySet = new Map<number, Set<number>>()
  for (const s of sets) playingBySet.set(s, new Set())
  const cooc = new Map<string, number>() // 同じコートに一緒になった回数(番号ペア)
  for (const m of matches) {
    const nums = playersOf(m).map((id) => idToNum.get(id)!).filter((n) => n != null)
    for (const n of nums) playingBySet.get(m.setNumber)!.add(n)
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++) {
        const key = [nums[i], nums[j]].sort((a, b) => a - b).join('-')
        cooc.set(key, (cooc.get(key) ?? 0) + 1)
      }
  }

  const target = onlyPresent ?? new Set(idByNumber.keys())
  const play = new Map<number, number>()
  const rest = new Map<number, number>()
  for (const n of target) {
    play.set(n, 0)
    rest.set(n, 0)
  }
  for (const s of sets) {
    const pl = playingBySet.get(s)!
    for (const n of target) {
      if (pl.has(n)) play.set(n, play.get(n)! + 1)
      else rest.set(n, rest.get(n)! + 1)
    }
  }
  // 各人の最大連続出場(休みスパン)
  let maxStreak = 0
  for (const n of target) {
    let cur = 0
    for (const s of sets) {
      cur = playingBySet.get(s)!.has(n) ? cur + 1 : 0
      maxStreak = Math.max(maxStreak, cur)
    }
  }
  const playVals = [...play.values()]
  const restVals = [...rest.values()]
  const coocVals = [...cooc.values()]
  const diff = (a: number[]) => (a.length ? Math.max(...a) - Math.min(...a) : 0)
  return {
    sets: sets.length,
    playDiff: diff(playVals),
    restDiff: diff(restVals),
    maxStreak,
    coocMax: coocVals.length ? Math.max(...coocVals) : 0,
    coocMin: coocVals.length ? Math.min(...coocVals) : 0,
    coocAvg: coocVals.length ? coocVals.reduce((a, b) => a + b, 0) / coocVals.length : 0,
    playingBySet,
  }
}

/** ルームを作成し、このブラウザを運営者(createdBy)として振る舞わせる。 */
export async function createRoomAsOrganizer(
  page: Page,
  request: APIRequestContext,
  opts: { participantCount: number; courtCount: number },
) {
  const uid = await createGuest(request)
  const res = await request.post(`${API_BASE}/api/v1/rooms/quick`, {
    data: {
      title: `E2E QA ${Date.now()}`,
      courtCount: opts.courtCount,
      participantCount: opts.participantCount,
      createdBy: uid,
    },
  })
  const room = await res.json()
  await page.addInitScript(
    (user) => localStorage.setItem('shuttlematch.currentUser', JSON.stringify(user)),
    { id: uid, name: 'e2e', email: null },
  )
  return room
}

/** room.participants の並び順を 1始まりの番号に写像する。 */
export function numberMap(participants: Array<{ id: string }>): Map<number, string> {
  const m = new Map<number, string>()
  participants.forEach((p, i) => m.set(i + 1, p.id))
  return m
}
