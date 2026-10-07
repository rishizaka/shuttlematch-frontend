/**
 * マイクロインタラクションの小道具。CSS のトランジションはユーティリティクラス
 * (transition-colors など)に上書きされやすいので、押下・紙吹雪は Web Animations API で動かす。
 * 「動きを減らす」設定の端末では何もしない。
 */

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** ボタン類に押し込み+波紋を付ける対象。カード型のリンクも含める。 */
const PRESSABLE = 'button, a[href], [role="button"], summary, label[for]'

function isDisabled(el: Element): boolean {
  return (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true'
}

/** 背景か枠線がある(=見た目がボタン・カード)要素だけ波紋を出す。素のテキストリンクには出さない。 */
function hasSurface(el: HTMLElement): boolean {
  const cs = getComputedStyle(el)
  const bg = cs.backgroundColor
  const transparentBg = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)'
  return !transparentBg || parseFloat(cs.borderTopWidth) > 0
}

/** 背景が暗いかどうか(波紋を白にするか紺にするか)。 */
function isDarkSurface(el: HTMLElement): boolean {
  const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g)
  if (!m || m.length < 3) return false
  const [r, g, b] = m.map(Number)
  const alpha = m.length >= 4 ? Number(m[3]) : 1
  if (alpha < 0.5) return false
  return 0.299 * r + 0.587 * g + 0.114 * b < 150
}

function spawnRipple(el: HTMLElement, x: number, y: number) {
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
  // 波紋の入れ物。要素自体に overflow:hidden を付けるとツールチップ等が切れるので、
  // 角丸を継いだ専用の入れ物の中だけで広げる。
  const holder = document.createElement('span')
  holder.setAttribute('aria-hidden', 'true')
  holder.style.cssText =
    'position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;z-index:0;'
  const size = Math.hypot(rect.width, rect.height) * 2
  const dot = document.createElement('span')
  dot.style.cssText = `position:absolute;left:${x - rect.left - size / 2}px;top:${
    y - rect.top - size / 2
  }px;width:${size}px;height:${size}px;border-radius:9999px;background:${
    isDarkSurface(el) ? 'rgba(255,255,255,0.35)' : 'rgba(18,58,112,0.14)'
  };`
  holder.appendChild(dot)
  el.appendChild(holder)
  const anim = dot.animate(
    [
      { transform: 'scale(0)', opacity: 1 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    { duration: 550, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  )
  anim.onfinish = () => holder.remove()
}

/**
 * ページ全体に「押し込み+離したときの弾み+波紋」を付ける。戻り値で解除する。
 * イベント委譲なので、後から描画されたボタンにも効く。
 */
export function installPressFeedback(): () => void {
  // 開発中のホットリロードでこのモジュールが差し替わっても、古い版のリスナーが
  // 残らないように、前回登録分を先に外す。
  const g = window as unknown as { __pressFeedbackCleanup?: () => void }
  g.__pressFeedbackCleanup?.()
  g.__pressFeedbackCleanup = undefined
  if (prefersReducedMotion()) return () => {}
  let pressed: HTMLElement | null = null
  let pressAnim: Animation | null = null

  const release = () => {
    const el = pressed
    pressed = null
    // 押し込み(fill: forwards)を残したままだと、弾みが終わったあと縮んだ状態に戻ってしまう。
    pressAnim?.cancel()
    pressAnim = null
    if (!el) return
    el.animate(
      [{ scale: '0.95' }, { scale: '1.03' }, { scale: '1' }],
      { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE)
    if (!el || isDisabled(el)) return
    if (hasSurface(el)) spawnRipple(el, e.clientX, e.clientY)
    // アコーディオンの見出し(aria-expanded)や data-no-press は縮めない。
    // カードの中の1行だけが縮むと、枠とずれて見えるため(波紋だけ出す)。
    if (el.hasAttribute('aria-expanded') || el.closest('[data-no-press]')) return
    // 大きな面(カード型リンク)は縮めすぎると酔うので控えめにする。
    const big = el.offsetWidth * el.offsetHeight > 40000
    pressed = el
    pressAnim?.cancel()
    pressAnim = el.animate([{ scale: '1' }, { scale: big ? '0.985' : '0.95' }], {
      duration: 110,
      easing: 'ease-out',
      fill: 'forwards',
    })
  }

  document.addEventListener('pointerdown', onDown, { passive: true })
  document.addEventListener('pointerup', release, { passive: true })
  document.addEventListener('pointercancel', release, { passive: true })
  const cleanup = () => {
    document.removeEventListener('pointerdown', onDown)
    document.removeEventListener('pointerup', release)
    document.removeEventListener('pointercancel', release)
    if (g.__pressFeedbackCleanup === cleanup) g.__pressFeedbackCleanup = undefined
  }
  g.__pressFeedbackCleanup = cleanup
  return cleanup
}

const BURST_COLORS = ['#e0a020', '#edbb4e', '#123a70', '#3d68a2', '#7196c3', '#14b8a6']

/**
 * 要素の中心から紙吹雪を散らす(セット開始・作成完了などの「やった感」用)。
 * 画面に固定配置した粒を作って、終わったら消す。
 */
export function burst(el: Element | null, count = 18) {
  if (!el || typeof document === 'undefined' || prefersReducedMotion()) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    const size = 5 + Math.random() * 5
    const round = Math.random() < 0.4
    p.setAttribute('aria-hidden', 'true')
    p.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${
      round ? size : size * 0.5
    }px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:${round ? '9999px' : '2px'};background:${
      BURST_COLORS[i % BURST_COLORS.length]
    };pointer-events:none;z-index:60;`
    document.body.appendChild(p)
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6
    const dist = 40 + Math.random() * 60
    const dx = Math.cos(angle) * dist
    const dy = Math.sin(angle) * dist - 20
    const rot = (Math.random() - 0.5) * 720
    const anim = p.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx * 1.15}px, ${dy + 70}px) rotate(${rot}deg) scale(0.6)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
    )
    anim.onfinish = () => p.remove()
  }
}
