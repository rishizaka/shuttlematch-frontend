import { createPortal } from 'react-dom'
import qrcode from 'qrcode-generator'
import { Button } from '../ui/Button'

/**
 * 試合表のURLをQRコードで表示するモーダル。会場でスマホのカメラに読ませて配る用。
 *
 * QRの生成ライブラリごと動的 import される前提のファイル(呼び出し側が React.lazy で読む)。
 * 試合表のページは参加者全員が開くので、運営者しか使わないQRを既定のバンドルに載せない。
 */
export default function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  // 誤り訂正レベル M。会場の紙やスマホ画面越しでも読める程度に余裕を持たせる。
  // 型番 0 は「入るいちばん小さい型番を自動で選ぶ」。
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const count = qr.getModuleCount()

  // 黒いマスを1本のパスにまとめる。マス毎に <rect> を置くと数百要素になる。
  let path = ''
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`
    }
  }
  // 静音領域(クワイエットゾーン)。仕様上4マス必要で、詰めると読み取りが落ちる。
  const quiet = 4
  const size = count + quiet * 2

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="試合表のQRコード"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900">試合表のQRコード</h2>
        <p className="mt-1 text-xs text-slate-500">
          スマホのカメラで読み取ると試合表が開きます。
        </p>

        {/* QR は白地に黒でないと読み取りが安定しないので、ダーク配色にはしない。 */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="mx-auto mt-4 h-auto w-full max-w-[15rem] rounded-lg bg-white"
          shapeRendering="crispEdges"
          role="img"
          aria-label="試合表のURLのQRコード"
        >
          <rect width={size} height={size} fill="#ffffff" />
          <g transform={`translate(${quiet} ${quiet})`}>
            <path d={path} fill="#0f172a" />
          </g>
        </svg>

        <p className="mt-3 break-all text-[11px] leading-relaxed text-slate-400">{url}</p>

        <div className="mt-4">
          <Button className="w-full" variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
