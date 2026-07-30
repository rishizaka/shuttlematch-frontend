/**
 * 10円はじき — 駄菓子屋のエレメカ(新幹線ゲーム系)リスペクト。
 *
 * 長押しでパワーをため(ゲージは往復するのでタイミング勝負)、離すと10円玉が
 * 右のレールを駆け上がり、盤面へ飛び出して釘に弾かれながら落ちていく。
 * 下のポケットは 10円 / 30円 / 50円(大当たり) / ハズレ。
 *
 * 持ち玉制: 4枚スタートで1発射=1枚消費。10円で+1枚、30円で+2枚、50円で+3枚
 * 戻ってくる。持ち玉が尽きたら終了(スコアは稼いだ合計円)。
 * チャージが弱すぎるとレールを登り切れず「もどり」(1枚損)。
 *
 * 50円ごとにレベルアップ: ステージテーマ(他ゲームと共通・昼スタート)が切り替わり、
 * ゲージが速く・当たりポケットが狭くなる。レベル2からはポケット列が左右にスライド。
 *
 * 難易度メモ: 初版は当たりポケットの合計幅が盤面の4割未満しかなく、レール登りの
 * 必要パワーも高めで「難しすぎる」というフィードバックがあった。当たり幅の比率
 * (winRatio)・ゲージ速度・レール重力を緩め、level が進むほど厳しくなる形はそのままに
 * level1 の初見体験を大きく易化してある。
 */
import {
  createThemeMixer,
  css,
  cssA,
  drawGymBackground,
  drawLevelBanner,
  themeForLevel,
} from './shared'
import type { GamePhase, MiniGameCallbacks, MiniGameHandle, MiniGameOptions, Theme } from './shared'

/** 50円ごとにレベルアップ(0〜49円がレベル1)。 */
export const flickLevelOf = (score: number) => Math.floor(score / 50) + 1

const LW = 360
const FLOOR_H = 54
const COIN_R = 9
const FRAME_W = 6 // 外枠の板厚
const CHANNEL_W = 26 // 右の発射レールの幅
const CHANNEL_X = LW - FRAME_W - CHANNEL_W // レールの内側の壁
const EXIT_Y = 76 // レールを登り切って盤面へ飛び出す高さ
const CHANNEL_GRAVITY = 340 // レール内の減速(以前は420。強すぎて軽いチャージが軒並み「もどり」になっていた)
const FIELD_GRAVITY = 980
const PEG_RESTITUTION = 0.5 // 釘に当たったときの跳ね返り(法線方向)
const STALL_AFTER = 2.6 // これ以上盤面に留まったら重力を強めて決着させる
const PEG_R = 4.5
const START_COINS = 4

type SlotType = 'hazure' | 's10' | 'm30' | 'b50'

interface Slot {
  type: SlotType
  w: number
}

interface Peg {
  x: number
  y: number
}

