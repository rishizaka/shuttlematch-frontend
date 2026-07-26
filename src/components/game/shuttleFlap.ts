/**
 * シャトルフラップ — タップでシャトルを浮かせて、ネットのすき間をくぐり抜ける1ボタンゲーム。
 *
 * 試合の待ち時間に片手・数十秒で遊べることを最優先にした設計:
 * - 入力はタップ(ポインタ)とスペース/↑キーのみ
 * - ゲームオーバー後は即リトライできる(結果画面の表示は React 側のオーバーレイ)
 * - 描画はすべて canvas。React の再レンダリングはスコア更新等のコールバック経由のみ
 *
 * 10点ごとにレベルアップ: ステージテーマ(背景・ネットの配色)がクロスフェードで切り替わり、
 * スピードが一段速く・すき間が一段狭くなる。レベル4からはネットが上下に揺れ始める。
 *
 * 座標系は論理幅 360 固定で、高さはキャンバスのアスペクト比から導出する。
 * デバイスピクセル比は setTransform で吸収する。
 */

export type GamePhase = 'ready' | 'playing' | 'over'

export interface ShuttleFlapCallbacks {
  onPhaseChange?: (phase: GamePhase) => void
  onScore?: (score: number) => void
  onGameOver?: (score: number) => void
}

export interface ShuttleFlapOptions {
  /** デバッグ用: このスコアから開始する(レベル・テーマ確認用。通常は 0)。 */
  startScore?: number
}

export interface ShuttleFlapHandle {
  /** 結果画面から「もう一回」。ready 状態に戻す。 */
  restart: () => void
  dispose: () => void
}

/** 10点ごとにレベルアップ(スコア0〜9がレベル1)。 */
export const levelOf = (score: number) => Math.floor(score / 10) + 1

const LW = 360 // 論理幅(固定)
const FLOOR_H = 54
const SHUTTLE_X = LW * 0.3
const SHUTTLE_R = 13 // 当たり判定の半径(見た目よりやや甘め)
const GRAVITY = 1500
const FLAP_VY = -430
const NET_W = 62
const NET_SPACING = 235
const BASE_SPEED = 150
const MAX_SPEED = 285
const GAP_START = 188
const GAP_MIN = 142

// ---- ステージテーマ(レベルごとに循環) ---------------------------------

type RGB = readonly [number, number, number]

