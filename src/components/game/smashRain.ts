/**
 * スマッシュレイン — 降り注ぐシャトルを左右移動でよけ続けるサバイバルゲーム。
 *
 * 昔懐かしい「上から降ってくるものをよけるだけ」系をバドミントン仕様にアレンジ:
 * - シャトルは羽根の空気抵抗でふらふら揺れながら落ちてくる(まっすぐ落ちない)
 * - レベルが上がると、画面上部に「!」の予告が出たあと自分を狙う高速スマッシュが飛んでくる
 * - スポーツドリンクをキャッチすると +5 点
 * - 落ちたシャトルは床にコルクから刺さって立つ(当たり判定なし)
 *
 * 操作: ドラッグ(タッチ/マウス)で選手が指を追いかける。←→キーでも移動。
 * スコア: 生き残り1秒ごとに +1、ドリンクで +5。15点ごとにレベルアップして
 * ステージテーマ(シャトルフラップと共通)が切り替わり、物量と速度が増える。
 */
import {
  createThemeMixer,
  drawGymBackground,
  drawLevelBanner,
  drawShuttleSprite,
  themeForLevel,
} from './shared'
import type { GamePhase, MiniGameCallbacks, MiniGameHandle, MiniGameOptions } from './shared'

/** 15点ごとにレベルアップ(スコア0〜14がレベル1)。 */
export const rainLevelOf = (score: number) => Math.floor(score / 15) + 1

const LW = 360 // 論理幅(固定)
const FLOOR_H = 54
const PLAYER_MARGIN = 18 // 左右の移動限界

interface FallingShuttle {
  x: number
  y: number
  vy: number
  terminal: number
  swayPhase: number
  smash: boolean // 予告つき高速スマッシュ
  landed: boolean
  landT: number // 着地からの経過秒(刺さって立ち、やがて消える)
}

interface Warning {
  x: number
  t: number // 残り秒。0 でスマッシュ発射
}

interface Bottle {
  x: number
  y: number
  swayPhase: number
}

interface FloatText {
  x: number
  y: number
  text: string
  life: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  rot: number
  vrot: number
  kind: 'puff' | 'feather' | 'spark'
}

const WARN_TIME = 0.7
const LAND_KEEP = 1.4 // 刺さったシャトルが残る秒数

