import { Suspense, lazy, useState } from 'react'
import { QrCode, Share2 } from 'lucide-react'
import { copyToClipboard } from '../../lib/clipboard'
import { shareOrigin } from '../../lib/og'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'

// QR の生成ライブラリごと、開いたときに初めて読み込む。試合表のページは参加者全員が
// 開くので、実際に押した人だけが払うコストにする(既定のバンドルには載せない)。
const QrModal = lazy(() => import('./QrModal'))

/**
 * 試合表の共有リンク・QRコード表示。
 *
 * 以前は運営メニュー(ParticipantManager)の中にしか無く、一般参加者は友人を誘う
 * のに使えなかった。「一般参加者でも試合表を共有できるようにしたい」という要望を受け、
 * 試合表ページのヘッダーに全員向けとして切り出した。ParticipantManager 側にも同じ
 * ボタンが残っているが、運営メニューの中身としてそのままにしてある(同じ操作が2箇所に
 * あっても実害はない。むしろ運営者は「共有」を運営メニューでも見慣れている)。
 */
export function ShareButtons({
  roomId,
  shareCode,
  size = 'sm',
}: {
  roomId: string
  /** 共有コード。あれば短縮URL(/r/{code})を使う。 */
  shareCode?: string
  size?: 'sm' | 'md'
}) {
  const { showToast } = useToast()
  const [showQr, setShowQr] = useState(false)

  // openExternalBrowser=1 は LINE 等のアプリ内ブラウザから
  // 既定(外部)ブラウザで開かせるためのパラメータ。
  const origin = shareOrigin()
  const shareUrl = shareCode
    ? `${origin}/r/${shareCode}?openExternalBrowser=1`
    : `${origin}/rooms/${roomId}/matches?openExternalBrowser=1`

  const shareLink = async () => {
    if (typeof window === 'undefined') return
    const ok = await copyToClipboard(shareUrl)
    if (ok) showToast('リンクをコピーしました')
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button type="button" size={size} variant="secondary" onClick={shareLink}>
          <Share2 className="h-4 w-4" />
          試合表を共有
        </Button>
        {/* 会場でリンクを送れない相手にはQRで渡す。共有するURLは同じ
            (短縮URL + openExternalBrowser=1)。 */}
        <Button type="button" size={size} variant="secondary" onClick={() => setShowQr(true)}>
          <QrCode className="h-4 w-4" />
          QRを表示
        </Button>
      </div>

      {showQr ? (
        <Suspense fallback={null}>
          <QrModal url={shareUrl} onClose={() => setShowQr(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
