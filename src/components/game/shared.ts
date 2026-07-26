/**
 * ミニゲーム共通モジュール。
 * ステージテーマ(レベルごとの配色)・体育館背景・シャトルのスプライト・
 * レベルアップバナーなど、複数のゲームで使い回す描画とインタフェースを置く。
 */

export type GamePhase = 'ready' | 'playing' | 'over'

export interface MiniGameCallbacks {
  onPhaseChange?: (phase: GamePhase) => void
  onScore?: (score: number) => void
  onGameOver?: (score: number) => void
}

export interface MiniGameOptions {
  /** デバッグ用: このスコアから開始する(レベル・テーマ確認用。通常は 0)。 */
  startScore?: number
}

export interface MiniGameHandle {
  /** 結果画面から「もう一回」。ready 状態に戻す。 */
  restart: () => void
  dispose: () => void
}

// ---- ステージテーマ(レベルごとに循環) ---------------------------------

export type RGB = readonly [number, number, number]

export interface Theme {
  name: string
  wallTop: RGB
  wallBottom: RGB
  window: RGB
  windowAlpha: number
  floorTop: RGB
  floorBottom: RGB
  net: RGB
  netGrid: RGB
  netPole: RGB
}

export const THEMES: Theme[] = [
  {
    name: '昼の体育館',
    wallTop: [234, 243, 249],
    wallBottom: [211, 228, 239],
    window: [255, 255, 255],
    windowAlpha: 0.55,
    floorTop: [227, 183, 110],
    floorBottom: [201, 152, 80],
    net: [29, 70, 133],
    netGrid: [169, 192, 221],
    netPole: [11, 44, 88],
  },
  {
    name: '夕焼け',
    wallTop: [255, 227, 194],
    wallBottom: [255, 158, 122],
    window: [255, 247, 230],
    windowAlpha: 0.6,
    floorTop: [207, 147, 80],
    floorBottom: [168, 112, 58],
    net: [138, 47, 79],
    netGrid: [232, 169, 187],
    netPole: [87, 29, 51],
  },
  {
    name: 'ナイター',
    wallTop: [22, 33, 62],
    wallBottom: [11, 19, 48],
    window: [255, 217, 122],
    windowAlpha: 0.5,
    floorTop: [122, 90, 51],
    floorBottom: [90, 63, 34],
    net: [20, 125, 138],
    netGrid: [159, 219, 224],
    netPole: [10, 61, 68],
  },
  {
    name: 'ネオン',
    wallTop: [42, 15, 69],
    wallBottom: [18, 7, 31],
    window: [255, 122, 217],
    windowAlpha: 0.4,
    floorTop: [74, 47, 107],
    floorBottom: [51, 32, 74],
    net: [192, 38, 211],
    netGrid: [240, 171, 252],
    netPole: [112, 26, 117],
  },
  {
    name: '夜明け',
    wallTop: [207, 232, 255],
    wallBottom: [255, 217, 232],
    window: [255, 255, 255],
    windowAlpha: 0.5,
    floorTop: [227, 183, 110],
    floorBottom: [201, 152, 80],
    net: [61, 104, 162],
    netGrid: [169, 192, 221],
    netPole: [11, 44, 88],
  },
]

export const themeForLevel = (level: number) => THEMES[(level - 1) % THEMES.length]