export function createSmashRainGame(
  canvas: HTMLCanvasElement,
  cb: MiniGameCallbacks = {},
  opts: MiniGameOptions = {},
): MiniGameHandle {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { restart: () => {}, dispose: () => {} }

  const startScore = Math.max(0, Math.floor(opts.startScore ?? 0))

  let LH = 560
  let scale = 1
  let phase: GamePhase = 'ready'
  let score = 0
  let level = 1
  let playerX = LW / 2
  let targetX = LW / 2
  let playerVx = 0 // 傾き・走りアニメ用
  let runDist = 0 // 足の振りの位相
  let overRot = 0 // ゲームオーバー時に転ぶ回転
  let shuttles: FallingShuttle[] = []
  let warnings: Warning[] = []
  let bottles: Bottle[] = []
  let floats: FloatText[] = []
  let particles: Particle[] = []
  let elapsed = 0
  let scoreT = 0 // 1秒ごとの加点タイマー
  let spawnT = 1.2
  let smashT = 5
  let bottleT = 6
  let diedAt = 0
  let levelUpAt = -10
  let keyDir = 0 // -1/0/1 (←→キー)
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
  }

  const toReady = (instantTheme = false) => {
    score = startScore
    level = rainLevelOf(score)
    shuttles = []
    warnings = []
    bottles = []
    floats = []
    particles = []
    playerX = LW / 2
    targetX = LW / 2
    playerVx = 0
    overRot = 0
    scoreT = 0
    spawnT = 1.2
    smashT = 5
    bottleT = 6
    levelUpAt = -10
    theme.set(level, instantTheme)
    if (startScore > 0) cb.onScore?.(score)
    setPhase('ready')
  }

  // ---- 難易度(レベルで物量・速度が増える) ------------------------------

  const spawnInterval = () => Math.max(0.95 - (level - 1) * 0.1, 0.4)
  const fallTerminal = () => Math.min(200 + (level - 1) * 28, 400)
  const smashInterval = () => Math.max(4.2 - (level - 1) * 0.45, 1.7)
  const smashSpeed = () => Math.min(520 + (level - 1) * 35, 760)

  const addScore = (n: number) => {
    score += n
    cb.onScore?.(score)
    const lv = rainLevelOf(score)
    if (lv !== level) {
      level = lv
      levelUpAt = elapsed
      theme.set(lv)
    }
  }

  const spawnShuttle = () => {
    shuttles.push({
      x: 24 + Math.random() * (LW - 48),
      y: -24,
      vy: 90 + Math.random() * 50,
      terminal: fallTerminal() * (0.85 + Math.random() * 0.3),
      swayPhase: Math.random() * Math.PI * 2,
      smash: false,
      landed: false,
      landT: 0,
    })
  }

  const fireWarning = () => {
    // 6割の確率でプレイヤーの近くを狙う(逃げ先を考えさせる)
    const x =
      Math.random() < 0.6
        ? Math.min(Math.max(playerX + (Math.random() - 0.5) * 90, 24), LW - 24)
        : 24 + Math.random() * (LW - 48)
    warnings.push({ x, t: WARN_TIME })
  }

  const crashFeathers = (x: number, y: number) => {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 60 + Math.random() * 170
      particles.push({
        x,
        y,
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

  const drinkSparks = (x: number, y: number) => {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 40 + Math.random() * 120
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60,
        life: 0.55,
        maxLife: 0.55,
        size: 2.5 + Math.random() * 2.5,
        rot: 0,
        vrot: 0,
        kind: 'spark',
      })
    }
  }

  const die = (hitX: number, hitY: number) => {
    diedAt = elapsed
    crashFeathers(hitX, hitY)
    setPhase('over')
    cb.onGameOver?.(score)
  }

  const act = () => {
    if (phase === 'ready') {
      setPhase('playing')
      return
    }
    if (phase === 'over' && elapsed - diedAt > 0.7) toReady()
  }

  // ---- update ----------------------------------------------------------

  const update = (dt: number) => {
    elapsed += dt
    theme.update(dt)
    const floorY = LH - FLOOR_H

    if (phase === 'playing') {
      // 生存加点(1秒 = 1点)
      scoreT += dt
      while (scoreT >= 1) {
        scoreT -= 1
        addScore(1)
      }

      // キー移動はターゲットをずらす(ドラッグと同じ経路に合流)
      if (keyDir !== 0) targetX = playerX + keyDir * 320 * dt * 4

      // プレイヤーは指を滑らかに追いかける
      targetX = Math.min(Math.max(targetX, PLAYER_MARGIN), LW - PLAYER_MARGIN)
      const prevX = playerX
      playerX += (targetX - playerX) * Math.min(dt * 14, 1)
      playerVx = (playerX - prevX) / Math.max(dt, 0.001)
      runDist += Math.abs(playerX - prevX)

      // 通常シャトルの供給
      spawnT -= dt
      if (spawnT <= 0) {
        spawnT = spawnInterval() * (0.8 + Math.random() * 0.4)
        spawnShuttle()
      }

      // スマッシュ(レベル2から)
      if (level >= 2) {
        smashT -= dt
        if (smashT <= 0) {
          smashT = smashInterval() * (0.8 + Math.random() * 0.4)
          fireWarning()
        }
      }
      for (const w of warnings) {
        w.t -= dt
        if (w.t <= 0) {
          shuttles.push({
            x: w.x,
            y: -24,
            vy: smashSpeed(),
            terminal: smashSpeed(),
            swayPhase: 0,
            smash: true,
            landed: false,
            landT: 0,
          })
        }
      }
      warnings = warnings.filter((w) => w.t > 0)

      // ドリンクの供給
      bottleT -= dt
      if (bottleT <= 0) {
        bottleT = 7 + Math.random() * 5
        bottles.push({ x: 30 + Math.random() * (LW - 60), swayPhase: Math.random() * 6, y: -20 })
      }
    }

    // シャトルの落下(over 中も演出として動かし続ける)
    for (const s of shuttles) {
      if (s.landed) {
        s.landT += dt
        continue
      }
      s.vy += (s.terminal - s.vy) * Math.min(dt * 2.5, 1)
      s.y += s.vy * dt
      if (!s.smash) s.x += Math.sin(elapsed * 2.6 + s.swayPhase) * 26 * dt
      if (s.y >= floorY - 8) {
        s.y = floorY - 8
        s.landed = true
      }
    }
    shuttles = shuttles.filter((s) => !s.landed || s.landT < LAND_KEEP)

    for (const b of bottles) b.y += 130 * dt
    bottles = bottles.filter((b) => b.y < LH + 30)

    // 当たり判定(プレイヤーの胴体と頭の2円)
    if (phase === 'playing') {
      const bodyX = playerX
      const bodyY = floorY - 20
      const headY = floorY - 38
      const hit = (cx: number, cy: number, r: number) => {
        const d1 = (cx - bodyX) ** 2 + (cy - bodyY) ** 2
        const d2 = (cx - bodyX) ** 2 + (cy - headY) ** 2
        return d1 < (r + 13) ** 2 || d2 < (r + 9) ** 2
      }
      for (const s of shuttles) {
        // コルク(下端)を判定点にする
        if (!s.landed && hit(s.x, s.y + 8, 7)) {
          die(s.x, s.y + 8)
          break
        }
      }
      if (phase === 'playing') {
        for (const b of bottles) {
          if (hit(b.x, b.y, 11)) {
            drinkSparks(b.x, b.y)
            floats.push({ x: b.x, y: b.y - 14, text: '+5', life: 0.9 })
            bottles = bottles.filter((x) => x !== b)
            addScore(5)
            break
          }
        }
      }
    } else if (phase === 'over') {
      // 転ぶ演出
      overRot = Math.min(overRot + dt * 4, Math.PI / 2)
    }

    for (const f of floats) {
      f.life -= dt
      f.y -= 40 * dt
    }
    floats = floats.filter((f) => f.life > 0)

    for (const p of particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.kind === 'feather' ? 500 : 220) * dt
      p.rot += p.vrot * dt
    }
    particles = particles.filter((p) => p.life > 0)
  }

  // ---- draw ------------------------------------------------------------

  const drawWarnings = () => {
    for (const w of warnings) {
      // 点滅する赤い「!」三角
      if (Math.floor(w.t * 10) % 2 === 0) continue
      ctx.save()
      ctx.translate(w.x, 26)
      ctx.fillStyle = 'rgba(225,60,60,0.95)'
      ctx.beginPath()
      ctx.moveTo(0, -14)
      ctx.lineTo(13, 10)
      ctx.lineTo(-13, 10)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 15px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('!', 0, 7)
      ctx.restore()
    }
  }

  const drawShuttles = () => {
    for (const s of shuttles) {
      ctx.save()
      ctx.translate(s.x, s.y)
      if (s.landed) {
        // コルクから床に刺さって立つ。最後はふっと消える
        const fade = Math.min(1, (LAND_KEEP - s.landT) / 0.3)
        ctx.globalAlpha = fade
        ctx.rotate(Math.PI / 2)
        drawShuttleSprite(ctx)
      } else {
        if (s.smash) {
          // 高速スマッシュの残像
          ctx.save()
          for (const [dy, a] of [
            [-26, 0.22],
            [-14, 0.4],
          ] as const) {
            ctx.save()
            ctx.globalAlpha = a
            ctx.translate(0, dy)
            ctx.rotate(Math.PI / 2)
            drawShuttleSprite(ctx)
            ctx.restore()
          }
          ctx.restore()
        }
        // コルクが下(進行方向)を向く。通常弾は揺れに合わせて少し傾く
        const tilt = s.smash ? 0 : Math.cos(elapsed * 2.6 + s.swayPhase) * 0.25
        ctx.rotate(Math.PI / 2 + tilt)
        drawShuttleSprite(ctx)
      }
      ctx.restore()
    }
  }

  const drawBottle = (b: Bottle) => {
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(Math.sin(elapsed * 3 + b.swayPhase) * 0.15)
    // ボトル本体
    ctx.fillStyle = '#38bdf8'
    ctx.beginPath()
    ctx.roundRect(-8, -11, 16, 24, 4)
    ctx.fill()
    // キャップ
    ctx.fillStyle = '#0369a1'
    ctx.beginPath()
    ctx.roundRect(-4, -16, 8, 6, 2)
    ctx.fill()
    // ラベル
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-8, -3, 16, 8)
    ctx.fillStyle = '#0369a1'
    ctx.font = '800 8px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('+5', 0, 4)
    ctx.restore()
  }

  const drawPlayer = () => {
    const floorY = LH - FLOOR_H
    const lean = Math.max(-0.22, Math.min(playerVx * 0.0011, 0.22))
    ctx.save()
    ctx.translate(playerX, floorY)
    if (phase === 'over') {
      // 後ろに転ぶ
      ctx.rotate(-overRot)
    } else {
      ctx.rotate(lean)
    }

    const moving = Math.abs(playerVx) > 25 && phase === 'playing'
    const legSwing = moving ? Math.sin(runDist * 0.25) * 6 : 0

    // 脚(白ソックス+シューズ)
    ctx.strokeStyle = '#f5d5b8'
    ctx.lineWidth = 4.5
    for (const side of [-1, 1] as const) {
      const dx = side * 5 + (side > 0 ? legSwing : -legSwing) * 0.6
      ctx.beginPath()
      ctx.moveTo(side * 4, -14)
      ctx.lineTo(dx, -2)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(dx - 4, -4, 9, 4, 2)
      ctx.fill()
    }

    // パンツ(紺)
    ctx.fillStyle = '#123a70'
    ctx.beginPath()
    ctx.roundRect(-8, -22, 16, 10, 3)
    ctx.fill()

    // シャツ(白+ブランドの差し色)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(-9, -38, 18, 18, 5)
    ctx.fill()
    ctx.fillStyle = '#1d4685'
    ctx.fillRect(-9, -26, 18, 4)

    // 腕 + ラケット(構えて持つ)
    ctx.strokeStyle = '#f5d5b8'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(7, -33)
    ctx.lineTo(15, -40)
    ctx.stroke()
    ctx.save()
    ctx.translate(15, -40)
    ctx.rotate(-0.5)
    ctx.strokeStyle = '#123a70'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -12)
    ctx.stroke()
    ctx.strokeStyle = '#8291a9'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(0, -19, 7, 8.5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(130,145,169,0.5)'
    ctx.lineWidth = 0.7
    for (const gx of [-3.5, 0, 3.5]) {
      ctx.beginPath()
      ctx.moveTo(gx, -27)
      ctx.lineTo(gx, -11)
      ctx.stroke()
    }
    ctx.restore()

    // 頭 + 髪 + 目
    ctx.fillStyle = '#f5d5b8'
    ctx.beginPath()
    ctx.arc(0, -46, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3d2f23'
    ctx.beginPath()
    ctx.arc(0, -48, 9, Math.PI * 1.05, Math.PI * 1.95)
    ctx.fill()
    ctx.fillStyle = '#1a2333'
    const eyeDir = phase === 'over' ? 0 : Math.max(-1, Math.min(playerVx / 200, 1))
    ctx.beginPath()
    ctx.arc(-3 + eyeDir * 1.5, -45, 1.3, 0, Math.PI * 2)
    ctx.arc(3 + eyeDir * 1.5, -45, 1.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const drawParticles = () => {
    for (const p of particles) {
      const a = Math.max(p.life / p.maxLife, 0)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.kind === 'spark') {
        ctx.fillStyle = `rgba(125,211,252,${0.9 * a})`
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.kind === 'puff') {
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

  const drawFloats = () => {
    for (const f of floats) {
      ctx.save()
      ctx.globalAlpha = Math.min(f.life / 0.3, 1)
      ctx.font = '800 18px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(0,20,51,0.5)'
      ctx.fillStyle = '#7dd3fc'
      ctx.strokeText(f.text, f.x, f.y)
      ctx.fillText(f.text, f.x, f.y)
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
        level === 2
          ? `${themeForLevel(level).name} — スマッシュが来る!`
          : themeForLevel(level).name
      drawLevelBanner(ctx, LW, LH, level, elapsed - levelUpAt, sub)
    } else {
      const bounce = Math.sin(elapsed * 3.2) * 4
      ctx.fillStyle = '#0b2c58'
      ctx.font = '800 24px system-ui, sans-serif'
      ctx.fillText('タップでスタート', LW / 2, LH * 0.24 + bounce)
      ctx.font = '500 13px system-ui, sans-serif'
      ctx.fillStyle = '#3d68a2'
      ctx.fillText('ドラッグで移動・降ってくるシャトルをよけろ', LW / 2, LH * 0.24 + 26 + bounce)
      ctx.font = '500 12px system-ui, sans-serif'
      ctx.fillText('生き残り1秒で1点・ドリンクは +5 点', LW / 2, LH * 0.24 + 46 + bounce)
    }
  }

  const draw = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawGymBackground(ctx, theme.current(), LW, LH, FLOOR_H, 0)
    drawWarnings()
    for (const b of bottles) drawBottle(b)
    drawShuttles()
    drawPlayer()
    drawParticles()
    drawFloats()
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

  const logicalX = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    return ((e.clientX - rect.left) / rect.width) * LW
  }

  let dragging = false
  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    dragging = true
    targetX = logicalX(e)
    canvas.setPointerCapture(e.pointerId)
    act()
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return
    targetX = logicalX(e)
  }
  const onPointerUp = () => {
    dragging = false
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft') {
      e.preventDefault()
      keyDir = -1
      if (phase !== 'playing') act()
    } else if (e.code === 'ArrowRight') {
      e.preventDefault()
      keyDir = 1
      if (phase !== 'playing') act()
    } else if (e.code === 'Space') {
      e.preventDefault()
      act()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' && keyDir === -1) keyDir = 0
    if (e.code === 'ArrowRight' && keyDir === 1) keyDir = 0
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  resize()
  toReady(true)
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
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    },
  }
}
