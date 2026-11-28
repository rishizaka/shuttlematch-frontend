// UI 回帰テスト用のモック API。backend の代わりに固定の JSON を返す。
// SSR(サーバー側の loader)とブラウザの両方がここを叩くので、page.route ではなく本物の HTTP サーバーにしている。
// データは e2e/ui/fixtures/ に置く(本物の backend の応答を取って ID と時刻を固定値に置き換えたもの)。
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const PORT = Number(process.env.MOCK_API_PORT || 8099)
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const generated = fixture('room-generated')

/**
 * 1セット目を始める前の試合表(運営者に「はじめに」カードが出る状態)。fixture をもう1つ持つと
 * 参加者や試合の並びが2か所でずれていくので、room-generated から ID・共有コードを替え、
 * 開始時刻を全部消して作る。ID・共有コードは e2e/ui/helpers.ts の NOT_STARTED_* と揃える。
 */
const NOT_STARTED_ROOM_ID = '00000000-0000-4000-8000-000000000002'
const NOT_STARTED_SHARE_CODE = 'uiregr02'
const notStarted = {
  room: { ...generated.room, id: NOT_STARTED_ROOM_ID, shareCode: NOT_STARTED_SHARE_CODE },
  matches: {
    ...generated.matches,
    roomId: NOT_STARTED_ROOM_ID,
    matches: generated.matches.matches.map((match) => ({ ...match, startedAt: null })),
  },
}

/** パス → 応答。ここに無い API はテストが想定していない呼び出しなので 404 を返し、ログに残す。 */
const routes = {
  [`/api/v1/rooms/${generated.room.id}`]: generated.room,
  [`/api/v1/rooms/${generated.room.id}/matches`]: generated.matches,
  [`/api/v1/rooms/code/${generated.room.shareCode}`]: generated.room,
  [`/api/v1/rooms/${notStarted.room.id}`]: notStarted.room,
  [`/api/v1/rooms/${notStarted.room.id}/matches`]: notStarted.matches,
}

/** 「無い」ことを確かめるためのパス。backend と同じく 404 を返す(想定どおりなので「未定義」のログは出さない)。 */
// e2e/ui/share-code.spec.ts の NOT_FOUND_SHARE_CODE と揃える
const NOT_FOUND_SHARE_CODE = 'nosuchcd'
const notFound = new Set([`/api/v1/rooms/code/${NOT_FOUND_SHARE_CODE}`])

/** 中身を返さない POST(計測の記録など)。backend と同じく 204 を返す。 */
const noContentPosts = new Set([`/api/v1/rooms/${generated.room.id}/participant-opens`])

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  const path = new URL(req.url, 'http://x').pathname
  if (path === '/health') return res.writeHead(200).end('ok')
  if (req.method === 'POST' && noContentPosts.has(path)) return res.writeHead(204).end()
  const body = req.method === 'GET' ? routes[path] : undefined
  if (body === undefined) {
    if (!notFound.has(path)) console.warn(`[mock-api] 未定義: ${req.method} ${path}`)
    res.writeHead(404, { 'Content-Type': 'application/problem+json' })
    return res.end(JSON.stringify({ status: 404, title: 'Not Found', detail: `mock: ${path}` }))
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}).listen(PORT, () => console.log(`[mock-api] http://localhost:${PORT}`))
