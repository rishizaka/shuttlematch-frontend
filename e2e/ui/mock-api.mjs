// UI 回帰テスト用のモック API。backend の代わりに固定の JSON を返す。
// SSR(サーバー側の loader)とブラウザの両方がここを叩くので、page.route ではなく本物の HTTP サーバーにしている。
// データは e2e/ui/fixtures/ に置く(本物の backend の応答を取って ID と時刻を固定値に置き換えたもの)。
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const PORT = Number(process.env.MOCK_API_PORT || 8099)
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const generated = fixture('room-generated')

/** パス → 応答。ここに無い API はテストが想定していない呼び出しなので 404 を返し、ログに残す。 */
const routes = {
  [`/api/v1/rooms/${generated.room.id}`]: generated.room,
  [`/api/v1/rooms/${generated.room.id}/matches`]: generated.matches,
  [`/api/v1/rooms/code/${generated.room.shareCode}`]: generated.room,
}

/** 「無い」ことを確かめるためのパス。backend と同じく 404 を返す(想定どおりなので「未定義」のログは出さない)。 */
// e2e/ui/share-code.spec.ts の NOT_FOUND_SHARE_CODE と揃える
const NOT_FOUND_SHARE_CODE = 'nosuchcd'
const notFound = new Set([`/api/v1/rooms/code/${NOT_FOUND_SHARE_CODE}`])

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  const path = new URL(req.url, 'http://x').pathname
  if (path === '/health') return res.writeHead(200).end('ok')
  const body = req.method === 'GET' ? routes[path] : undefined
  if (body === undefined) {
    if (!notFound.has(path)) console.warn(`[mock-api] 未定義: ${req.method} ${path}`)
    res.writeHead(404, { 'Content-Type': 'application/problem+json' })
    return res.end(JSON.stringify({ status: 404, title: 'Not Found', detail: `mock: ${path}` }))
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}).listen(PORT, () => console.log(`[mock-api] http://localhost:${PORT}`))
