import { useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import { ADSENSE_CLIENT_ID, ADSENSE_SLOT_ID } from '../../lib/ads'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

/**
 * ミニゲームの広告枠。マネタイズはミニゲームのページに閉じて、試合表や TOP には出さない方針。
 *
 * `ADSENSE_SLOT_ID`(表示広告ユニットの ID)が未設定のあいだ、または開発中は
 * 常にプレースホルダーを表示する。ローカル開発・vitest・E2E で誤って広告を
 * 読み込んだりクリックしたりしないための安全策で、本番ビルドで
 * `ADSENSE_SLOT_ID` を設定した瞬間だけ実際の広告に切り替わる。
 */
export function AdSlot() {
  if (import.meta.env.DEV || !ADSENSE_SLOT_ID) {
    return (
      <div className="flex h-[100px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100/60">
        <span className="text-xs tracking-wider text-slate-400">AD SPACE</span>
      </div>
    )
  }
  return <AdUnit slot={ADSENSE_SLOT_ID} />
}

/**
 * 実際の広告 <ins> と push({}) の呼び出し。
 * SPA 遷移で <ins> が使い回されると 2 回目以降のページで広告が空になるため、
 * pathname を key にして遷移のたびにマウントし直す。
 */
function AdUnit({ slot }: { slot: string }) {
  const { pathname } = useLocation()
  return <AdUnitInner key={pathname} slot={slot} />
}

function AdUnitInner({ slot }: { slot: string }) {
  useEffect(() => {
    try {
      ;(window.adsbygoogle = window.adsbygoogle ?? []).push({})
    } catch {
      // 広告ブロッカー等で adsbygoogle が読み込めていない場合は何もしない
    }
  }, [])

  return (
    <ins
      className="adsbygoogle block h-[100px] w-full"
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}
