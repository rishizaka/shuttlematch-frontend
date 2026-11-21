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
 * `ADSENSE_SLOT_ID`(表示広告ユニットの ID)が未設定のあいだ、または開発中は何も
 * 表示しない。広告枠の準備中であることを利用者へ見せず、ローカル開発・vitest・E2E
 * では広告を読み込んだりクリックしたりしないための安全策でもある。
 */
export function AdSlot() {
  if (import.meta.env.DEV || !ADSENSE_SLOT_ID) {
    return null
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
