import { describe, expect, it } from 'vitest'
import { detectInAppBrowser } from './in-app-browser'

/** 実際の端末が送ってくる User-Agent の例。 */
const UA = {
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 338.0.0.25.91 (iPhone14,2; iOS 17_5_1; ja_JP; ja; scale=3.00; 1170x2532; 600489977)',
  instagramAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Instagram 338.0.0.25.91 Android',
  lineIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Line/14.9.0',
  facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.109;FBBV/630000000]',
  twitter:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.52',
  tiktok:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 BytedanceWebview/d8a21c6',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}

describe('detectInAppBrowser', () => {
  it('Instagram のアプリ内ブラウザを見分ける(iOS・Android とも)', () => {
    expect(detectInAppBrowser(UA.instagramIos)).toEqual({
      name: 'Instagram',
      canOpenExternally: false,
    })
    expect(detectInAppBrowser(UA.instagramAndroid)?.name).toBe('Instagram')
  })

  it('LINE だけは URL だけで外部ブラウザへ移れる', () => {
    expect(detectInAppBrowser(UA.lineIos)).toEqual({ name: 'LINE', canOpenExternally: true })
  })

  it('Facebook・X・TikTok も見分ける', () => {
    expect(detectInAppBrowser(UA.facebook)?.name).toBe('Facebook')
    expect(detectInAppBrowser(UA.twitter)?.name).toBe('X')
    expect(detectInAppBrowser(UA.tiktok)?.name).toBe('TikTok')
  })

  it('通常のブラウザは null(案内を出さない)', () => {
    expect(detectInAppBrowser(UA.safariIos)).toBeNull()
    expect(detectInAppBrowser(UA.chromeAndroid)).toBeNull()
    expect(detectInAppBrowser(UA.chromeMac)).toBeNull()
  })

  it('Android の "Linux" を LINE と取り違えない', () => {
    // `Line/` の / まで見ているので "Linux; Android" には当たらない。
    expect(detectInAppBrowser(UA.chromeAndroid)).toBeNull()
    expect(detectInAppBrowser(UA.instagramAndroid)?.name).toBe('Instagram')
  })

  it('空文字や未知の UA でも落ちない', () => {
    expect(detectInAppBrowser('')).toBeNull()
    expect(detectInAppBrowser('なにかよく分からない UA')).toBeNull()
  })
})
