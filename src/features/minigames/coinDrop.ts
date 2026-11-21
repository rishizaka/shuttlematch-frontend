/**
 * 10円ゲーム — 駄菓子屋の名機リスペクト。10円玉がジグザグの棚を転がり落ちる。
 *
 * 棚には穴(ハズレ)が開いていて、落ちたらおしまい。タップの小ジャンプで飛び越えながら
 * いちばん下の「あたり」まで転がせば 10円ゲット(棚を1段降りるごとに+1円、ゴールで+5円)。
 * クリアするたびに盤面が組み変わり、転がりが速く・穴が増えていく。
 *
 * アレンジ要素:
 * - ステージテーマ(他のミニゲームと共通)は盤面ごとに切り替わる。1面目が昼で、
 *   1面クリア後(11円の面)から夕焼け → ナイター → …と進む
 * - 難易度は20円ごとにレベルアップ(1レベル前倒しのチューニング)
 * - 2面目(夕焼け)からは穴が左右にスライドし始める
 * - 10円玉は転がりに合わせて「10」の刻印が回転する
 *
 * 操作はタップ(またはスペース)でジャンプするだけの1ボタン。
 */
import { createThemeMixer, css, cssA, drawGymBackground, drawLevelBanner } from './shared'
import type { GamePhase, MiniGameCallbacks, MiniGameHandle, MiniGameOptions, Theme } from './shared'

/** 20円ごとにレベルアップ(0〜19円がレベル1)。 */
export const coinLevelOf = (score: number) => Math.floor(score / 20) + 1

const LW = 360 // 論理幅(固定)
const FLOOR_H = 54
const SHELF_COUNT = 6
const SHELF_T = 9 // 棚の厚み
const OPEN_W = 56 // 壁ぎわの降り口の幅
const TOP_Y = 110 // いちばん上の棚の位置
const COIN_R = 11
const GRAVITY = 1300
const HOP_VY = -330

interface Hole {
  base: number // 中心(基準)
  c: number // 中心(現在)
  w: number
  moving: boolean
  phase: number
}

interface Shelf {
  dir: 1 | -1 // 転がる向き(1=右へ)
  holes: Hole[]
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
}

