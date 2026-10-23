import { useEffect, useState } from 'react'
import { ExternalLink, Link2, X } from 'lucide-react'
import { currentInAppBrowser, type InAppBrowser } from '../../lib/in-app-browser'
import { useToast } from '../ui/Toast'

/** 閉じたことを覚えておくキー。タブを閉じるまで出さない(次に開いたらまた出す)。 */
const DISMISSED_KEY = 'shuttlematch.inAppNoticeDismissed'

/**
 * SNS アプリのアプリ内ブラウザで開かれたときに出す案内。
 *
 * アプリ内ブラウザでは、ページは見えるのに**作成や保存だけが失敗する**ことがある
 * (2026-10-23、Instagram から作成すると 403 になる事象。Cloudflare のボット対策が
 * アプリ内ブラウザからの POST を弾いていた)。原因が画面から分からないので、
 * 失敗する前に外のブラウザへ誘導する。
 *
 * LINE だけは URL に `openExternalBrowser=1` を付けると外部ブラウザで開き直せるので、
 * その場合はワンタップのリンクにする。それ以外はアプリごとにメニューの位置も名前も
 * 違うため、**リンクのコピー**を主役にする(どのアプリでも確実に抜けられる)。
 */
export function InAppBrowserNotice() {
  // SSR では判定できない。サーバーとクライアントで出力を変えると
  // ハイドレーション不一致になるので、**マウント後に初めて**状態を決める。
  const [browser, setBrowser] = useState<InAppBrowser | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    const detected = currentInAppBrowser()
    if (!detected) return
    let alreadyDismissed = false
    try {
      alreadyDismissed = sessionStorage.getItem(DISMISSED_KEY) === '1'
    } catch {
      /* sessionStorage が使えない環境では毎回出す */
    }
    setBrowser(detected)
    setDismissed(alreadyDismissed)
  }, [])

  if (!browser || dismissed) return null

  const close = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      /* 覚えておけなくても閉じられれば困らない */
    }
  }

  const copyLink = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      showToast('リンクをコピーしました')
    } catch {
      // アプリ内ブラウザはクリップボードを許可しないことがある。
      // その場合は URL を選択状態にして、長押しでコピーしてもらう。
      showToast('コピーできませんでした。アドレスバーのURLをコピーしてください')
    }
  }

  return (
    <div className="border-b border-accent-200 bg-accent-50">
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-accent-700">
            {browser.name}のアプリ内ブラウザで開いています
          </p>
          <p className="mt-1 text-xs leading-relaxed text-accent-700/90">
            このままだと乱数表の作成や保存に失敗することがあります。
            {browser.canOpenExternally
              ? 'Safari などのブラウザで開き直してください。'
              : 'リンクをコピーして、Safari などのブラウザで開き直してください。'}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {browser.canOpenExternally ? (
              <a
                href={externalUrl()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-brand-900 transition hover:bg-accent-400"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                ブラウザで開く
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-brand-900 transition hover:bg-accent-400"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                リンクをコピー
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="この案内を閉じる"
          className="shrink-0 rounded-lg p-1 text-accent-700/70 transition hover:bg-accent-100 hover:text-accent-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** LINE 用。いまの URL に `openExternalBrowser=1` を足したもの。 */
function externalUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.set('openExternalBrowser', '1')
  return url.toString()
}