export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]
export const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`
export const cssA = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
export const easeInOut = (t: number) => t * t * (3 - 2 * t)

export const mixTheme = (a: Theme, b: Theme, t: number): Theme => ({
  name: b.name,
  wallTop: mixRGB(a.wallTop, b.wallTop, t),
  wallBottom: mixRGB(a.wallBottom, b.wallBottom, t),
  window: mixRGB(a.window, b.window, t),
  windowAlpha: a.windowAlpha + (b.windowAlpha - a.windowAlpha) * t,
  floorTop: mixRGB(a.floorTop, b.floorTop, t),
  floorBottom: mixRGB(a.floorBottom, b.floorBottom, t),
  net: mixRGB(a.net, b.net, t),
  netGrid: mixRGB(a.netGrid, b.netGrid, t),
  netPole: mixRGB(a.netPole, b.netPole, t),
})

/**
 * テーマのクロスフェード管理。set() で目標テーマへ約0.9秒かけて遷移する。
 */
export function createThemeMixer(initialLevel: number) {
  let from = themeForLevel(initialLevel)
  let to = from
  let t = 1
  return {
    set(level: number, instant = false) {
      from = this.current()
      to = themeForLevel(level)
      t = instant ? 1 : 0
    },
    update(dt: number) {
      t = Math.min(t + dt / 0.9, 1)
    },
    current(): Theme {
      return t >= 1 ? to : mixTheme(from, to, easeInOut(t))
    },
  }
}

// ---- 共通描画 ----------------------------------------------------------

/** 体育館の背景(壁・高窓・腰板・床)。scrollX で窓と床板がスクロールする。 */
export function drawGymBackground(
  ctx: CanvasRenderingContext2D,
  th: Theme,
  LW: number,
  LH: number,
  FLOOR_H: number,
  scrollX: number,
) {
  // 体育館の壁
  const wall = ctx.createLinearGradient(0, 0, 0, LH)
  wall.addColorStop(0, css(th.wallTop))
  wall.addColorStop(1, css(th.wallBottom))
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, LW, LH)

  // 高窓(ゆっくりパララックス)。夜のテーマでは灯りに見える
  ctx.fillStyle = cssA(th.window, th.windowAlpha)
  const winW = 74
  const period = 190
  const off = (scrollX * 0.25) % period
  for (let x = -off; x < LW + winW; x += period) {
    ctx.beginPath()
    ctx.roundRect(x, LH * 0.1, winW, 58, 6)
    ctx.fill()
  }

  // 壁の腰板ライン
  ctx.fillStyle = cssA(th.netPole, 0.12)
  ctx.fillRect(0, LH - FLOOR_H - 66, LW, 66)

  // 床(体育館の木目)
  const floorY = LH - FLOOR_H
  const floor = ctx.createLinearGradient(0, floorY, 0, LH)
  floor.addColorStop(0, css(th.floorTop))
  floor.addColorStop(1, css(th.floorBottom))
  ctx.fillStyle = floor
  ctx.fillRect(0, floorY, LW, FLOOR_H)

  // コートライン
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, floorY, LW, 4)

  // 床板の継ぎ目(スクロール)
  ctx.strokeStyle = 'rgba(30,20,8,0.25)'
  ctx.lineWidth = 1.5
  const seam = 92
  const seamOff = scrollX % seam
  for (let x = -seamOff; x < LW; x += seam) {
    ctx.beginPath()
    ctx.moveTo(x, floorY + 6)
    ctx.lineTo(x - 14, LH)
    ctx.stroke()
  }
}

/**
 * シャトルのスプライト。原点にコルクが右(+x)を向く姿勢で描く。
 * 呼び出し側で translate/rotate して向きを変える。全長約30px。
 */
export function drawShuttleSprite(ctx: CanvasRenderingContext2D) {
  // 羽根(スカート): コルクの後ろに広がる台形
  ctx.beginPath()
  ctx.moveTo(2, -4)
  ctx.lineTo(-20, -12)
  ctx.lineTo(-20, 12)
  ctx.lineTo(2, 4)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#c5cfdd'
  ctx.lineWidth = 1.5
  ctx.stroke()
  // 羽根の筋
  ctx.strokeStyle = '#d9e1eb'
  ctx.lineWidth = 1
  for (const dy of [-6, 0, 6]) {
    ctx.beginPath()
    ctx.moveTo(1, dy * 0.45)
    ctx.lineTo(-19, dy * 1.6)
    ctx.stroke()
  }
  // 後端の縁
  ctx.beginPath()
  ctx.moveTo(-20, -12)
  ctx.lineTo(-20, 12)
  ctx.strokeStyle = '#aebccf'
  ctx.lineWidth = 2
  ctx.stroke()

  // 赤帯 + コルク
  ctx.fillStyle = '#e05252'
  ctx.fillRect(2, -5.5, 4, 11)
  ctx.beginPath()
  ctx.arc(9, 0, 6.5, 0, Math.PI * 2)
  ctx.fillStyle = '#f5e3c8'
  ctx.fill()
  ctx.strokeStyle = '#d9bd91'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/** レベルアップ時の「LEVEL N」バナー。since はレベルアップからの経過秒。 */
export function drawLevelBanner(
  ctx: CanvasRenderingContext2D,
  LW: number,
  LH: number,
  level: number,
  since: number,
  sub: string,
) {
  if (since < 0 || since >= 1.4) return
  const p = since / 1.4
  const pop = 1 + 0.35 * Math.exp(-6 * p)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.globalAlpha = p < 0.75 ? 1 : (1 - p) / 0.25
  ctx.translate(LW / 2, LH * 0.32)
  ctx.scale(pop, pop)
  ctx.font = '800 36px system-ui, sans-serif'
  ctx.lineWidth = 7
  ctx.strokeStyle = 'rgba(0,20,51,0.6)'
  ctx.fillStyle = '#ffffff'
  ctx.strokeText(`LEVEL ${level}`, 0, 0)
  ctx.fillText(`LEVEL ${level}`, 0, 0)
  ctx.font = '700 14px system-ui, sans-serif'
  ctx.lineWidth = 4
  ctx.strokeText(sub, 0, 24)
  ctx.fillText(sub, 0, 24)
  ctx.restore()
}
