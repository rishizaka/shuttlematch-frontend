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

/** 検証で作ったルームを配下データごと削除する(後始末)。 */
export async function deleteRoom(request: APIRequestContext, roomId: string) {
  await request.delete(`${API_BASE}/api/v1/rooms/${roomId}`).catch(() => {})
}
