import { useRef } from 'react'
import { Play, Settings2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { burst } from '../../lib/motion'
import { ShareButtons } from '../../features/room'

/**
 * 運営者だけに、1セット目を始めるまで出す「はじめに」カード。
 *
 * 作成直後の試合表ページには「次に何をすればいいか」が書かれておらず、運営者の目に最初に入るのは
 * 参加者向けの「参加する」欄だった。「第1セット開始」は第1セット見出しの右にある小さなボタンで、
 * スクショ用ページもあるため、開始ボタンを一度も押さずに(画面やスクショを見せるだけで)回せてしまう。
 * 2026-10〜11 の集計では、作成された試合表の約85%で一度も開始ボタンが押されていなかった。
 *
 * そこで「① 参加者にリンクを送る → ② コートに入ったら第1セット開始」の2手を、押す理由と一緒に見せる。
 * 1セット目が始まったら(activeSetNumber が決まったら)呼び出し側で出さなくなる。
 */
export function OrganizerGettingStarted({
  roomId,
  shareCode,
  starting,
  onStartFirstSet,
  onOpenOrganizerMenu,
}: {
  roomId: string
  shareCode?: string
  /** 第1セットの開始処理中か。 */
  starting: boolean
  onStartFirstSet: () => void
  /** 運営メニューを開く(運営者用リンクはその中にある)。 */
  onOpenOrganizerMenu: () => void
}) {
  const startRef = useRef<HTMLButtonElement>(null)

  return (
    <section
      aria-labelledby="organizer-getting-started-title"
      className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5"
    >
      <h2
        id="organizer-getting-started-title"
        className="text-sm font-bold text-slate-900"
      >
        試合表ができました。当日はこの2つだけ
      </h2>

      <ol className="mt-3 space-y-4">
        <li className="flex gap-3">
          <StepNumber>1</StepNumber>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">参加者にリンクを送る</p>
            <p className="mt-0.5 text-xs text-slate-600">
              参加者が名前を入れて参加すると、自分の出る試合が光って見つけやすくなります。
            </p>
            <div className="mt-2">
              <ShareButtons roomId={roomId} shareCode={shareCode} />
            </div>
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber>2</StepNumber>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              コートに入ったら「第1セット開始」
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {'開始すると、参加者の画面に「いまのセット」が出ます。' +
                '遅刻・早退で組み直すときも、まだ始まっていないセットだけが入れ替わります。'}
            </p>
            <Button
              ref={startRef}
              type="button"
              className="mt-2"
              disabled={starting}
              onClick={() => {
                onStartFirstSet()
                burst(startRef.current)
              }}
            >
              <Play className="h-4 w-4 fill-current" />
              {starting ? '開始中…' : '第1セット開始'}
            </Button>
          </div>
        </li>
      </ol>

      <p className="mt-4 border-t border-brand-100 pt-3 text-xs text-slate-500">
        {'別のスマホで運営するときは、運営メニューの「運営者用リンク」を自分に送っておいてください。' +
          '運営できるのは、この試合表を作った端末だけです。'}
        <button
          type="button"
          onClick={onOpenOrganizerMenu}
          className="ml-1 inline-flex items-center gap-0.5 font-medium text-brand-600 hover:underline"
        >
          <Settings2 className="h-3 w-3" />
          運営メニューを開く
        </button>
      </p>
    </section>
  )
}

function StepNumber({ children }: { children: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
    >
      {children}
    </span>
  )
}
