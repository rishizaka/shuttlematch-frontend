/**
 * アプリ内ブラウザ(SNS アプリに内蔵されたブラウザ)の判定。
 *
 * **なぜ必要か**: 2026-10-23、Instagram のアプリ内ブラウザから乱数表を作ろうとすると
 * 403 になる事象が出た。原因はアプリ側ではなく、Cloudflare のボット対策が
 * アプリ内ブラウザからの POST を遮断していたこと(ページの表示=GET は通るので、
 * 画面は開けるのに作成だけ失敗する、という分かりにくい出方になる)。
 *
 * それとは別に、アプリ内ブラウザは localStorage の扱いが通常のブラウザと違うことがある。
 * このアプリは運営者トークンを localStorage に置くので、アプリ内ブラウザで作ると
 * **作った本人が運営操作できなくなる**恐れがある。どちらの理由でも、
 * 外のブラウザで開き直してもらうのが確実。
 */

/** 判定したアプリ内ブラウザの種類。`null` は通常のブラウザ(または判定不能)。 */
export type InAppBrowser = {
  /** 表示名。「Instagram のアプリ内ブラウザ」のように使う。 */
  name: string
  /**
   * URL に `openExternalBrowser=1` を付けるだけで外部ブラウザへ移れるか。
   * LINE だけが対応している独自仕様で、他のアプリには効かない。
   */
  canOpenExternally: boolean
}

/**
 * User-Agent からアプリ内ブラウザを判定する。
 *
 * 判定は「含まれていたら」の素朴な部分一致。アプリ内ブラウザの UA は各社が
 * 独自に足した目印を持っており、確実な見分け方がこれしかない。
 * 誤判定しても出るのは案内の帯だけなので、取りこぼしを減らす側に倒している。
 */
export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  const ua = userAgent

  // LINE は `Line/` のあとにバージョンが続く。`Linux` に当たらないよう区切りまで見る。
  if (/\bLine\//i.test(ua)) {
    return { name: 'LINE', canOpenExternally: true }
  }
  if (/Instagram/i.test(ua)) {
    return { name: 'Instagram', canOpenExternally: false }
  }
  // Facebook アプリは FBAN(アプリ名) / FBAV(バージョン) / FB_IAB(アプリ内ブラウザ)を付ける。
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) {
    return { name: 'Facebook', canOpenExternally: false }
  }
  // X(旧 Twitter)のアプリ内ブラウザ。
  if (/Twitter/i.test(ua)) {
    return { name: 'X', canOpenExternally: false }
  }
  // TikTok は国・ストアによって目印が違う。
  if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) {
    return { name: 'TikTok', canOpenExternally: false }
  }

  return null
}

/** いま動いているブラウザを判定する。SSR では常に `null`。 */
export function currentInAppBrowser(): InAppBrowser | null {
  if (typeof navigator === 'undefined') return null
  return detectInAppBrowser(navigator.userAgent || '')
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

/**
 * Android のアプリ内ブラウザから Chrome を起動する intent URL。
 * Chrome が無い端末では `browser_fallback_url`(=同じページ)に戻るだけなので害はない。
 * iOS には同等の手段が無い(Instagram 等は外部ブラウザを開かせてくれない)ので、手順の案内になる。
 */
export function androidChromeIntentUrl(href: string): string {
  const url = new URL(href)
  const scheme = url.protocol.replace(':', '')
  return (
    `intent://${url.host}${url.pathname}${url.search}${url.hash}` +
    `#Intent;scheme=${scheme};package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(href)};end`
  )
}
