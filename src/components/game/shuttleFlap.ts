/**
 * シャトルフラップ — タップでシャトルを浮かせて、ネットのすき間をくぐり抜ける1ボタンゲーム。
 *
 * 試合の待ち時間に片手・数十秒で遊べることを最優先にした設計:
 * - 入力はタップ(ポインタ)とスペース/↑キーのみ
 * - ゲームオーバー後は即リトライできる(結果画面の表示は React 側のオーバーレイ)
 * - 描画はすべて canvas。React の再レンダリングはスコア更新等のコールバック経由のみ
 *
 * 10点ごとにレベルアップ: ステージテーマ(背景・ネットの配色)がクロスフェードで切り替わり、
 * スピードが一段速く・すき間が一段狭くなる。レベル2からはネットが上下に揺れ始める。
 *
 * 座標系は論理幅 360 固定で、高さはキャンバスのアスペクト比から導出する。
 * デバイスピクセル比は setTransform で吸収する。
 */
import {
  createThemeMixer,
  css,
  cssA,
  drawGymBackground,
  drawLevelBanner,
  drawShuttleSprite,
  themeForLevel,
} from './shared'
import type {
  GamePhase,
  MiniGameCallbacks,
  MiniGameHandle,
  MiniGameOptions,
  Theme,
} from './shared'

export type { GamePhase, MiniGameHandle as ShuttleFlapHandle }

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

interface Net {
  x: number
  baseGapY: number // すき間の上端(揺れの中心)
  gapY: number
  gapH: number
  amp: number // 上下の揺れ幅(レベル3未満は 0)
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
  cb: MiniGameCallbacks = {},
  opts: MiniGameOptions = {},
): MiniGameHandle {
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

  const theme = createThemeMixer(1)

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

  const toReady = (instantTheme = false) => {
    score = startScore
    level = levelOf(score)
    nets = []
    particles = []
    shuttleY = LH * 0.42
    shuttleVy = 0
    levelUpAt = -10
    theme.set(level, instantTheme)
    if (startScore > 0) cb.onScore?.(score)
    setPhase('ready')
  }

  // レベルが上がるごとに一段速く・狭く。レベル内でも1点ごとにわずかに加速する。
  // プレイヤーは動体視力に自信のある層なので、難易度は2レベル前倒し(レベル1=初期テーブルのレベル3相当)。
  const speed = () => Math.min(BASE_SPEED + score * 1.2 + (level + 1) * 14, MAX_SPEED)
  const gapH = () => Math.max(GAP_START - (level + 1) * 11, GAP_MIN)
  // レベル2からネットが上下に揺れ始め、以降じわじわ大きくなる
  const oscAmp = () => (level >= 2 ? Math.min(10 + (level - 2) * 4, 26) : 0)

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
    theme.update(dt)

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
            theme.set(lv)
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
    drawShuttleSprite(ctx)
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

      const sub =
        level >= 2 ? `${themeForLevel(level).name} — ネットが揺れる!` : themeForLevel(level).name
      drawLevelBanner(ctx, LW, LH, level, elapsed - levelUpAt, sub)
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
    const th = theme.current()
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawGymBackground(ctx, th, LW, LH, FLOOR_H, scrollX)
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
  toReady(true) // 初期表示はフェードなしで即テーマ適用
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