interface Theme {
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

const THEMES: Theme[] = [
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

const themeForLevel = (level: number) => THEMES[(level - 1) % THEMES.length]

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]
const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`
const cssA = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const easeInOut = (t: number) => t * t * (3 - 2 * t)

interface Net {
  x: number
  baseGapY: number // すき間の上端(揺れの中心)
  gapY: number
  gapH: number
  amp: number // 上下の揺れ幅(レベル4未満は 0)
  phase: number
  passed: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 残り秒
  maxLife: number
  size: number
  rot: number
  vrot: number
  kind: 'puff' | 'feather'
}

export function createShuttleFlapGame(
  canvas: HTMLCanvasElement,
  cb: ShuttleFlapCallbacks = {},
  opts: ShuttleFlapOptions = {},
): ShuttleFlapHandle {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { restart: () => {}, dispose: () => {} }

  const startScore = Math.max(0, Math.floor(opts.startScore ?? 0))

  let LH = 560 // 論理高さ(リサイズで更新)
  let scale = 1
  let phase: GamePhase = 'ready'
  let score = 0
  let level = 1
  let shuttleY = 0
  let shuttleVy = 0
  let nets: Net[] = []
  let particles: Particle[] = []
  let scrollX = 0 // 背景・床のスクロール量
  let elapsed = 0 // 演出用の通算時間
  let diedAt = 0 // ゲームオーバー時刻(誤タップ抑止に使用)
  let levelUpAt = -10 // 「LEVEL N」バナー表示の起点
  let raf = 0
  let last = 0
  let disposed = false

  // テーマはクロスフェードで切り替える
  let themeFrom: Theme = themeForLevel(1)
  let themeTo: Theme = themeForLevel(1)
  let themeT = 1

  const resolveTheme = (): Theme => {
    if (themeT >= 1) return themeTo
    const t = easeInOut(themeT)
    return {
      name: themeTo.name,
      wallTop: mixRGB(themeFrom.wallTop, themeTo.wallTop, t),
      wallBottom: mixRGB(themeFrom.wallBottom, themeTo.wallBottom, t),
      window: mixRGB(themeFrom.window, themeTo.window, t),
      windowAlpha: themeFrom.windowAlpha + (themeTo.windowAlpha - themeFrom.windowAlpha) * t,
      floorTop: mixRGB(themeFrom.floorTop, themeTo.floorTop, t),
      floorBottom: mixRGB(themeFrom.floorBottom, themeTo.floorBottom, t),
      net: mixRGB(themeFrom.net, themeTo.net, t),
      netGrid: mixRGB(themeFrom.netGrid, themeTo.netGrid, t),
      netPole: mixRGB(themeFrom.netPole, themeTo.netPole, t),
    }
  }

  const transitionTheme = (lv: number) => {
    themeFrom = resolveTheme()
    themeTo = themeForLevel(lv)
    themeT = 0
  }

  const setPhase = (p: GamePhase) => {
    phase = p
    cb.onPhaseChange?.(p)
  }

  const resize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    scale = (w * dpr) / LW
    LH = h / (w / LW)
    shuttleY = Math.min(shuttleY, LH - FLOOR_H - SHUTTLE_R)
  }

  const toReady = () => {
    score = startScore
    level = levelOf(score)
    nets = []
    particles = []
    shuttleY = LH * 0.42
    shuttleVy = 0
    levelUpAt = -10
    transitionTheme(level)
    if (startScore > 0) cb.onScore?.(score)
    setPhase('ready')
  }

  // レベルが上がるごとに一段速く・狭く。レベル内でも1点ごとにわずかに加速する。
  // 序盤が優しすぎたため難易度は1レベル前倒し(レベル1が旧レベル2相当)。
  const speed = () => Math.min(BASE_SPEED + score * 1.2 + level * 14, MAX_SPEED)
  const gapH = () => Math.max(GAP_START - level * 11, GAP_MIN)
  // レベル3からネットが上下に揺れ始め、以降じわじわ大きくなる
  const oscAmp = () => (level >= 3 ? Math.min(10 + (level - 3) * 4, 26) : 0)

  const spawnNet = (x: number) => {
    const g = gapH()
    const amp = oscAmp()
    const margin = 46 + amp
    const baseGapY = margin + Math.random() * (LH - FLOOR_H - g - margin * 2)
    nets.push({
      x,
      baseGapY,
      gapY: baseGapY,
      gapH: g,
      amp,
      phase: Math.random() * Math.PI * 2,
      passed: false,
    })
  }

  const flapPuff = () => {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: SHUTTLE_X - 14,
        y: shuttleY + 6,
        vx: -60 - Math.random() * 50,
        vy: 30 + Math.random() * 50,
        life: 0.35,
        maxLife: 0.35,
        size: 3 + Math.random() * 3,
        rot: 0,
        vrot: 0,
        kind: 'puff',
      })
    }
  }

  const crashFeathers = () => {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 60 + Math.random() * 160
      particles.push({
        x: SHUTTLE_X,
        y: shuttleY,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 80,
        life: 0.9,
        maxLife: 0.9,
        size: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 10,
        kind: 'feather',
      })
    }
  }

  const die = () => {
    diedAt = elapsed
    crashFeathers()
    setPhase('over')
    cb.onGameOver?.(score)
  }

  const act = () => {
    if (phase === 'ready') {
      setPhase('playing')
      shuttleVy = FLAP_VY
      flapPuff()
      return
    }
    if (phase === 'playing') {
      shuttleVy = FLAP_VY
      flapPuff()
      return
    }
    // over: 結果を見せる前に誤タップで流れないよう少し待ってから受け付ける
    if (elapsed - diedAt > 0.7) toReady()
  }

  // ---- update ----------------------------------------------------------

  const update = (dt: number) => {
    elapsed += dt
    themeT = Math.min(themeT + dt / 0.9, 1)

    if (phase === 'playing') {
      scrollX += speed() * dt

      shuttleVy += GRAVITY * dt
      shuttleY += shuttleVy * dt
      // 天井はミスにせず、張り付きだけ防ぐ
      if (shuttleY < SHUTTLE_R) {
        shuttleY = SHUTTLE_R
        shuttleVy = Math.max(shuttleVy, 0)
      }

      // ネットの生成・移動・揺れ・通過判定
      if (nets.length === 0) spawnNet(LW + 80)
      const lastNet = nets[nets.length - 1]
      if (lastNet.x < LW - NET_SPACING) spawnNet(lastNet.x + NET_SPACING)
      for (const n of nets) {
        n.x -= speed() * dt
        if (n.amp > 0) n.gapY = n.baseGapY + Math.sin(elapsed * 1.9 + n.phase) * n.amp
        if (!n.passed && n.x + NET_W < SHUTTLE_X - SHUTTLE_R) {
          n.passed = true
          score += 1
          cb.onScore?.(score)
          const lv = levelOf(score)
          if (lv !== level) {
            level = lv
            levelUpAt = elapsed
            transitionTheme(lv)
          }
        }
      }
      nets = nets.filter((n) => n.x + NET_W > -20)

      // 当たり判定(円 vs 矩形)
      const floorY = LH - FLOOR_H
      if (shuttleY + SHUTTLE_R >= floorY) {
        shuttleY = floorY - SHUTTLE_R
        die()
      } else {
        for (const n of nets) {
          if (SHUTTLE_X + SHUTTLE_R < n.x || SHUTTLE_X - SHUTTLE_R > n.x + NET_W) continue
          if (shuttleY - SHUTTLE_R < n.gapY || shuttleY + SHUTTLE_R > n.gapY + n.gapH) {
            die()
            break
          }
        }
      }
    } else if (phase === 'over') {
      // 倒れたシャトルが床まで落ちる演出
      const floorY = LH - FLOOR_H
      if (shuttleY + SHUTTLE_R < floorY) {
        shuttleVy += GRAVITY * dt
        shuttleY = Math.min(shuttleY + shuttleVy * dt, floorY - SHUTTLE_R)
      }
    } else {
      // ready: ふわふわ待機
      shuttleY = LH * 0.42 + Math.sin(elapsed * 2.4) * 7
    }

    for (const p of particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.kind === 'feather' ? 500 : 120) * dt
      p.rot += p.vrot * dt
    }
    particles = particles.filter((p) => p.life > 0)
  }

  // ---- draw ------------------------------------------------------------

  const drawBackground = (th: Theme) => {
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

  const drawNetColumn = (
    th: Theme,
    x: number,
    top: number,
    bottom: number,
    tapeAt: 'top' | 'bottom',
  ) => {
    const h = bottom - top
    if (h <= 0) return
    // ネット本体(メッシュ)
    ctx.fillStyle = css(th.net)
    ctx.fillRect(x, top, NET_W, h)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, top, NET_W, h)
    ctx.clip()
    ctx.strokeStyle = cssA(th.netGrid, 0.45)
    ctx.lineWidth = 1
    for (let gx = x + 4; gx < x + NET_W; gx += 9) {
      ctx.beginPath()
      ctx.moveTo(gx, top)
      ctx.lineTo(gx, bottom)
      ctx.stroke()
    }
    for (let gy = top + ((-top % 9) + 9) % 9; gy < bottom; gy += 9) {
      ctx.beginPath()
      ctx.moveTo(x, gy)
      ctx.lineTo(x + NET_W, gy)
      ctx.stroke()
    }
    ctx.restore()

    // 支柱(左右)
    ctx.fillStyle = css(th.netPole)
    ctx.fillRect(x, top, 5, h)
    ctx.fillRect(x + NET_W - 5, top, 5, h)

    // すき間側の白帯(バドミントンネットの上端テープ)
    ctx.fillStyle = '#ffffff'
    const tapeH = 10
    ctx.fillRect(x - 2, tapeAt === 'bottom' ? bottom - tapeH : top, NET_W + 4, tapeH)
    ctx.fillStyle = 'rgba(0,20,51,0.18)'
    ctx.fillRect(x - 2, tapeAt === 'bottom' ? bottom - 2 : top + tapeH - 2, NET_W + 4, 2)
  }

  const drawNets = (th: Theme) => {
    const floorY = LH - FLOOR_H
    for (const n of nets) {
      drawNetColumn(th, n.x, 0, n.gapY, 'bottom')
      drawNetColumn(th, n.x, n.gapY + n.gapH, floorY + 4, 'top')
    }
  }

  const drawShuttle = () => {
    const angle =
      phase === 'playing' || phase === 'over'
        ? Math.max(-0.45, Math.min(Math.atan2(shuttleVy, 320), 1.35))
        : Math.sin(elapsed * 2.4) * 0.08
    ctx.save()
    ctx.translate(SHUTTLE_X, shuttleY)
    ctx.rotate(angle)

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

    ctx.restore()
  }

  const drawParticles = () => {
    for (const p of particles) {
      const a = Math.max(p.life / p.maxLife, 0)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.kind === 'puff') {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * a})`
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`
        ctx.strokeStyle = `rgba(174,188,207,${a})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  const drawHud = () => {
    ctx.textAlign = 'center'
    if (phase === 'playing' || phase === 'over') {
      ctx.font = '800 46px system-ui, sans-serif'
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(0,20,51,0.55)'
      ctx.fillStyle = '#ffffff'
      ctx.strokeText(String(score), LW / 2, 78)
      ctx.fillText(String(score), LW / 2, 78)
      if (level >= 2) {
        ctx.font = '800 15px system-ui, sans-serif'
        ctx.lineWidth = 4
        ctx.strokeText(`LV.${level}`, LW / 2, 100)
        ctx.fillText(`LV.${level}`, LW / 2, 100)
      }

      // レベルアップバナー
      const sinceLv = elapsed - levelUpAt
      if (sinceLv >= 0 && sinceLv < 1.4) {
        const p = sinceLv / 1.4
        const pop = 1 + 0.35 * Math.exp(-6 * p)
        ctx.save()
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
        const sub = level >= 3 ? `${themeForLevel(level).name} — ネットが揺れる!` : themeForLevel(level).name
        ctx.strokeText(sub, 0, 24)
        ctx.fillText(sub, 0, 24)
        ctx.restore()
      }
    } else {
      // ready 画面
      const bounce = Math.sin(elapsed * 3.2) * 4
      ctx.fillStyle = '#0b2c58'
      ctx.font = '800 24px system-ui, sans-serif'
      ctx.fillText('タップでスタート', LW / 2, LH * 0.24 + bounce)
      ctx.font = '500 13px system-ui, sans-serif'
      ctx.fillStyle = '#3d68a2'
      ctx.fillText('タップで浮く・ネットのすき間をくぐろう', LW / 2, LH * 0.24 + 26 + bounce)
      ctx.font = '500 12px system-ui, sans-serif'
      ctx.fillText('10点ごとにレベルアップ!', LW / 2, LH * 0.24 + 46 + bounce)
    }
  }

  const draw = () => {
    const th = resolveTheme()
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawBackground(th)
    drawNets(th)
    drawParticles()
    drawShuttle()
    drawHud()
  }

  // ---- loop / events ---------------------------------------------------

  const loop = (now: number) => {
    if (disposed) return
    const dt = Math.min((now - last) / 1000, 0.032)
    last = now
    update(dt)
    draw()
    raf = requestAnimationFrame(loop)
  }

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    act()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault()
      act()
    }
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)
  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('keydown', onKeyDown)

  resize()
  toReady()
  themeT = 1 // 初期表示はフェードなしで即テーマ適用
  last = performance.now()
  raf = requestAnimationFrame(loop)

  return {
    restart: () => {
      if (phase === 'over') toReady()
    },
    dispose: () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
