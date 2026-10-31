import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
import handler from './dist/server/server.js'

// backend の実体(同一ホスト上で 8080)。ブラウザからは同一オリジンの /api を叩き、
// このサーバーが backend へ中継する。これによりクライアント側 API 呼び出しに CORS が
// 不要になり、公開ホスト名/IP をフロントのバンドルへ焼き込む必要もなくなる。
const API_TARGET = (process.env.API_PROXY_TARGET || 'http://localhost:8080').replace(/\/$/, '')

/** /api/* を backend へリバースプロキシするミドルウェア。 */
async function apiProxy(request, next) {
  const url = new URL(request.url)
  if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
    return next()
  }

  const headers = new Headers(request.headers)
  headers.delete('host')

  const method = request.method
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()

  const upstream = await fetch(API_TARGET + url.pathname + url.search, {
    method,
    headers,
    body,
    redirect: 'manual',
  })

  // content-encoding/length は fetch 側で解決済みのため落とし、srvx に再設定させる。
  const resHeaders = new Headers(upstream.headers)
  resHeaders.delete('content-encoding')
  resHeaders.delete('content-length')
  resHeaders.delete('transfer-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  })
}

/**
 * Vite が出力する /assets/* はファイル名に内容ハッシュが入っていて、中身が変われば URL も変わる。
 * なので 1 年 immutable で返してよい。付けないと Cloudflare の既定(max-age=14400 = 4時間)になり、
 * 試合表を開き直すたびに JS/CSS の再検証・再取得が走る。
 * public/ 直下(ロゴ・favicon・ads.txt など)はハッシュが無いので対象外。
 */
async function immutableAssets(request, next) {
  const res = await next()
  if (!res.ok || !new URL(request.url).pathname.startsWith('/assets/')) return res
  // new Response(res.body, ...) で包み直さないこと。serveStatic の FastResponse は body が
  // Node ストリームで、res.body で Web ストリーム化すると二重 close でプロセスごと落ちる。
  res.headers.set('cache-control', 'public, max-age=31536000, immutable')
  return res
}

serve({
  fetch: handler.fetch,
  port: process.env.PORT || 3000,
  hostname: '0.0.0.0',
  middleware: [apiProxy, immutableAssets, serveStatic({ dir: './dist/client' })],
})