export function createCoinDropGame(
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
  let shelves: Shelf[] = []
  let coinX = 0
  let coinY = 0
  let coinVy = 0
  let spin = 0 // 刻印の回転(転がり量)
  let grounded = false
  let shelfIdx = 0 // いま乗っている棚
  let maxDepth = 0 // 到達済みの最深段(加点判定)
  let doomed = false // 穴に落ちた(復帰不可)
  let clearingT = 0 // ゴール演出の残り秒
  let boardsCleared = 0
  let floats: FloatText[] = []
  let particles: Particle[] = []
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
  const shelfGap = () => (floorY() - TOP_Y) / SHELF_COUNT
  const shelfY = (i: number) => TOP_Y + shelfGap() * i
  const span = (s: Shelf): [number, number] => (s.dir === 1 ? [0, LW - OPEN_W] : [OPEN_W, LW])

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
  // 動体視力に自信のある層向けに、難易度は1レベル前倒し(レベル1=旧レベル2相当)。
  // テーマは通常どおり昼スタート。

  const rollSpeed = () => Math.min(130 + level * 16 + boardsCleared * 6, 250)
  const holeWidth = () => Math.min(34 + (level + 1) * 2, 50)
  const holesPerShelf = (i: number) => (i === 0 ? 1 : Math.min(2 + (level >= 3 ? 1 : 0), 3))
  // 穴のスライドは盤面(テーマ)に紐づける。1面目の昼は静止、2面目の夕焼けから動き出す。
  const holesMove = () => boardsCleared >= 1

  const buildShelf = (i: number): Shelf => {
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1
    const shelf: Shelf = { dir, holes: [] }
    const [s, e] = span(shelf)
    const w = holeWidth()
    const moveAmp = holesMove() ? 18 : 0
    // 入口側は反応時間ぶん空け、降り口の手前にも余白を残す
    const entryMargin = 54
    const exitMargin = 30
    const lo = (dir === 1 ? s + entryMargin : s + exitMargin) + w / 2 + moveAmp
    const hi = (dir === 1 ? e - exitMargin : e - entryMargin) - w / 2 - moveAmp
    if (hi <= lo) return shelf
    for (let n = holesPerShelf(i), tries = 0; shelf.holes.length < n && tries < 40; tries++) {
      const c = lo + Math.random() * (hi - lo)
      // 穴と穴の間には着地できる床を必ず残す(縁どうし 46px 以上)
      if (shelf.holes.every((h) => Math.abs(h.base - c) >= w + 46)) {
        shelf.holes.push({ base: c, c, w, moving: holesMove(), phase: Math.random() * Math.PI * 2 })
      }
    }
    return shelf
  }

  const spawnCoin = () => {
    coinX = shelves[0].dir === 1 ? 20 : LW - 20
    coinY = TOP_Y - 40
    coinVy = 0
    grounded = false
    doomed = false
    shelfIdx = -1
    maxDepth = 0
  }

  const newBoard = (instantTheme = false) => {
    shelves = Array.from({ length: SHELF_COUNT }, (_, i) => buildShelf(i))
    // ステージテーマは盤面ごとに進める。1面目が昼、1面クリア後(11円の面)から夕焼け。
    theme.set(boardsCleared + 1, instantTheme)
    spawnCoin()
  }

  const toReady = (instantTheme = false) => {
    score = startScore
    level = coinLevelOf(score)
    // デバッグ開始(?s=)でも見た目が合うよう、1面=10円として消化済みの面数を推定する
    boardsCleared = Math.floor(startScore / 10)
    floats = []
    particles = []
    clearingT = 0
    levelUpAt = -10
    newBoard(instantTheme)
    if (startScore > 0) cb.onScore?.(score)
    setPhase('ready')
  }

  const addScore = (n: number) => {
    score += n
    cb.onScore?.(score)
    const lv = coinLevelOf(score)
    if (lv !== level) {
      level = lv
      levelUpAt = elapsed
    }
  }

  const goldSparks = (x: number, y: number) => {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 50 + Math.random() * 150
      particles.push({
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

  const hop = () => {
    if (grounded && clearingT <= 0) {
      grounded = false
      coinVy = HOP_VY
    }
  }

  const act = () => {
    if (phase === 'ready') {
      setPhase('playing')
      return
    }
    if (phase === 'playing') {
      hop()
      return
    }
    if (elapsed - diedAt > 0.7) toReady()
  }

  // ---- update ----------------------------------------------------------

  const overHole = (s: Shelf, x: number) => s.holes.some((h) => Math.abs(x - h.c) < h.w / 2 - 3)

  const update = (dt: number) => {
    elapsed += dt
    theme.update(dt)

    // 穴のスライド(ready 中も動かして見せる)
    for (const s of shelves) {
      for (const h of s.holes) {
        if (h.moving) h.c = h.base + Math.sin(elapsed * 1.5 + h.phase) * 18
      }
    }

    if (phase === 'playing' || phase === 'over') {
      if (clearingT > 0) {
        // ゴール演出中。終わったら次の盤面へ
        clearingT -= dt
        if (clearingT <= 0) {
          boardsCleared += 1
          newBoard()
          // 夕焼け(2面目)に入る瞬間だけは、穴が動き出すことを一度だけ知らせる
          if (boardsCleared === 1) {
            floats.push({ x: LW / 2, y: LH / 2, text: '穴が動きだす!', life: 1.4 })
          }
        }
      } else if (phase === 'playing' || doomed) {
        // スポーン直後(どの棚にも触れていない間)はまっすぐ落とす
        const dir = shelfIdx >= 0 && shelfIdx < SHELF_COUNT ? shelves[shelfIdx].dir : 0

        if (grounded) {
          const s = shelves[shelfIdx]
          const [start, end] = span(s)
          coinX += s.dir * rollSpeed() * dt
          spin += (s.dir * rollSpeed() * dt) / COIN_R
          // 穴の上に来たら落ちる(ハズレ確定)
          if (overHole(s, coinX)) {
            grounded = false
            doomed = true
            coinVy = 0
          } else if (s.dir === 1 ? coinX > end + 2 : coinX < start - 2) {
            // 棚の端(降り口)から次の棚へ
            grounded = false
            coinVy = 0
          }
        } else {
          const prevY = coinY
          coinVy += GRAVITY * dt
          coinY += coinVy * dt
          if (!doomed) {
            coinX += dir * rollSpeed() * dt
            spin += (dir * rollSpeed() * dt) / COIN_R
            coinX = Math.min(Math.max(coinX, COIN_R + 1), LW - COIN_R - 1)

            if (coinVy > 0) {
              // 棚への着地判定(1フレームで面をまたいだ瞬間を見る)
              for (let i = Math.max(shelfIdx, 0); i < SHELF_COUNT; i++) {
                const ys = shelfY(i)
                if (prevY + COIN_R <= ys + 1 && coinY + COIN_R >= ys) {
                  const s = shelves[i]
                  const [start, end] = span(s)
                  if (coinX < start || coinX > end) continue
                  if (overHole(s, coinX)) {
                    doomed = true // 穴に着地 → そのまま突き抜ける
                    break
                  }
                  coinY = ys - COIN_R
                  coinVy = 0
                  grounded = true
                  shelfIdx = i
                  if (i > maxDepth) {
                    addScore(i - maxDepth)
                    maxDepth = i
                  }
                  break
                }
              }
              // いちばん下まで来たら「あたり」
              if (!grounded && !doomed && coinY + COIN_R >= floorY()) {
                coinY = floorY() - COIN_R
                addScore(SHELF_COUNT - 1 - maxDepth + 5) // 残段ぶん + ゴールボーナス(1盤面で計10円)
                floats.push({ x: coinX, y: floorY() - 40, text: 'チャリン! +10円', life: 1.1 })
                goldSparks(coinX, coinY)
                clearingT = 0.8
              }
            }
          }
          // 穴に落ちた10円玉は盤の裏へ消えていく
          if (doomed && coinY > LH + 30 && phase === 'playing') die()
        }
      }
    } else {
      // ready: 入口でスタンバイ(小さく弾む)
      coinY = TOP_Y - 40 + Math.abs(Math.sin(elapsed * 3)) * -6
    }

    for (const f of floats) {
      f.life -= dt
      f.y -= 36 * dt
    }
    floats = floats.filter((f) => f.life > 0)

    for (const p of particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 400 * dt
    }
    particles = particles.filter((p) => p.life > 0)
  }

  // ---- draw ------------------------------------------------------------

  const drawShelves = (th: Theme) => {
    for (let i = 0; i < SHELF_COUNT; i++) {
      const s = shelves[i]
      const [start, end] = span(s)
      const y = shelfY(i)

      // 穴で分割しながら棚板を描く
      const cuts = [...s.holes].sort((a, b) => a.c - b.c)
      let x = start
      const wood = ctx.createLinearGradient(0, y, 0, y + SHELF_T)
      wood.addColorStop(0, css(th.floorTop))
      wood.addColorStop(1, css(th.floorBottom))
      for (const h of cuts) {
        const hl = h.c - h.w / 2
        const hr = h.c + h.w / 2
        if (hl > x) {
          ctx.fillStyle = wood
          ctx.fillRect(x, y, hl - x, SHELF_T)
        }
        // ハズレ穴: 奥の暗がり + 赤い縁
        ctx.fillStyle = 'rgba(10,6,2,0.55)'
        ctx.fillRect(hl, y, h.w, SHELF_T)
        ctx.fillStyle = 'rgba(225,60,60,0.9)'
        ctx.fillRect(hl, y, 3, SHELF_T)
        ctx.fillRect(hr - 3, y, 3, SHELF_T)
        x = hr
      }
      if (x < end) {
        ctx.fillStyle = wood
        ctx.fillRect(x, y, end - x, SHELF_T)
      }
      // 棚板の上面ハイライト
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      let hx = start
      for (const h of cuts) {
        const hl = h.c - h.w / 2
        if (hl > hx) ctx.fillRect(hx, y, hl - hx, 2)
        hx = h.c + h.w / 2
      }
      if (hx < end) ctx.fillRect(hx, y, end - hx, 2)
    }

    // 左右の枠板
    ctx.fillStyle = cssA(th.netPole, 0.55)
    ctx.fillRect(0, TOP_Y - 56, 6, floorY() - TOP_Y + 56)
    ctx.fillRect(LW - 6, TOP_Y - 56, 6, floorY() - TOP_Y + 56)

    // ゴール(あたり)
    ctx.fillStyle = 'rgba(255,200,60,0.28)'
    ctx.fillRect(0, floorY() + 4, LW, 10)
    ctx.font = '800 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText('あ た り', LW / 2, floorY() + 30)
  }

  const drawCoin = () => {
    ctx.save()
    ctx.translate(coinX, coinY)
    if (doomed) ctx.globalAlpha = 0.55
    // 本体(青銅色)
    const g = ctx.createRadialGradient(-3, -4, 2, 0, 0, COIN_R + 1)
    g.addColorStop(0, '#e8bd7d')
    g.addColorStop(1, '#b9843e')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, COIN_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#8a5f28'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,240,210,0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, COIN_R - 2.5, 0, Math.PI * 2)
    ctx.stroke()
    // 「10」の刻印(転がりに合わせて回転)
    ctx.rotate(spin)
    ctx.fillStyle = '#7c5522'
    ctx.font = '800 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('10', 0, 4)
    ctx.restore()
  }

  const drawParticles = () => {
    for (const p of particles) {
      const a = Math.max(p.life / p.maxLife, 0)
      ctx.fillStyle = `rgba(255,205,90,${0.95 * a})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawFloats = () => {
    for (const f of floats) {
      ctx.save()
      ctx.globalAlpha = Math.min(f.life / 0.3, 1)
      ctx.font = '800 17px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(0,20,51,0.5)'
      ctx.fillStyle = '#ffd766'
      ctx.strokeText(f.text, f.x, f.y)
      ctx.fillText(f.text, f.x, f.y)
      ctx.restore()
    }
  }

  const drawHud = () => {
    ctx.textAlign = 'center'
    if (phase === 'playing' || phase === 'over') {
      ctx.font = '800 40px system-ui, sans-serif'
      ctx.lineWidth = 6
      ctx.strokeStyle = 'rgba(0,20,51,0.55)'
      ctx.fillStyle = '#ffffff'
      ctx.strokeText(`${score}円`, LW / 2, 70)
      ctx.fillText(`${score}円`, LW / 2, 70)
      if (level >= 2) {
        ctx.font = '800 15px system-ui, sans-serif'
        ctx.lineWidth = 4
        ctx.strokeText(`LV.${level}`, LW / 2, 92)
        ctx.fillText(`LV.${level}`, LW / 2, 92)
      }
      // テーマ名は盤面ごとに変わるのでバナーには出さず、難易度の変化だけを伝える
      // 穴のスライドは盤面側(夕焼け)で始まるので、レベルの告知はスピードと穴の数だけ
      const sub = level === 3 ? '穴が増える!' : 'スピードアップ!'
      drawLevelBanner(ctx, LW, LH, level, elapsed - levelUpAt, sub)
    } else {
      const bounce = Math.sin(elapsed * 3.2) * 4
      ctx.fillStyle = '#0b2c58'
      ctx.font = '800 24px system-ui, sans-serif'
      ctx.fillText('タップでスタート', LW / 2, 52 + bounce)
      ctx.font = '500 13px system-ui, sans-serif'
      ctx.fillStyle = '#3d68a2'
      ctx.fillText('タップでジャンプ・穴(ハズレ)を飛び越えろ', LW / 2, 76 + bounce)
      ctx.font = '500 12px system-ui, sans-serif'
      ctx.fillText('下まで転がせば10円ゲット・20円ごとにレベルアップ', LW / 2, 94 + bounce)
    }
  }

  const draw = () => {
    const th = theme.current()
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawGymBackground(ctx, th, LW, LH, FLOOR_H, 0)
    drawShelves(th)
    drawCoin()
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
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