interface FloatText {
  x: number
  y: number
  text: string
  color: string
  life: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

const SLOT_YEN: Record<SlotType, number> = { hazure: 0, s10: 10, m30: 30, b50: 50 }
const SLOT_COINS: Record<SlotType, number> = { hazure: 0, s10: 1, m30: 2, b50: 3 }

export function createCoinFlickGame(
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
  let coinsLeft = START_COINS
  let charging = false
  let power = 0
  let powerDir = 1
  // 飛行中の10円玉(同時に1枚だけ)
  let coin: {
    x: number
    y: number
    vx: number
    vy: number
    inChannel: boolean
    spin: number
    fieldT: number // 盤面に出てからの経過秒(長すぎると重力を強めて決着させる)
    stallT: number // ほぼ静止している時間(挟まりの検出用)
  } | null = null
  let settled: { x: number; type: SlotType; t: number } | null = null
  let pegs: Peg[] = []
  let slots: Slot[] = []
  let slotOffset = 0
  let pendingDeathT = 0 // 持ち玉が尽きたあと、結果を見せるまでの間
  let floats: FloatText[] = []
  let sparks: Spark[] = []
  let elapsed = 0
  let diedAt = 0
  let levelUpAt = -10
  let raf = 0
  let last = 0
  let disposed = false

  const theme = createThemeMixer(1)

  const setPhase = (p: GamePhase) => {
    phase = p
    cb.onPhaseChange?.(p)
  }

  const floorY = () => LH - FLOOR_H
  const slotTopY = () => floorY() - 58
  const launcherY = () => floorY() - COIN_R

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

  // ---- 難易度 ----------------------------------------------------------
  // レベルが進むほどタイミングがシビアに・当たりが狭くなる方向は維持しつつ、
  // level1 の初見体験はしっかり甘めにしてある(以前は当たり合計が盤面の36%しかなかった)。

  const gaugeSpeed = () => 0.85 + (level - 1) * 0.15 // 往復ゲージの速さ(1往復/秒換算)
  const slotsSlide = () => (level >= 2 ? 26 + (level - 2) * 6 : 0)

  /** 当たりポケット(3つ合計)が盤面の全幅に占める割合。level1=52%、以降じわじわ絞って34%で下げ止まる。 */
  const winRatio = () => Math.max(0.52 - (level - 1) * 0.04, 0.34)

  const buildSlots = () => {
    const field = CHANNEL_X - FRAME_W // ポケット列の全幅
    const winTotal = field * winRatio()
    // 3つの当たりの相対比率(10円:50円:30円 ≒ 0.40:0.26:0.34)は固定し、
    // winRatio で全体のサイズだけを伸び縮みさせる。50円だけ常に一番狭い。
    const win: Slot[] = [
      { type: 's10', w: winTotal * 0.4 },
      { type: 'b50', w: winTotal * 0.26 },
      { type: 'm30', w: winTotal * 0.34 },
    ]
    // ハズレで区切る: [x, 10円, x, 50円, x, 30円, x]
    const rest = field - winTotal
    const hz = rest / 4
    slots = [
      { type: 'hazure', w: hz },
      win[0],
      { type: 'hazure', w: hz },
      win[1],
      { type: 'hazure', w: hz },
      win[2],
      { type: 'hazure', w: hz },
    ]
  }

  const buildPegs = () => {
    pegs = []
    const cols = 7
    const rows = 6
    // 壁ぎわの釘は、壁との間に10円玉1枚が余裕で通る隙間を必ず残す
    // (詰めすぎると玉が壁と釘に挟まって落ちてこなくなる)。
    const minX = FRAME_W + COIN_R * 2 + PEG_R + 4
    const maxX = CHANNEL_X - COIN_R * 2 - PEG_R - 4
    const x0 = minX + 6
    const x1 = maxX - 6
    const y0 = 140
    const y1 = slotTopY() - 46
    for (let r = 0; r < rows; r++) {
      const y = y0 + ((y1 - y0) * r) / (rows - 1)
      const stagger = r % 2 === 0 ? 0 : (x1 - x0) / (cols - 1) / 2
      for (let c = 0; c < cols; c++) {
        if (r % 2 === 1 && c === cols - 1) continue
        const x = x0 + ((x1 - x0) * c) / (cols - 1) + stagger
        pegs.push({
          x: Math.min(Math.max(x + (Math.random() - 0.5) * 10, minX), maxX),
          y: y + (Math.random() - 0.5) * 8,
        })
      }
    }
  }

  const toReady = (instantTheme = false) => {
    score = startScore
    level = flickLevelOf(score)
    coinsLeft = START_COINS
    coin = null
    settled = null
    charging = false
    power = 0
    powerDir = 1
    pendingDeathT = 0
    floats = []
    sparks = []
    levelUpAt = -10
    theme.set(level, instantTheme)
    buildSlots()
    buildPegs()
    if (startScore > 0) cb.onScore?.(score)
    setPhase('ready')
  }

  const addScore = (n: number) => {
    score += n
    cb.onScore?.(score)
    const lv = flickLevelOf(score)
    if (lv !== level) {
      level = lv
      levelUpAt = elapsed
      theme.set(lv)
      buildSlots()
      buildPegs()
    }
  }

  const goldSparks = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 50 + Math.random() * 160
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 70,
        life: 0.7,
        maxLife: 0.7,
        size: 2.5 + Math.random() * 3,
      })
    }
  }

  const die = () => {
    diedAt = elapsed
    setPhase('over')
    cb.onGameOver?.(score)
  }

  const launch = () => {
    if (coin || coinsLeft <= 0) return
    coinsLeft -= 1
    const v0 = 480 + power * 500
    coin = {
      x: CHANNEL_X + CHANNEL_W / 2,
      y: launcherY(),
      vx: 0,
      vy: -v0,
      inChannel: true,
      spin: 0,
      fieldT: 0,
      stallT: 0,
    }
  }

  // ポケットに入ったときの精算
  const resolvePocket = (x: number) => {
    if (!coin) return
    // ポケット列はスライドするので、判定時点のオフセットで見る
    let sx = FRAME_W + slotOffset
    let hit: SlotType = 'hazure'
    let center = x
    for (const s of slots) {
      if (x >= sx && x < sx + s.w) {
        hit = s.type
        center = sx + s.w / 2
        break
      }
      sx += s.w
    }
    settled = { x: center, type: hit, t: 0.9 }
    coin = null
    const yen = SLOT_YEN[hit]
    if (yen > 0) {
      coinsLeft += SLOT_COINS[hit]
      addScore(yen)
      floats.push({
        x: center,
        y: slotTopY() - 12,
        text: hit === 'b50' ? '大当たり! +50円' : `+${yen}円`,
        color: hit === 'b50' ? '#ffd766' : '#ffe9a8',
        life: 1,
      })
      goldSparks(center, slotTopY() + 10, hit === 'b50' ? 22 : 12)
    } else {
      floats.push({ x: center, y: slotTopY() - 12, text: 'ハズレ…', color: '#cbd5e1', life: 0.8 })
    }
    if (coinsLeft <= 0) pendingDeathT = 0.9
  }

  const pressDown = () => {
    if (phase === 'ready') {
      setPhase('playing')
      charging = true
      power = 0
      powerDir = 1
      return
    }
    if (phase === 'playing') {
      if (!coin && coinsLeft > 0 && pendingDeathT <= 0) {
        charging = true
        power = 0
        powerDir = 1
      }
      return
    }
    if (elapsed - diedAt > 0.7) toReady()
  }

  const pressUp = () => {
    if (phase === 'playing' && charging) {
      charging = false
      launch()
    }
  }

  // ---- update ----------------------------------------------------------

  const update = (dt: number) => {
    elapsed += dt
    theme.update(dt)

    // ポケット列のスライド(レベル2から)
    const slide = slotsSlide()
    slotOffset = slide > 0 ? Math.sin(elapsed * 0.8) * slide : 0

    if (charging) {
      power += powerDir * gaugeSpeed() * dt * 2
      if (power >= 1) {
        power = 1
        powerDir = -1
      } else if (power <= 0) {
        power = 0
        powerDir = 1
      }
    }

    if (pendingDeathT > 0) {
      pendingDeathT -= dt
      if (pendingDeathT <= 0 && phase === 'playing') die()
    }

    if (coin) {
      const c = coin
      if (c.inChannel) {
        c.vy += CHANNEL_GRAVITY * dt
        c.y += c.vy * dt
        c.spin += (c.vy * dt) / COIN_R
        if (c.y <= EXIT_Y && c.vy < 0) {
          // レールを登り切った。残った勢いで盤面へ飛び出す
          const vres = -c.vy
          c.inChannel = false
          c.vx = -Math.max(vres * 0.75, 150)
          c.vy = -vres * 0.12
          c.y = EXIT_Y
        } else if (c.vy > 0 && c.y >= launcherY()) {
          // 勢い不足で戻ってきた(もどり = 1枚損)
          floats.push({
            x: CHANNEL_X + CHANNEL_W / 2 - 30,
            y: launcherY() - 30,
            text: 'もどり…',
            color: '#cbd5e1',
            life: 0.8,
          })
          coin = null
          if (coinsLeft <= 0) pendingDeathT = 0.8
        }
      } else {
        // 釘の上で跳ね続けてテンポが落ちないよう、長引いたら重力を強めて決着させる
        c.fieldT += dt
        const g = FIELD_GRAVITY * (c.fieldT > STALL_AFTER ? 2 : 1)
        c.vy += g * dt
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.spin += (Math.abs(c.vx) + Math.abs(c.vy)) * dt * 0.06

        // 壁・天井
        if (c.x < FRAME_W + COIN_R) {
          c.x = FRAME_W + COIN_R
          c.vx = Math.abs(c.vx) * 0.55
        } else if (c.x > CHANNEL_X - COIN_R) {
          c.x = CHANNEL_X - COIN_R
          c.vx = -Math.abs(c.vx) * 0.55
        }
        if (c.y < 20 + COIN_R) {
          c.y = 20 + COIN_R
          c.vy = Math.abs(c.vy) * 0.5
        }

        // 釘との衝突(円 vs 円)
        for (const p of pegs) {
          const dx = c.x - p.x
          const dy = c.y - p.y
          const rr = COIN_R + PEG_R
          const d2 = dx * dx + dy * dy
          if (d2 > 0.01 && d2 < rr * rr) {
            const d = Math.sqrt(d2)
            const nx = dx / d
            const ny = dy / d
            c.x = p.x + nx * rr
            c.y = p.y + ny * rr
            const vn = c.vx * nx + c.vy * ny
            if (vn < 0) {
              // 法線方向だけを跳ね返し、接線方向(横に流れる勢い)は残す。
              // 全体を一律に減衰させると釘の上でその場跳ねになり、玉が落ちてこない。
              const tx = c.vx - vn * nx
              const ty = c.vy - vn * ny
              c.vx = tx * 0.9 - vn * nx * PEG_RESTITUTION + (Math.random() - 0.5) * 30
              c.vy = ty * 0.9 - vn * ny * PEG_RESTITUTION
              sparks.push({
                x: p.x + nx * PEG_R,
                y: p.y + ny * PEG_R,
                vx: nx * 60,
                vy: ny * 60 - 30,
                life: 0.25,
                maxLife: 0.25,
                size: 2,
              })
            }
          }
        }

        // 保険: 釘と壁のあいだ等でほとんど動かなくなったら、盤の中央へ軽く押して詰まりを解く
        if (Math.abs(c.vx) < 14 && Math.abs(c.vy) < 34) {
          c.stallT += dt
          if (c.stallT > 0.3) {
            c.vx += (c.x < LW / 2 ? 1 : -1) * 110
            c.vy += 150
            c.stallT = 0
          }
        } else {
          c.stallT = 0
        }

        // ポケット到達
        if (c.y >= slotTopY() + 16) resolvePocket(c.x)
      }
    }

    if (settled) {
      settled.t -= dt
      if (settled.t <= 0) settled = null
    }

    for (const f of floats) {
      f.life -= dt
      f.y -= 34 * dt
    }
    floats = floats.filter((f) => f.life > 0)

    for (const s of sparks) {
      s.life -= dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 380 * dt
    }
    sparks = sparks.filter((s) => s.life > 0)
  }

  // ---- draw ------------------------------------------------------------

  const drawCoinSprite = (x: number, y: number, spin: number, alpha = 1) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.globalAlpha = alpha
    const g = ctx.createRadialGradient(-2.5, -3.5, 1.5, 0, 0, COIN_R + 1)
    g.addColorStop(0, '#e8bd7d')
    g.addColorStop(1, '#b9843e')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, COIN_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#8a5f28'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.rotate(spin)
    ctx.fillStyle = '#7c5522'
    ctx.font = '800 9px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('10', 0, 3.5)
    ctx.restore()
  }

  const drawMachine = (th: Theme) => {
    // 外枠とレール
    ctx.fillStyle = cssA(th.netPole, 0.6)
    ctx.fillRect(0, 14, FRAME_W, LH - 14)
    ctx.fillRect(LW - FRAME_W, 14, FRAME_W, LH - 14)
    ctx.fillRect(0, 14, LW, 6)
    ctx.fillStyle = cssA(th.netPole, 0.45)
    ctx.fillRect(CHANNEL_X, EXIT_Y + 26, 4, LH - EXIT_Y - 26)

    // 飛び出し口のガイド(右上のカーブ)
    ctx.strokeStyle = cssA(th.netPole, 0.55)
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(CHANNEL_X - 8, EXIT_Y + 26, CHANNEL_W + 10, -Math.PI / 2, 0)
    ctx.stroke()

    // 釘
    for (const p of pegs) {
      ctx.fillStyle = css(th.netPole)
      ctx.beginPath()
      ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc(p.x - 1.2, p.y - 1.2, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }

    // ポケット列(スライドあり)
    const top = slotTopY()
    let sx = FRAME_W + slotOffset
    ctx.font = '800 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const s of slots) {
      // 仕切り
      const wood = ctx.createLinearGradient(0, top, 0, floorY())
      wood.addColorStop(0, css(th.floorTop))
      wood.addColorStop(1, css(th.floorBottom))
      ctx.fillStyle = wood
      ctx.fillRect(sx - 2, top, 4, floorY() - top)
      // ラベルと底の色
      const cx = sx + s.w / 2
      if (s.type === 'hazure') {
        ctx.fillStyle = 'rgba(0,20,51,0.25)'
        ctx.fillRect(sx + 2, floorY() - 8, s.w - 4, 8)
      } else {
        const gold =
          s.type === 'b50' ? 'rgba(255,200,60,0.5)' : s.type === 'm30' ? 'rgba(255,200,60,0.34)' : 'rgba(255,200,60,0.22)'
        ctx.fillStyle = gold
        ctx.fillRect(sx + 2, top + 6, s.w - 4, floorY() - top - 6)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(s.type === 'b50' ? '50円' : s.type === 'm30' ? '30円' : '10円', cx, top + 24)
      }
      sx += s.w
    }
    ctx.fillStyle = 'rgba(0,20,51,0.35)'
    ctx.font = '700 9px system-ui, sans-serif'
    let sx2 = FRAME_W + slotOffset
    for (const s of slots) {
      if (s.type === 'hazure' && s.w > 26) {
        ctx.fillText('ハズレ', sx2 + s.w / 2, top + 22)
      }
      sx2 += s.w
    }
    // 最後の仕切り
    ctx.fillStyle = cssA(th.netPole, 0.5)
    ctx.fillRect(FRAME_W + slotOffset + slots.reduce((a, s) => a + s.w, 0) - 2, top, 4, floorY() - top)
  }

  const drawLauncher = () => {
    // レール下部の待機コイン + パワーゲージ
    const gx = CHANNEL_X + 5
    const gy0 = launcherY() - 26
    const gh = 130
    ctx.fillStyle = 'rgba(0,20,51,0.25)'
    ctx.beginPath()
    ctx.roundRect(gx, gy0 - gh, CHANNEL_W - 10, gh, 4)
    ctx.fill()
    if (charging) {
      const h = gh * power
      const grad = ctx.createLinearGradient(0, gy0, 0, gy0 - gh)
      grad.addColorStop(0, '#4ade80')
      grad.addColorStop(0.55, '#facc15')
      grad.addColorStop(1, '#ef4444')
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(gx, gy0 - gh, CHANNEL_W - 10, gh, 4)
      ctx.clip()
      ctx.fillStyle = grad
      ctx.fillRect(gx, gy0 - h, CHANNEL_W - 10, h)
      ctx.restore()
    }
    // 待機中の10円玉(チャージ中は震える)
    if (!coin && coinsLeft > 0 && phase !== 'over') {
      const shake = charging ? (Math.random() - 0.5) * power * 4 : 0
      drawCoinSprite(CHANNEL_X + CHANNEL_W / 2 + shake, launcherY(), 0)
    }
  }

  const drawHud = () => {
    ctx.textAlign = 'center'
    if (phase === 'playing' || phase === 'over') {
      ctx.font = '800 40px system-ui, sans-serif'
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(0,20,51,0.55)'
      ctx.fillStyle = '#ffffff'
      ctx.strokeText(`${score}円`, LW / 2, 62)
      ctx.fillText(`${score}円`, LW / 2, 62)
      if (level >= 2) {
        ctx.font = '800 14px system-ui, sans-serif'
        ctx.lineWidth = 4
        ctx.strokeText(`LV.${level}`, LW / 2, 84)
        ctx.fillText(`LV.${level}`, LW / 2, 84)
      }
      // 持ち玉
      const n = Math.min(coinsLeft, 6)
      for (let i = 0; i < n; i++) drawCoinSprite(24 + i * 15, 38, 0)
      if (coinsLeft > 6) {
        ctx.textAlign = 'left'
        ctx.font = '800 13px system-ui, sans-serif'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(0,20,51,0.55)'
        ctx.fillStyle = '#ffffff'
        ctx.strokeText(`×${coinsLeft}`, 24 + n * 15 + 2, 43)
        ctx.fillText(`×${coinsLeft}`, 24 + n * 15 + 2, 43)
        ctx.textAlign = 'center'
      }

      const sub =
        level >= 2 ? `${themeForLevel(level).name} — ポケットが動く!` : themeForLevel(level).name
      drawLevelBanner(ctx, LW, LH, level, elapsed - levelUpAt, sub)
    } else {
      const bounce = Math.sin(elapsed * 3.2) * 4
      const cy = LH * 0.3 + bounce
      // 釘の上に重なると読みにくいので、説明は白い板の上に載せる
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.roundRect(22, cy - 32, LW - 44, 92, 14)
      ctx.fill()
      ctx.fillStyle = '#0b2c58'
      ctx.font = '800 24px system-ui, sans-serif'
      ctx.fillText('長押しでチャージ', LW / 2, cy)
      ctx.font = '500 13px system-ui, sans-serif'
      ctx.fillStyle = '#3d68a2'
      ctx.fillText('離すと発射・強さはタイミングで決まる', LW / 2, cy + 26)
      ctx.font = '500 12px system-ui, sans-serif'
      ctx.fillText('持ち玉4枚スタート・当たりで増える・尽きたら終了', LW / 2, cy + 46)
    }
  }

  const draw = () => {
    const th = theme.current()
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawGymBackground(ctx, th, LW, LH, FLOOR_H, 0)
    drawMachine(th)
    drawLauncher()
    if (coin) drawCoinSprite(coin.x, coin.y, coin.spin)
    if (settled) drawCoinSprite(settled.x, floorY() - COIN_R, 0, Math.min(settled.t / 0.3, 1))
    for (const s of sparks) {
      const a = Math.max(s.life / s.maxLife, 0)
      ctx.fillStyle = `rgba(255,205,90,${0.95 * a})`
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const f of floats) {
      ctx.save()
      ctx.globalAlpha = Math.min(f.life / 0.3, 1)
      ctx.font = '800 16px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(0,20,51,0.5)'
      ctx.fillStyle = f.color
      ctx.strokeText(f.text, f.x, f.y)
      ctx.fillText(f.text, f.x, f.y)
      ctx.restore()
    }
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
    canvas.setPointerCapture(e.pointerId)
    pressDown()
  }
  const onPointerUp = (e: PointerEvent) => {
    e.preventDefault()
    pressUp()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault()
      pressDown()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault()
      pressUp()
    }
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)
  canvas.addEventListener('pointerdown', onPointerDown)
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
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    },
  }
}
