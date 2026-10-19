import { Suspense, lazy, useState } from 'react'
import { Copy, KeyRound, QrCode } from 'lucide-react'
import { copyToClipboard } from '../../lib/clipboard'
import { getOrganizerToken } from '../../lib/local-store'
import { organizerLinkUrl } from '../../lib/organizer-link'
import { shareOrigin } from '../../lib/og'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'

const QrModal = lazy(() => import('./QrModal'))

/**
 * 運営メニューの「運営者用リンク」。この端末の運営者トークンを入れたリンクを、
 * 別の端末(自分のスマホ・共同運営者)に渡して、そちらでも運営できるようにする。
 *
 * 運営者トークンは作成した端末にしか無いので、端末をなくす・ブラウザのデータを消すと
 * 運営できなくなる。このリンクを手元に控えておけば、その逃げ道にもなる。
 *
 * リンクを持つ人は誰でも運営者になれるので、参加者向けの共有(ShareButtons)とは
 * 見た目と文言をはっきり分け、渡す相手を限るよう注意書きを添える。
 * トークンを持たない端末(導入前に作ったランダム表など)では出さない。
 */
export function OrganizerLinkSection({ roomId }: { roomId: string }) {
  const { showToast } = useToast()
  const [showQr, setShowQr] = useState(false)
  const token = getOrganizerToken(roomId)
  if (!token) return null

  const url = organizerLinkUrl(shareOrigin(), roomId, token)

  const copy = async () => {
    if (await copyToClipboard(url)) {
      showToast('運営者用リンクをコピーしました。運営を任せる人にだけ送ってください')
    }
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-slate-800">運営者用リンク</h3>
      </div>
      <p className="text-xs text-slate-500">
        別の端末や共同運営者もこのランダム表を運営できるようにするリンクです。
        端末をなくしたときの控えにもなります。
      </p>
      <p className="mt-1 text-xs font-medium text-amber-700">
        持っている人は誰でも運営(終了・削除など)ができます。参加者用の共有リンクとは別物なので、
        運営を任せる人にだけ渡してください。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={copy}>
          <Copy className="h-4 w-4" />
          リンクをコピー
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowQr(true)}>
          <QrCode className="h-4 w-4" />
          QRを表示
        </Button>
      </div>

      {showQr ? (
        <Suspense fallback={null}>
          <QrModal
            url={url}
            title="運営者用リンク"
            description="読み取った端末でもこのランダム表を運営できるようになります。運営を任せる人にだけ見せてください。"
            onClose={() => setShowQr(false)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
