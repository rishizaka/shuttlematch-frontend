import { createPortal } from 'react-dom'
import { Button } from './Button'
import { useToast } from './Toast'
import { copyToClipboard } from '../../lib/clipboard'
import { androidChromeIntentUrl, isAndroid, type InAppBrowser } from '../../lib/in-app-browser'

/**
 * アプリ内ブラウザで乱数表を作ろうとしたときに、外のブラウザで開き直すよう促すモーダル。
 * (理由は lib/in-app-browser.ts。作成の POST が 403 になる/運営者トークンが別領域に入る)
 *
 * 外部ブラウザを**直接**開けるのは LINE(`openExternalBrowser=1`)と Android(Chrome の intent)
 * だけ。iOS の Instagram 等にはページ側から Safari を開かせる手段が無いので、
 * メニューの手順を案内し、確実に抜けられる「URLをコピー」を添える。
 */
export function OpenInBrowserModal({
  browser,
  url,
  onContinue,
  onCancel,
}: {
  browser: InAppBrowser
  /** 開き直す先。入力済みの人数・コート数を引き継いだ作成ページの URL。 */
  url: string
  /** 判定ミスなどに備えた逃げ道。 */
  onContinue: () => void
  onCancel: () => void
}) {
  const { showToast } = useToast()
  if (typeof document === 'undefined') return null

  const android = isAndroid(navigator.userAgent || '')
  const browserName = android ? 'Chrome' : 'Safari'
  const directUrl = browser.canOpenExternally
    ? withOpenExternalBrowser(url)
    : android
      ? androidChromeIntentUrl(url)
      : null

  const copy = async () => {
    showToast(
      (await copyToClipboard(url))
        ? 'URLをコピーしました'
        : 'コピーできませんでした。アドレスバーのURLをコピーしてください',
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${browserName}で開いてください`}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">{browserName}で開いてください</h2>
        <p className="mt-1 text-sm text-slate-500">
          {browser.name}のアプリ内ブラウザでは、乱数表の作成に失敗したり、あとで運営者として
          操作できなくなったりすることがあります。
        </p>
        {directUrl ? null : (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>
              画面右上（または右下）の <span className="font-semibold">「…」</span>をタップ
            </li>
            <li>
              <span className="font-semibold">「外部ブラウザで開く」</span>を選ぶ
            </li>
          </ol>
        )}
        <div className="mt-5 space-y-2">
          {directUrl ? (
            <Button className="w-full" onClick={() => window.location.assign(directUrl)}>
              {browserName}で開く
            </Button>
          ) : null}
          <Button
            className="w-full"
            variant={directUrl ? 'secondary' : 'primary'}
            onClick={() => void copy()}
          >
            URLをコピー
          </Button>
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              戻る
            </Button>
            <button
              type="button"
              onClick={onContinue}
              className="text-xs text-slate-400 underline"
            >
              このまま作成する
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function withOpenExternalBrowser(href: string): string {
  const url = new URL(href)
  url.searchParams.set('openExternalBrowser', '1')
  return url.toString()
}
