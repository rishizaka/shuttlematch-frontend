/**
 * シャトポコスキー — 3レーンのゲレンデを滑り降りるダウンヒル。
 *
 * 奥行き z を持たせた擬似3D(透視投影)で、奥から手前へ景色が流れてくる。
 * 曲がる操作はなく、横スワイプで3本のレーンを移り歩くだけ。
 *
 * - ラケットに当たるとスマッシュされて1段加速し、あわせて羽根5枚ぶんの倍率がつく
 * - お邪魔(岩・立木)に当たると転倒して**速度段が0に戻る**。速さは資産で、ぶつけると失う
 * - ジャンプ台に乗ると羽根がひらいてふわりと飛ぶ。滞空中は無敵で、空中の金の羽根を拾える
 * - **持ち時間は120秒**。転んでもそこで終わりではないが、失速と転倒中の減速で距離を損する
 *
 * スコア = 滑った距離(m) × 倍率。倍率は金の羽根1枚につき +0.01(1.00 から)。
 * 距離だけ伸ばしても羽根だけ拾っても伸びないので、**速く滑りながら拾う**のが最大になる。
 *
 * 残機制ではなく時間制にしてあるのは、全員の持ち時間が同じなら「120秒でどこまで行けたか」
 * の一本勝負になって比べやすいため。転倒は即終了ではなく、速度を失って距離を損する形の罰。
 *
 * 落下は上りより下りをゆっくりにしてある。シャトルの羽根は空気抵抗が極端に強く、
 * 上がるときは伸びて落ちるときに失速する — シャトポコが飛ぶならこうだろう、という形。
 */
import type { GamePhase, MiniGameCallbacks, MiniGameHandle, MiniGameOptions } from './shared'

const LW = 360 // 論理幅(固定)

// ---- 擬似3Dの投影 ------------------------------------------------------
// 距離 z[m] の点がどれだけ小さく見えるか。z=0(自分の足元)で 1、奥ほど 0 に近づく。
// CAM_D を小さくすると遠近が強調される(奥がすぼまる)。

/** カメラから投影面までの距離[m]。遠近の強さを決める。 */
export const CAM_D = 46
/** 描画する最も遠い距離[m]。これより奥は地平線の霞に溶ける。 */
export const Z_FAR = 210
/**
 * 雪面を描き始める手前の距離[m]。自機の足元(z=0)より手前まで延ばす。
 * ここを 0 にすると、足元から画面下端までの約16%が縞もレーン線もない真っ白な帯になる。
 */
const Z_NEAR = -14
/** 地平線の画面Y(高さ比)。 */
const HORIZON = 0.32
/** z=0 の雪面の画面Y(高さ比)。 */
const GROUND_Y = 0.84
/** z=0 における 1m のピクセル数。 */
const PX_PER_M = 30

/** 距離 z[m] の縮小率。 */
export function scaleAt(z: number): number {
  return CAM_D / (CAM_D + Math.max(z, -CAM_D * 0.9))
}

/** レーンの中心座標[m]。左・中央・右。 */
export const LANE_X = [-3, 0, 3] as const
/** コースの半幅[m]。この外側はゲレンデ外(木が生えている)。 */
const COURSE_HALF = 7.4

// ---- 速度・スコア ------------------------------------------------------

/**
 * 速度段0のときの基本速度[m/s]。
 *
 * 遊ぶのはバドミントンのプレー中で、動体視力に自信のある層。ふつうの横スクロールの
 * 初速だと退屈なので、最初から 137km/h 相当で滑り出す。滑走そのものの気持ちよさは
 * ここで決まるので、難易度は障害物の密度(rowGap)で調整し、速度は落とさない。
 */
const BASE_SPEED = 38
/** 速度段1つあたりの上乗せ[m/s]。最高速は 328km/h 相当。 */
const SPEED_PER_STEP = 3.8
/**
 * 速度段に上限はない。拾い続ければどこまでも速くなる。
 *
 * 天井を置かないのは、上限に張り付いた時点で「もっと速く」という動機が消えるため。
 * 代わりに rowGap の緩和を GAP_RELIEF_CAP 段で打ち止めにしてあるので、
 * 際限なく加速するといずれ人間の反応が追いつかなくなり、そこが実質の上限になる。
 * 上限なしにできるのは、転んでも元の速度まで早く戻れる(recoveryRate)ため。
 */
export const GAUGE_FULL_STEP = 16 // 速度ゲージが満タンになる段(表示上の目安。到達しても加速は続く)
/** 行間隔の緩和が効く上限。ここから先は、速くなるほど避けにくくなる一方になる。 */
export const GAP_RELIEF_CAP = 14
/** 無事故で滑り続けたとき、速度段が1つ上がるまでの秒数。 */
export const STEP_TIME = 5

/** この行でふさぐレーンを決める。**必ず1本は空ける**(3本ともふさがると避けようがない)。 */
export function blockedLanes(nObs: number, pick: (n: number) => number): number[] {
  const n = Math.min(Math.max(nObs, 0), 2)
  if (n <= 0) return []
  const pool = [0, 1, 2]
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(pool.splice(pick(pool.length), 1)[0])
  return out
}

/**
 * 転倒後の再加速の倍率。ぶつかる前の段に戻るまでは早い。
 *
 * 段に上限がないぶん、高速域で転ぶと失うものが大きい。一律の倍率だと、たとえば32段から
 * 落ちた場合に積み直すだけで60秒以上かかり、1回の事故でプレイが終わってしまう。
 * **失った段が大きいほど速く戻す**ことで、どこまで攻めても復帰の手間が頭打ちになる
 * (32段ぶん失っても約20秒で戻る)。元の段に届いたら通常のペースに帰る。
 */
export function recoveryRate(step: number, recoverTo: number): number {
  if (step >= recoverTo) return 1
  return 1 + Math.min(recoverTo - step, 30) * 0.5
}

/**
 * 速度段。転ばずに滑った秒数と、拾ったブーストの数から決まる。
 *
 * 自然加速を入れているのは、時間制では転倒しても終わらないぶん「速度段が0に戻る」だけでは
 * 罰にならないため。これがないと避けても避けなくても進む距離が変わらない
 * (実測で、放置と回避プレイの距離が 2,205m 対 2,208m とほとんど同じだった)。
 * 斜面を滑り続ければ加速し、転べば止まるのはスキーとしても自然な形。
 */
export function stepFor(cleanSeconds: number, boosts: number): number {
  const natural = Math.floor(Math.max(cleanSeconds, 0) / STEP_TIME)
  return natural + Math.max(boosts, 0)
}
/** レベル(距離)による基本速度の底上げ[m/s]。段を失っても完全な初速には戻らない。 */
const SPEED_PER_LEVEL = 0.9

/** 速度段とレベルから滑走速度[m/s]を出す。 */
export function speedFor(step: number, level: number): number {
  const s = Math.max(step, 0)
  return BASE_SPEED + s * SPEED_PER_STEP + Math.min(level - 1, 6) * SPEED_PER_LEVEL
}

/** 金の羽根の枚数から倍率を出す。1枚 +0.01。 */
export function multiplierFor(feathers: number): number {
  return 1 + Math.max(feathers, 0) * 0.01
}

/** バックエンドが受け付ける上限(MiniGame.maxScore と揃える)。 */
export const MAX_SCORE = 99_999

/**
 * 最終スコア。距離[m] × 倍率 を切り捨てる。
 *
 * 上限で頭打ちにするのは、超えると登録APIが400を返して結果画面が壊れるため。
 * 実際には20分以上ノーミスで滑り続けないと届かない。
 */
export function skiScore(distance: number, feathers: number): number {
  const raw = Math.floor(Math.max(distance, 0) * multiplierFor(feathers))
  return Math.min(raw, MAX_SCORE)
}

/** 600m ごとにレベルアップ(0〜599m がレベル1)。 */
export const skiLevelOf = (distance: number) => Math.floor(Math.max(distance, 0) / 600) + 1

/**
 * 滑り出しのうち障害物を置かない距離[m]。
 * 走り出してすぐ避けさせられると、何が起きたか分からないまま速度を失って気持ちよくない。
 * この間もアイテムは出るので、最初の数秒で加速してから最初の障害物に入る形になる。
 */
export const SAFE_START_DIST = 220

/** 障害物を飛び越えられる高さ[m]。これより上にいれば当たらない。 */
export const CLEAR_HEIGHT = 1.15

/**
 * 同じレーンとみなす横方向の許容[m]。レーン間隔 3m のちょうど半分より狭くしてある。
 * 1.5 以上にすると移動の中間位置で左右どちらにも当たり、「避けたのに当たった」になる。
 */
const HIT_HALF_W = 1.4

/**
 * 通過した物に当たるか。レーン移動中(中間位置)は左右どちらにも当たらない隙間がある。
 * 高さ h[m] が CLEAR_HEIGHT を超えていれば障害物は飛び越えられる。
 */
export function hitsObstacle(laneX: number, objX: number, h: number): boolean {
  if (h > CLEAR_HEIGHT) return false
  return Math.abs(laneX - objX) < HIT_HALF_W
}

/** アイテムを拾えるか。空中の羽根は高さも合っている必要がある。 */
export function picksUp(laneX: number, objX: number, h: number, itemH: number): boolean {
  if (Math.abs(laneX - objX) >= HIT_HALF_W) return false
  return Math.abs(h - itemH) < 1.5
}

// ---- ステージテーマ(雪山の時間帯) --------------------------------------

type RGB = readonly [number, number, number]

interface SkiTheme {
  name: string
  skyTop: RGB
  skyBottom: RGB
  ridgeFar: RGB
  ridgeNear: RGB
  snow: RGB
  snowFar: RGB
  groove: RGB
  tree: RGB
  treeSnow: RGB
  fog: RGB
  /** 夜のテーマだけ true。雪面にナイター照明の楕円を落とす。 */
  night?: boolean
}

const SKI_THEMES: SkiTheme[] = [
  {
    name: '朝もや',
    skyTop: [163, 196, 232],
    skyBottom: [231, 240, 248],
    ridgeFar: [178, 197, 219],
    ridgeNear: [146, 170, 198],
    snow: [252, 253, 255],
    snowFar: [223, 233, 244],
    groove: [186, 205, 226],
    tree: [58, 92, 84],
    treeSnow: [238, 246, 252],
    fog: [226, 236, 246],
  },
  {
    name: '快晴',
    skyTop: [66, 140, 216],
    skyBottom: [186, 220, 245],
    ridgeFar: [151, 183, 214],
    ridgeNear: [110, 146, 184],
    snow: [255, 255, 255],
    snowFar: [212, 229, 245],
    groove: [166, 196, 226],
    tree: [42, 84, 70],
    treeSnow: [246, 251, 255],
    fog: [206, 227, 246],
  },
  {
    name: '夕暮れ',
    skyTop: [72, 78, 138],
    skyBottom: [255, 176, 122],
    ridgeFar: [173, 143, 158],
    ridgeNear: [122, 97, 124],
    snow: [255, 234, 214],
    snowFar: [232, 190, 178],
    groove: [206, 158, 152],
    tree: [56, 54, 76],
    treeSnow: [255, 226, 206],
    fog: [240, 196, 172],
  },
  {
    name: 'ナイター',
    skyTop: [10, 16, 40],
    skyBottom: [30, 44, 82],
    ridgeFar: [38, 52, 88],
    ridgeNear: [24, 34, 62],
    snow: [174, 191, 222],
    snowFar: [96, 116, 156],
    groove: [78, 98, 140],
    tree: [16, 30, 38],
    treeSnow: [176, 196, 226],
    fog: [46, 62, 100],
    night: true,
  },
  {
    name: '吹雪',
    skyTop: [176, 186, 198],
    skyBottom: [222, 228, 236],
    ridgeFar: [200, 208, 218],
    ridgeNear: [180, 190, 202],
    snow: [246, 249, 252],
    snowFar: [214, 222, 232],
    groove: [196, 208, 220],
    tree: [78, 96, 96],
    treeSnow: [240, 246, 250],
    fog: [226, 232, 240],
  },
]

const themeForLevel = (level: number) => SKI_THEMES[(level - 1) % SKI_THEMES.length]

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
]
const css = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`
const cssA = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const easeInOut = (t: number) => t * t * (3 - 2 * t)

const mixTheme = (a: SkiTheme, b: SkiTheme, t: number): SkiTheme => ({
  name: b.name,
  skyTop: mixRGB(a.skyTop, b.skyTop, t),
  skyBottom: mixRGB(a.skyBottom, b.skyBottom, t),
  ridgeFar: mixRGB(a.ridgeFar, b.ridgeFar, t),
  ridgeNear: mixRGB(a.ridgeNear, b.ridgeNear, t),
  snow: mixRGB(a.snow, b.snow, t),
  snowFar: mixRGB(a.snowFar, b.snowFar, t),
  groove: mixRGB(a.groove, b.groove, t),
  tree: mixRGB(a.tree, b.tree, t),
  treeSnow: mixRGB(a.treeSnow, b.treeSnow, t),
  fog: mixRGB(a.fog, b.fog, t),
  night: t > 0.5 ? b.night : a.night,
})

// ---- ゲーム内オブジェクト ----------------------------------------------

type ObstacleKind = 'rock' | 'tree' | 'sign'
type ItemKind = 'feather' | 'boost' | 'ramp'

interface Obstacle {
  kind: ObstacleKind
  x: number
  z: number
  prevZ: number
  hit: boolean
  /** 見た目のばらつき(向き・大きさ)。 */
  seed: number
}

interface Item {
  kind: ItemKind
  x: number
  z: number
  prevZ: number
  h: number
  taken: boolean
  seed: number
}

/** コース脇の立木。当たり判定はない(景色と速度感のため)。 */
interface SideTree {
  x: number
  z: number
  seed: number
}

interface Particle {
  x: number
  z: number
  h: number
  vx: number
  vh: number
  vz: number
  life: number
  maxLife: number
  size: number
}

interface FloatText {
  x: number
  z: number
  h: number
  text: string
  color: string
  life: number
}

export interface SkiSnapshot {
  distance: number
  feathers: number
  multiplier: number
  score: number
  speedStep: number
  /** 残り時間[秒]。0 でタイムアップ。 */
  timeLeft: number
  level: number
}

export interface SkiCallbacks extends MiniGameCallbacks {
  /** 距離・倍率・ライフなどの変化。HUD は canvas 内に描くので、これはページ側の結果表示用。 */
  onStats?: (s: SkiSnapshot) => void
}

export interface SkiOptions extends MiniGameOptions {
  /** 開発時のみ: この速度段から始める。高速域の見え方と避けやすさを確かめる用。 */
  startStep?: number
}

export interface SkiHandle extends MiniGameHandle {
  /** 結果画面用の確定値。 */
  snapshot: () => SkiSnapshot
}

/** 1プレイの持ち時間[秒]。 */
export const TIME_LIMIT = 120
const JUMP_V = 9.2 // ジャンプ台での初速[m/s]
const GRAV_UP = 23 // 上昇中の重力[m/s^2]
const GRAV_DOWN = 9.5 // 下降中の重力。羽根がひらいてふわりと落ちる
const CRASH_TIME = 1.15 // 転倒して起き上がるまで[s]
/**
 * ラケットに当たったときの加点(金の羽根の枚数に換算)。
 * 速度段(=距離)だけでなく倍率にも効かせて、スコアの両側に見返りを作る。
 *
 * 将来案: 無敵で吹っ飛ぶ効果は、7秒ほど続く別アイテム「ゴールデンロケット」として
 * 切り出す予定。ラケットに持たせると1つのアイテムに旨みが集まりすぎる。
 */
export const BOOST_FEATHERS = 5

/**
 * ジャンプ台で飛んだときの頂点[m]と滞空時間[s]。update() の高さの積分と同じ定数から導く。
 * 障害物を越えられる高さ(CLEAR_HEIGHT)に届くか、滞空が長すぎないかをテストで見張るため。
 */
export function jumpArc(): { apex: number; airtime: number } {
  const apex = (JUMP_V * JUMP_V) / (2 * GRAV_UP)
  const rise = JUMP_V / GRAV_UP
  const fall = Math.sqrt((2 * apex) / GRAV_DOWN)
  return { apex, airtime: rise + fall }
}
const INVUL_TIME = 1.6 // 起き上がってからの無敵[s]

export function createShatopokoSkiGame(
  canvas: HTMLCanvasElement,
  cb: SkiCallbacks = {},
  opts: SkiOptions = {},
): SkiHandle {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { restart: () => {}, dispose: () => {}, snapshot: () => emptySnapshot() }

  // 開発時だけ、途中の距離から始めてテーマや難易度を確認できる(?s=1800)
  const startDistance = Math.max(0, Math.floor(opts.startScore ?? 0))
  const startStep = Math.max(0, Math.floor(opts.startStep ?? 0))

  let LH = 560
  let scale = 1
  let phase: GamePhase = 'ready'

  let distance = 0
  let feathers = 0
  let cleanT = 0 // 転ばずに滑っている秒数(転倒で0に戻る)
  let boostSteps = 0 // ラケット/ジャンプ台で稼いだ段(同じく転倒で0に戻る)
  let recoverTo = 0 // 転倒直前の段。ここまでは再加速が早い
  const speedStep = () => stepFor(cleanT, boostSteps)
  let timeLeft = TIME_LIMIT
  let level = 1

  let laneIndex = 1
  let laneX: number = LANE_X[1]
  let height = 0 // 雪面からの高さ[m]
  let vh = 0
  let crashT = 0 // >0 なら転倒中(操作不能)
  let invulT = 0
  let crashSpin = 0

  let obstacles: Obstacle[] = []
  let items: Item[] = []
  let sideTrees: SideTree[] = []
  let particles: Particle[] = []
  let floats: FloatText[] = []

  let elapsed = 0
  let nextRowAt = 0 // 次に行を生成する距離[m]
  let nextTreeAt = 0
  let levelUpAt = -10
  let boostFlash = 0 // ブースト取得直後の演出
  let shakeT = 0
  let diedAt = 0
  let raf = 0
  let last = 0
  let disposed = false

  // テーマのクロスフェード
  let themeFrom = themeForLevel(1)
  let themeTo = themeFrom
  let themeT = 1

  const setTheme = (lv: number, instant = false) => {
    themeFrom = currentTheme()
    themeTo = themeForLevel(lv)
    themeT = instant ? 1 : 0
  }
  const currentTheme = (): SkiTheme =>
    themeT >= 1 ? themeTo : mixTheme(themeFrom, themeTo, easeInOut(themeT))

  function emptySnapshot(): SkiSnapshot {
    return {
      distance: 0,
      feathers: 0,
      multiplier: 1,
      score: 0,
      speedStep: 0,
      timeLeft: TIME_LIMIT,
      level: 1,
    }
  }

  const snapshot = (): SkiSnapshot => ({
    distance: Math.floor(distance),
    feathers,
    multiplier: multiplierFor(feathers),
    score: skiScore(distance, feathers),
    speedStep: speedStep(),
    timeLeft: Math.max(timeLeft, 0),
    level,
  })

  const setPhase = (p: GamePhase) => {
    phase = p
    cb.onPhaseChange?.(p)
  }

  const emit = () => {
    const s = snapshot()
    cb.onStats?.(s)
    cb.onScore?.(s.score)
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

  // ---- 投影(論理座標 → 画面座標) ---------------------------------------

  const horizonY = () => LH * HORIZON
  const groundY = () => LH * GROUND_Y

  const projX = (x: number, s: number) => LW / 2 + x * PX_PER_M * s
  /** 高さ h[m] の点の画面Y。奥行きは縮小率 s に織り込み済みなので z は要らない。 */
  const projY = (h: number, s: number) =>
    horizonY() + (groundY() - horizonY()) * s - h * PX_PER_M * s

  // ---- 生成 ------------------------------------------------------------

  /**
   * 行の間隔[m]。レベルが上がるほど詰まる。
   *
   * 速度段に応じて少しだけ広げているのは、距離ベースのままだと加速するほど
   * 判断できる時間が反比例で縮むため。上限では 0.3 秒ごとに move を強いられて、
   * 「ブーストを拾うと死ぬ」= 速さが資産にならないゲームになってしまう。
   * 広げ方は反比例を打ち消さない程度(上限でも反応時間は 6 割)に留める。
   */
  const rowGap = () =>
    Math.max(50 - level * 2.5, 32) * (1 + Math.min(speedStep(), GAP_RELIEF_CAP) * 0.06)

  /** 障害物で塞ぐレーン数。必ず1本は空ける(=最大2)。 */
  const obstacleCount = () => {
    const r = Math.random()
    // 2レーン塞ぎ(=通れるのは1本だけ)をレベル1から出す。安全に直進できる区間が続くと、
    // 速いだけで簡単なゲームになってしまう
    if (level <= 1) return r < 0.5 ? 1 : r < 0.78 ? 2 : 0
    if (level === 2) return r < 0.42 ? 1 : r < 0.88 ? 2 : 0
    return r < 0.32 ? 1 : r < 0.94 ? 2 : 0
  }

  const pickIdx = (n: number) => Math.floor(Math.random() * n)

  const addObstacle = (lane: number, z: number) => {
    const r = Math.random()
    obstacles.push({
      kind: r < 0.5 ? 'rock' : r < 0.85 ? 'tree' : 'sign',
      x: LANE_X[lane],
      z,
      prevZ: z,
      hit: false,
      seed: Math.random(),
    })
  }

  const addItem = (kind: ItemKind, lane: number, z: number, h = 0) => {
    items.push({ kind, x: LANE_X[lane], z, prevZ: z, h, taken: false, seed: Math.random() })
  }

  /**
   * 1行ぶんの配置。必ず通り抜けられるレーンを残す。
   *
   * ジャンプ台は「飛んだ先の空中に羽根が並ぶ」形にしてある。乗るだけで得ではなく、
   * 乗ってから空中で正しいレーンにいると多く拾える、という作り。
   */
  const spawnRow = (z: number) => {
    // この行が置かれる絶対位置。滑り出しの間は障害物を出さない
    const worldAt = distance + z
    const nObs = worldAt < startDistance + SAFE_START_DIST ? 0 : obstacleCount()
    const blocked = blockedLanes(nObs, pickIdx)
    for (const l of blocked) addObstacle(l, z + (Math.random() - 0.5) * 4)

    const free = [0, 1, 2].filter((l) => !blocked.includes(l))
    if (free.length === 0) return

    const r = Math.random()
    const lane = free[pickIdx(free.length)]

    if (r < 0.22) {
      // ジャンプ台 → その先に空中の羽根を5枚
      addItem('ramp', lane, z)
      const flightLane = free.length > 1 && Math.random() < 0.35 ? free[pickIdx(free.length)] : lane
      // 踏み切り直後から並べる。滞空は約1秒なので、速いほど奥まで届いて多く拾える
      for (let i = 0; i < 5; i++) addItem('feather', flightLane, z - 10 - i * 7.5, 1.7 + i * 0.12)
    } else if (r < 0.38) {
      // ラケット。速度段では出現を絞らない。速さを積み上げること自体がこのゲームの
      // 目的なので、速くなった人ほど出ないのでは上を目指す手段が絶たれてしまう
      addItem('boost', lane, z)
    } else if (r < 0.78) {
      // 地上の羽根の列
      // 枚数 × 間隔が rowGap を超えないこと。超えると前の行の列と重なって団子になる
      const n = 2 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n; i++) addItem('feather', lane, z - i * 10, 0.55)
      // 空いている別レーンにも少しだけ置いて、選ぶ余地を作る
      const other = free.filter((l) => l !== lane)
      if (other.length > 0 && Math.random() < 0.4) {
        for (let i = 0; i < 2; i++) addItem('feather', other[pickIdx(other.length)], z - i * 10, 0.55)
      }
    }
  }

  const spawnSideTrees = (z: number) => {
    for (const side of [-1, 1]) {
      const x = side * (COURSE_HALF + 1.2 + Math.random() * 5)
      sideTrees.push({ x, z: z + (Math.random() - 0.5) * 6, seed: Math.random() })
    }
  }

  // ---- 状態遷移 --------------------------------------------------------

  const toReady = (instantTheme = false) => {
    distance = startDistance
    feathers = 0
    cleanT = 0
    boostSteps = startStep
    recoverTo = 0
    timeLeft = TIME_LIMIT
    level = skiLevelOf(distance)
    laneIndex = 1
    laneX = LANE_X[1]
    height = 0
    vh = 0
    crashT = 0
    invulT = 0
    crashSpin = 0
    obstacles = []
    items = []
    sideTrees = []
    particles = []
    floats = []
    elapsed = 0
    boostFlash = 0
    shakeT = 0
    levelUpAt = -10
    // 最初の行は地平線の近くから。手前(40m)に置くと、開始した瞬間の一括生成で
    // 目の前にアイテムが並んだ状態から始まってしまう
    nextRowAt = distance + Z_FAR * 0.82
    nextTreeAt = distance
    setTheme(level, instantTheme)
    // 開始前でも景色が流れていた方が「これから滑る」感じが出るので、木だけ先に置く
    for (let z = 10; z < Z_FAR; z += 9) spawnSideTrees(z)
    emit()
    setPhase('ready')
  }

  const start = () => {
    if (phase !== 'ready') return
    setPhase('playing')
  }

  const gameOver = () => {
    diedAt = elapsed
    setPhase('over')
    cb.onGameOver?.(skiScore(distance, feathers))
  }

  // ---- 当たり判定・効果 ------------------------------------------------

  const addFloat = (x: number, z: number, h: number, text: string, color: string) => {
    floats.push({ x, z, h, text, color, life: 0.85 })
  }

  const burstSnow = (n: number, power: number) => {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: laneX + (Math.random() - 0.5) * 1.6,
        z: (Math.random() - 0.5) * 2,
        h: Math.random() * 0.9,
        vx: (Math.random() - 0.5) * power,
        vh: Math.random() * power * 0.7,
        vz: -Math.random() * power * 0.5,
        life: 0.45 + Math.random() * 0.4,
        maxLife: 0.85,
        size: 2 + Math.random() * 4,
      })
    }
  }

  const crash = () => {
    if (crashT > 0 || invulT > 0) return
    // 転倒で速さの積み上げを全部失う。時間制での唯一の罰なので、無事故の秒数も0に戻す。
    // ただし直前の段は覚えておいて、そこまでは早く戻れるようにする
    recoverTo = speedStep()
    cleanT = 0
    boostSteps = 0
    crashT = CRASH_TIME
    crashSpin = 0
    shakeT = 0.4
    height = 0
    vh = 0
    burstSnow(26, 9)
    addFloat(laneX, 2, 3.0, 'CRASH!', '#ff5b5b')
    emit()
  }

  const takeBoost = () => {
    boostSteps += 1
    boostFlash = 0.8
    shakeT = 0.18 // 打たれた衝撃。転倒の揺れ(0.4)より短く軽くして、痛みと区別する
    // 段が1つ上がるだけでは見返りが薄いので、倍率にも効かせる
    feathers += BOOST_FEATHERS
    addFloat(laneX, 2, 3.2, `スマッシュ! +${BOOST_FEATHERS}`, '#ff8a3d')
    burstSnow(16, 9)
    emit()
  }

  const takeFeather = (x: number, z: number, h: number) => {
    feathers += 1
    if (feathers % 10 === 0) addFloat(x, z, h + 0.6, `×${multiplierFor(feathers).toFixed(2)}`, '#ffd24a')
    emit()
  }

  const takeRamp = () => {
    if (height > 0.2) return
    vh = JUMP_V
    burstSnow(14, 7)
    // 踏み切りでも1段上がる。跳ぶと飛距離も伸びるので、空中の羽根を拾いやすくなる
    boostSteps += 1
    boostFlash = 0.5
    addFloat(laneX, 2, 3.6, `SPEED ${speedStep()}`, '#7ddcff')
    emit()
  }

  // ---- 入力 ------------------------------------------------------------

  const moveLane = (dir: number) => {
    if (phase === 'ready') start()
    if (phase !== 'playing' || crashT > 0) return
    const next = Math.min(Math.max(laneIndex + dir, 0), 2)
    laneIndex = next
  }

  let touchStartX = 0
  let touchStartY = 0
  let touchMoved = false
  let pointerDown = false

  const onPointerDown = (e: PointerEvent) => {
    pointerDown = true
    touchMoved = false
    touchStartX = e.clientX
    touchStartY = e.clientY
    if (phase === 'ready') start()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pointerDown || touchMoved) return
    const dx = e.clientX - touchStartX
    const dy = e.clientY - touchStartY
    // 横向きのはっきりしたスワイプだけを拾う(縦スクロールと取り違えない)
    if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1)
      touchMoved = true
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!pointerDown) return
    pointerDown = false
    if (touchMoved) return
    // スワイプにならなかった短いタップは、画面の左右どちらを触ったかで移動する
    const rect = canvas.getBoundingClientRect()
    const rel = (e.clientX - rect.left) / rect.width
    if (rel < 0.4) moveLane(-1)
    else if (rel > 0.6) moveLane(1)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      moveLane(-1)
      e.preventDefault()
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      moveLane(1)
      e.preventDefault()
    } else if (e.key === ' ' || e.key === 'Enter') {
      if (phase === 'ready') start()
      e.preventDefault()
    }
  }

  // ---- 更新 ------------------------------------------------------------

  const update = (dt: number) => {
    elapsed += dt
    themeT = Math.min(themeT + dt / 0.9, 1)
    if (boostFlash > 0) boostFlash = Math.max(boostFlash - dt, 0)
    if (shakeT > 0) shakeT = Math.max(shakeT - dt, 0)

    // 準備中はゆっくり景色だけ流す
    const speed = phase === 'playing' ? speedFor(speedStep(), level) * (crashT > 0 ? 0.35 : 1) : 6

    const dz = speed * dt
    if (phase === 'playing') {
      distance += dz
      const lv = skiLevelOf(distance)
      if (lv !== level) {
        level = lv
        levelUpAt = elapsed
        setTheme(lv)
      }
      // 転ばずに滑れている間だけ加速の時計が進む
      if (crashT <= 0) {
        const was = speedStep()
        cleanT += dt * recoveryRate(was, recoverTo)
        const now = speedStep()
        if (now >= recoverTo) recoverTo = 0
        if (now > was) {
          boostFlash = 0.45
          addFloat(laneX, 2, 3.2, `SPEED ${now}`, '#7ddcff')
          emit()
        }
      }

      // 持ち時間。0 になったらその場でタイムアップ
      const before = timeLeft
      timeLeft -= dt
      // 残り10秒に入った瞬間だけ知らせる(以降は HUD の点滅で分かる)
      if (before > 10 && timeLeft <= 10) addFloat(laneX, 2, 2.2, 'のこり10秒!', '#ffd24a')
      if (timeLeft <= 0) {
        timeLeft = 0
        emit()
        gameOver()
      }
    }

    // レーン移動(指数追従。0.1秒で7割方たどり着く速さ)
    const targetX = LANE_X[laneIndex]
    laneX += (targetX - laneX) * Math.min(1, dt * 17)

    // 高さ(ジャンプ)。上りは速く、下りはふわりと
    if (height > 0 || vh > 0) {
      vh -= (vh > 0 ? GRAV_UP : GRAV_DOWN) * dt
      height += vh * dt
      if (height <= 0) {
        if (vh < -3) burstSnow(8, 5)
        height = 0
        vh = 0
      }
    }

    if (crashT > 0) {
      crashT = Math.max(crashT - dt, 0)
      crashSpin += dt * 13
      if (crashT === 0) invulT = INVUL_TIME
    } else if (invulT > 0) {
      invulT = Math.max(invulT - dt, 0)
    }

    // 滑走中の雪しぶき(速いほど多い)
    if (phase === 'playing' && height <= 0 && crashT <= 0) {
      const rate = 8 + speedStep() * 4
      if (Math.random() < rate * dt) burstSnow(1, 3 + speedStep() * 0.5)
    }

    // オブジェクトを手前へ流す
    for (const o of obstacles) {
      o.prevZ = o.z
      o.z -= dz
    }
    for (const it of items) {
      it.prevZ = it.z
      it.z -= dz
    }
    for (const t of sideTrees) t.z -= dz

    // 通過の瞬間に判定する(高速時に飛び越さないよう、前フレームとの交差で見る)
    if (phase === 'playing' && crashT <= 0) {
      for (const o of obstacles) {
        if (o.hit || o.prevZ <= 0 || o.z > 0) continue
        o.hit = true
        if (hitsObstacle(laneX, o.x, height)) crash()
      }
      for (const it of items) {
        if (it.taken || it.prevZ <= 0 || it.z > 0) continue
        if (it.kind === 'ramp') {
          if (Math.abs(laneX - it.x) < HIT_HALF_W && height <= 0.3) {
            it.taken = true
            takeRamp()
          }
          continue
        }
        if (!picksUp(laneX, it.x, height, it.h)) continue
        it.taken = true
        if (it.kind === 'boost') takeBoost()
        else takeFeather(it.x, 0, it.h)
      }
    }

    obstacles = obstacles.filter((o) => o.z > -8)
    items = items.filter((it) => it.z > -8 && !it.taken)
    sideTrees = sideTrees.filter((t) => t.z > -8)

    // 生成(距離ベースなので、速くなっても密度は変わらない)
    if (phase === 'playing') {
      while (distance + Z_FAR > nextRowAt) {
        spawnRow(nextRowAt - distance)
        nextRowAt += rowGap()
      }
    }
    while (distance + Z_FAR > nextTreeAt) {
      spawnSideTrees(nextTreeAt - distance)
      nextTreeAt += 9
    }

    // パーティクル・フロートテキスト
    for (const p of particles) {
      p.life -= dt
      p.x += p.vx * dt
      p.h += p.vh * dt
      p.z += p.vz * dt - dz
      p.vh -= 12 * dt
      if (p.h < 0) {
        p.h = 0
        p.vh = 0
      }
    }
    particles = particles.filter((p) => p.life > 0 && p.z > -6)

    for (const f of floats) {
      f.life -= dt
      f.h += dt * 1.6
      f.z -= dz
    }
    floats = floats.filter((f) => f.life > 0 && f.z > -6)
  }

  // ---- 描画 ------------------------------------------------------------

  const drawSky = (th: SkiTheme) => {
    const hy = horizonY()
    const g = ctx.createLinearGradient(0, 0, 0, hy + 40)
    g.addColorStop(0, css(th.skyTop))
    g.addColorStop(1, css(th.skyBottom))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, LW, hy + 40)

    if (th.night) {
      // ナイターの星。距離で流れないよう固定(遠すぎて動かないという理屈)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      for (let i = 0; i < 26; i++) {
        const x = ((i * 97) % 360) + ((i * 13) % 7)
        const y = ((i * 53) % Math.max(Math.floor(hy - 20), 20)) + 6
        const r = i % 5 === 0 ? 1.4 : 0.8
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  /** 遠景の稜線。距離に対してごくゆっくり流れる(パララックス)。 */
  const drawRidges = (th: SkiTheme) => {
    const hy = horizonY()
    const layers: Array<{ color: RGB; amp: number; base: number; speed: number; period: number }> = [
      { color: th.ridgeFar, amp: 34, base: hy - 6, speed: 0.06, period: 210 },
      { color: th.ridgeNear, amp: 22, base: hy + 2, speed: 0.11, period: 145 },
    ]
    for (const l of layers) {
      const off = (distance * l.speed) % l.period
      ctx.fillStyle = css(l.color)
      ctx.beginPath()
      ctx.moveTo(-20, hy + 30)
      for (let x = -20; x <= LW + 20; x += 6) {
        const t = (x + off) / l.period
        const y =
          l.base -
          l.amp * (0.55 + 0.45 * Math.sin(t * Math.PI * 2)) * (0.8 + 0.2 * Math.sin(t * 5.1))
        ctx.lineTo(x, y)
      }
      ctx.lineTo(LW + 20, hy + 30)
      ctx.closePath()
      ctx.fill()
    }
  }

  /** 雪面。手前ほど広がる台形と、流れる横縞・レーンの溝。 */
  const drawSlope = (th: SkiTheme) => {
    const sNear = scaleAt(Z_NEAR)
    // 雪面は物を描く範囲(Z_FAR)ではなく消失点まで伸ばす。
    // Z_FAR で切ると、山の裾との間に空の色が帯になって残ってしまう。
    const sFar = scaleAt(4000)
    const yNear = projY(0, sNear)
    const yFar = projY(0, sFar)

    // コース外(左右の深雪)。コースより一段暗くして境目を出す
    ctx.fillStyle = css(mixRGB(th.snowFar, th.ridgeNear, 0.38))
    ctx.fillRect(0, yFar - 1, LW, LH - yFar + 1)

    const g = ctx.createLinearGradient(0, yFar, 0, LH)
    g.addColorStop(0, css(mixRGB(th.snowFar, th.ridgeNear, 0.38)))
    g.addColorStop(0.12, css(th.snowFar))
    g.addColorStop(0.4, css(th.snow))
    g.addColorStop(1, css(th.snow))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(projX(-COURSE_HALF, sFar), yFar)
    ctx.lineTo(projX(COURSE_HALF, sFar), yFar)
    ctx.lineTo(projX(COURSE_HALF, sNear), yNear)
    ctx.lineTo(projX(-COURSE_HALF, sNear), yNear)
    ctx.closePath()
    ctx.fill()

    // 横縞(12m ごと)。これが無いと速度感がまったく出ない
    const period = 12
    const off = distance % period
    ctx.fillStyle = cssA(th.groove, 0.22)
    for (let k = -2; k < 18; k++) {
      const z0 = k * period - off
      const z1 = z0 + period * 0.42
      if (z1 < Z_NEAR) continue
      const s0 = scaleAt(Math.max(z0, Z_NEAR))
      const s1 = scaleAt(Math.max(z1, Z_NEAR))
      const y0 = projY(0, s0)
      const y1 = projY(0, s1)
      if (Math.abs(y1 - y0) < 0.6) continue
      ctx.beginPath()
      ctx.moveTo(projX(-COURSE_HALF, s0), y0)
      ctx.lineTo(projX(COURSE_HALF, s0), y0)
      ctx.lineTo(projX(COURSE_HALF, s1), y1)
      ctx.lineTo(projX(-COURSE_HALF, s1), y1)
      ctx.closePath()
      ctx.fill()
    }

    // レーンの境目(シュプールの溝)
    ctx.strokeStyle = cssA(th.groove, 0.75)
    for (const bx of [-1.5, 1.5]) {
      ctx.beginPath()
      ctx.moveTo(projX(bx, sFar), yFar)
      ctx.lineTo(projX(bx, sNear), yNear)
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
    // コースの縁
    ctx.strokeStyle = cssA(th.groove, 0.95)
    ctx.lineWidth = 2
    for (const bx of [-COURSE_HALF, COURSE_HALF]) {
      ctx.beginPath()
      ctx.moveTo(projX(bx, sFar), yFar)
      ctx.lineTo(projX(bx, sNear), yNear)
      ctx.stroke()
    }

    if (th.night) {
      // ナイター照明。雪面に楕円の光を落とす
      const period2 = 40
      const off2 = distance % period2
      for (let k = 0; k < 5; k++) {
        const z = k * period2 - off2 + 10
        if (z < 0) continue
        const s = scaleAt(z)
        const cx = projX(0, s)
        const cy = projY(0, s)
        const rx = 6.5 * PX_PER_M * s
        const ry = rx * 0.28
        const lg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx)
        lg.addColorStop(0, 'rgba(255,238,190,0.46)')
        lg.addColorStop(1, 'rgba(255,238,190,0)')
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1, ry / rx)
        ctx.translate(-cx, -cy)
        ctx.fillStyle = lg
        ctx.beginPath()
        ctx.arc(cx, cy, rx, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // 地平線の霞。遠くのオブジェクトが唐突に現れるのをぼかす
    const fog = ctx.createLinearGradient(0, yFar - 26, 0, yFar + 54)
    fog.addColorStop(0, cssA(th.fog, 0.95))
    fog.addColorStop(1, cssA(th.fog, 0))
    ctx.fillStyle = fog
    ctx.fillRect(0, yFar - 26, LW, 80)
  }

  const drawTree = (th: SkiTheme, x: number, z: number, seed: number) => {
    const s = scaleAt(z)
    const px = projX(x, s)
    const py = projY(0, s)
    const hgt = (4.2 + seed * 2.2) * PX_PER_M * s
    const wid = hgt * 0.34
    if (hgt < 1.5) return
    // コース脇の木は霞に寄せて後退させる。コース上の障害物と同じ濃さだと、
    // どれをよけるべきか一目で分からなくなる。
    const far = mixRGB(th.tree, th.fog, 0.42)
    ctx.fillStyle = cssA(mixRGB([107, 83, 64], th.fog, 0.42), 1)
    ctx.fillRect(px - wid * 0.08, py - hgt * 0.22, wid * 0.16, hgt * 0.22)
    ctx.fillStyle = css(far)
    for (let i = 0; i < 3; i++) {
      const t = i / 3
      const y = py - hgt * 0.18 - hgt * 0.27 * i
      const w = wid * (1 - t * 0.3)
      ctx.beginPath()
      ctx.moveTo(px, y - hgt * 0.42)
      ctx.lineTo(px - w / 2, y)
      ctx.lineTo(px + w / 2, y)
      ctx.closePath()
      ctx.fill()
    }
    // 枝に載った雪
    ctx.fillStyle = cssA(th.treeSnow, 0.85)
    for (let i = 0; i < 3; i++) {
      const y = py - hgt * 0.18 - hgt * 0.27 * i
      const w = wid * (1 - (i / 3) * 0.3)
      ctx.beginPath()
      ctx.ellipse(px, y - 1, w * 0.42, hgt * 0.035, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawObstacle = (th: SkiTheme, o: Obstacle) => {
    const s = scaleAt(o.z)
    if (s <= 0) return
    const px = projX(o.x, s)
    const py = projY(0, s)
    const u = PX_PER_M * s // 1m のピクセル数

    // 影。濃いめにして、遠くにあるうちから「コース上に何かある」と気づけるようにする
    ctx.fillStyle = 'rgba(38,58,92,0.3)'
    ctx.beginPath()
    ctx.ellipse(px, py, u * 0.9, u * 0.26, 0, 0, Math.PI * 2)
    ctx.fill()

    if (o.kind === 'rock') {
      const r = u * (0.75 + o.seed * 0.2)
      ctx.fillStyle = '#6a707c'
      ctx.beginPath()
      ctx.moveTo(px - r, py)
      ctx.lineTo(px - r * 0.7, py - r * 1.05)
      ctx.lineTo(px + r * 0.1, py - r * 1.35)
      ctx.lineTo(px + r * 0.8, py - r * 0.85)
      ctx.lineTo(px + r, py)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#878e9b'
      ctx.beginPath()
      ctx.moveTo(px - r * 0.7, py - r * 1.05)
      ctx.lineTo(px + r * 0.1, py - r * 1.35)
      ctx.lineTo(px + r * 0.15, py - r * 0.6)
      ctx.closePath()
      ctx.fill()
      // 岩の上の雪
      ctx.fillStyle = cssA(th.treeSnow, 0.9)
      ctx.beginPath()
      ctx.ellipse(px + r * 0.05, py - r * 1.25, r * 0.5, r * 0.18, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (o.kind === 'tree') {
      const hgt = u * (2.4 + o.seed * 0.5)
      const wid = hgt * 0.42
      ctx.fillStyle = '#6b5340'
      ctx.fillRect(px - wid * 0.09, py - hgt * 0.2, wid * 0.18, hgt * 0.2)
      ctx.fillStyle = css(th.tree)
      for (let i = 0; i < 3; i++) {
        const y = py - hgt * 0.16 - hgt * 0.26 * i
        const w = wid * (1 - (i / 3) * 0.28)
        ctx.beginPath()
        ctx.moveTo(px, y - hgt * 0.4)
        ctx.lineTo(px - w / 2, y)
        ctx.lineTo(px + w / 2, y)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = cssA(th.treeSnow, 0.85)
      ctx.beginPath()
      ctx.ellipse(px, py - hgt * 0.16, wid * 0.4, hgt * 0.04, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // 工事中の立て看板。ぶつかると痛そうな見た目にして避ける動機を作る
      const hgt = u * 1.9
      const w = u * 1.5
      ctx.fillStyle = '#8b6b4a'
      ctx.fillRect(px - u * 0.06, py - hgt * 0.55, u * 0.12, hgt * 0.55)
      ctx.fillStyle = '#f5a524'
      ctx.beginPath()
      ctx.roundRect(px - w / 2, py - hgt, w, hgt * 0.5, 3)
      ctx.fill()
      ctx.strokeStyle = '#2b2b2b'
      ctx.lineWidth = Math.max(u * 0.06, 0.8)
      ctx.stroke()
      ctx.fillStyle = '#2b2b2b'
      const stripe = w / 5
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(px - w / 2 + stripe * (i * 1.6), py - hgt * 0.52)
        ctx.lineTo(px - w / 2 + stripe * (i * 1.6 + 0.7), py - hgt * 0.52)
        ctx.lineTo(px - w / 2 + stripe * (i * 1.6 + 1.4), py - hgt)
        ctx.lineTo(px - w / 2 + stripe * (i * 1.6 + 0.7), py - hgt)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  const drawItem = (it: Item) => {
    const s = scaleAt(it.z)
    if (s <= 0) return
    const px = projX(it.x, s)
    const py = projY(it.h, s)
    const u = PX_PER_M * s
    const bob = Math.sin(elapsed * 3 + it.seed * 6) * u * 0.12

    if (it.kind === 'feather') {
      // 金の羽根。細長く尖らせると炎に見えてしまうので、幅を持たせて羽軸を通す
      const r = u * 0.44
      if (r < 1) return
      ctx.save()
      ctx.translate(px, py + bob)

      // 拾えるものだと分かるように、うっすら後光を添える
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.1)
      halo.addColorStop(0, 'rgba(255,214,110,0.34)')
      halo.addColorStop(1, 'rgba(255,214,110,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2)
      ctx.fill()

      // 傾きは控えめ(±0.22rad)。大きく回すと何の形か読めなくなる
      ctx.rotate(Math.sin(elapsed * 1.8 + it.seed * 9) * 0.22)
      const g = ctx.createLinearGradient(-r, -r, r, r)
      g.addColorStop(0, '#fff6d4')
      g.addColorStop(0.45, '#f5c85a')
      g.addColorStop(1, '#c9922a')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(0, -r * 1.35)
      ctx.bezierCurveTo(r * 0.92, -r * 0.75, r * 0.8, r * 0.35, 0, r * 0.95)
      ctx.bezierCurveTo(-r * 0.8, r * 0.35, -r * 0.92, -r * 0.75, 0, -r * 1.35)
      ctx.closePath()
      ctx.fill()

      // 羽軸と、そこから伸びる羽枝
      ctx.strokeStyle = 'rgba(150,102,18,0.75)'
      ctx.lineWidth = Math.max(r * 0.11, 0.5)
      ctx.beginPath()
      ctx.moveTo(0, -r * 1.3)
      ctx.lineTo(0, r * 1.15)
      ctx.stroke()
      if (r > 4) {
        ctx.strokeStyle = 'rgba(150,102,18,0.32)'
        ctx.lineWidth = Math.max(r * 0.07, 0.4)
        for (let i = 0; i < 3; i++) {
          const y = -r * 0.75 + i * r * 0.55
          for (const side of [-1, 1]) {
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(side * r * 0.62, y + r * 0.3)
            ctx.stroke()
          }
        }
      }
      ctx.restore()
    } else if (it.kind === 'boost') {
      // ラケット。シャトポコはシャトルなので、打たれて飛ぶのが加速の理由になる。
      // 岩や立木と同じ「立っているもの」なので、暖色の後光と傾きで避ける物と差をつける。
      const r = u * 0.72
      if (r < 1) return
      ctx.save()
      ctx.translate(px, py - r * 1.15 + bob)
      const pulse = 1 + Math.sin(elapsed * 6 + it.seed * 4) * 0.07
      ctx.scale(pulse, pulse)

      // 後光(拾うものだと分かるように。障害物には決して付けない目印)
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.9)
      halo.addColorStop(0, 'rgba(255,170,90,0.45)')
      halo.addColorStop(1, 'rgba(255,170,90,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2)
      ctx.fill()

      // 少し傾けて構えているように見せる
      ctx.rotate(-0.28 + Math.sin(elapsed * 2 + it.seed * 5) * 0.08)

      // グリップ
      ctx.fillStyle = '#d63b34'
      ctx.beginPath()
      ctx.roundRect(-r * 0.11, r * 0.25, r * 0.22, r * 1.0, r * 0.1)
      ctx.fill()
      // シャフト
      ctx.strokeStyle = '#e8eef7'
      ctx.lineWidth = Math.max(r * 0.13, 0.8)
      ctx.beginPath()
      ctx.moveTo(0, r * 0.3)
      ctx.lineTo(0, -r * 0.1)
      ctx.stroke()

      // ガット面(白いメッシュ)
      const fw = r * 0.72
      const fh = r * 0.92
      ctx.beginPath()
      ctx.ellipse(0, -fh * 0.55, fw, fh, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fill()
      if (r > 5) {
        ctx.save()
        ctx.beginPath()
        ctx.ellipse(0, -fh * 0.55, fw, fh, 0, 0, Math.PI * 2)
        ctx.clip()
        ctx.strokeStyle = 'rgba(120,140,170,0.55)'
        ctx.lineWidth = Math.max(r * 0.045, 0.4)
        for (let i = -3; i <= 3; i++) {
          const gx2 = (i / 3) * fw
          ctx.beginPath()
          ctx.moveTo(gx2, -fh * 1.5)
          ctx.lineTo(gx2, fh * 0.5)
          ctx.stroke()
          const gy2 = -fh * 0.55 + (i / 3) * fh
          ctx.beginPath()
          ctx.moveTo(-fw, gy2)
          ctx.lineTo(fw, gy2)
          ctx.stroke()
        }
        ctx.restore()
      }
      // フレーム(赤)。雪にも岩にも無い色なので、遠くからでも加速アイテムだと分かる
      ctx.strokeStyle = '#d63b34'
      ctx.lineWidth = Math.max(r * 0.16, 1)
      ctx.beginPath()
      ctx.ellipse(0, -fh * 0.55, fw, fh, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    } else {
      // ジャンプ台。手前が低く奥が高い雪の斜面
      const s2 = scaleAt(it.z + 3.2)
      const py2 = projY(1.5, s2)
      const w = 1.5
      ctx.fillStyle = '#e8f1fb'
      ctx.beginPath()
      ctx.moveTo(projX(it.x - w, s), py)
      ctx.lineTo(projX(it.x + w, s), py)
      ctx.lineTo(projX(it.x + w * 0.8, s2), py2)
      ctx.lineTo(projX(it.x - w * 0.8, s2), py2)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#8fb2d6'
      ctx.lineWidth = Math.max(u * 0.05, 0.7)
      ctx.stroke()
      // 踏み切り位置の矢印
      if (u > 6) {
        ctx.fillStyle = '#4a90d9'
        const ax = projX(it.x, (s + s2) / 2)
        const ay = (py + py2) / 2
        ctx.beginPath()
        ctx.moveTo(ax, ay - u * 0.35)
        ctx.lineTo(ax - u * 0.3, ay + u * 0.15)
        ctx.lineTo(ax + u * 0.3, ay + u * 0.15)
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  /**
   * シャトポコ(後ろ姿)。丸い体に羽根、黒いバンド、下にスキー板。
   * 空中では羽根と手をひろげる — シャトルが失速する姿を、そのまま滑空にしている。
   */
  const drawShatopoko = () => {
    const s = scaleAt(0)
    const px = projX(laneX, s)
    const py = projY(height, s)
    const u = PX_PER_M * s
    const lean = Math.min(Math.max((LANE_X[laneIndex] - laneX) * 0.35, -0.42), 0.42)
    const airborne = height > 0.05
    const open = airborne ? 1 : 0

    ctx.save()
    ctx.translate(px, py)

    // 影(高く飛ぶほど薄く小さく)
    ctx.save()
    ctx.translate(0, projY(0, s) - py)
    const shadowA = 0.22 * Math.max(0, 1 - height / 4)
    ctx.fillStyle = `rgba(40,60,90,${shadowA})`
    ctx.beginPath()
    ctx.ellipse(0, 0, u * 0.7 * Math.max(0.5, 1 - height / 6), u * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    if (crashT > 0) ctx.rotate(crashSpin)
    else ctx.rotate(lean * 0.5)


    // 無敵中は点滅させて、当たらない状態だと分かるようにする
    if (invulT > 0 && Math.floor(elapsed * 12) % 2 === 0) ctx.globalAlpha = 0.45

    const bodyR = u * 0.62

    // スキー板(体の後ろに描く)
    if (crashT <= 0) {
      ctx.save()
      ctx.rotate(lean * 0.8)
      for (const side of [-1, 1]) {
        ctx.save()
        ctx.translate(side * bodyR * 0.5, bodyR * 0.55)
        ctx.fillStyle = side < 0 ? '#e0453f' : '#2f6fd0'
        ctx.beginPath()
        ctx.roundRect(-bodyR * 0.22, -bodyR * 0.9, bodyR * 0.44, bodyR * 1.5, bodyR * 0.2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillRect(-bodyR * 0.06, -bodyR * 0.85, bodyR * 0.12, bodyR * 1.3)
        ctx.restore()
      }
      ctx.restore()
    }

    // 羽根(後ろ姿なので体の上に広がって見える)
    const fanCount = 5
    for (let i = 0; i < fanCount; i++) {
      const t = i / (fanCount - 1) - 0.5
      const spread = (0.55 + open * 0.5) * t * Math.PI * 0.9
      const len = bodyR * (1.5 + open * 0.35)
      ctx.save()
      ctx.rotate(spread)
      const g = ctx.createLinearGradient(0, 0, 0, -len)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(1, '#e6edf6')
      ctx.fillStyle = g
      ctx.strokeStyle = '#c3cede'
      ctx.lineWidth = Math.max(bodyR * 0.06, 0.5)
      ctx.beginPath()
      ctx.moveTo(0, -bodyR * 0.2)
      ctx.quadraticCurveTo(bodyR * 0.44, -len * 0.55, 0, -len)
      ctx.quadraticCurveTo(-bodyR * 0.44, -len * 0.55, 0, -bodyR * 0.2)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // 体(白い球)
    const bg = ctx.createRadialGradient(
      -bodyR * 0.3,
      -bodyR * 0.35,
      bodyR * 0.1,
      0,
      0,
      bodyR * 1.15,
    )
    bg.addColorStop(0, '#ffffff')
    bg.addColorStop(1, '#dde5ef')
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.arc(0, 0, bodyR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#c3cede'
    ctx.lineWidth = Math.max(bodyR * 0.07, 0.5)
    ctx.stroke()

    // 黒いバンド(コルクとの境目)
    ctx.fillStyle = '#2b3140'
    ctx.beginPath()
    ctx.ellipse(0, bodyR * 0.42, bodyR * 0.92, bodyR * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()

    // ニット帽(後ろから見える範囲)。雪山らしさはここで出す
    ctx.fillStyle = '#1d4685'
    ctx.beginPath()
    ctx.arc(0, -bodyR * 0.45, bodyR * 0.78, Math.PI * 0.95, Math.PI * 2.05)
    ctx.fill()
    ctx.fillStyle = '#f0c04a'
    ctx.beginPath()
    ctx.arc(0, -bodyR * 1.18, bodyR * 0.24, 0, Math.PI * 2)
    ctx.fill()

    // 手(空中ではひろげてバランスを取る)
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(side * bodyR * 0.85, bodyR * 0.05)
      ctx.rotate(side * (0.3 + open * 0.9))
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#c3cede'
      ctx.lineWidth = Math.max(bodyR * 0.06, 0.5)
      ctx.beginPath()
      ctx.ellipse(0, 0, bodyR * 0.2, bodyR * 0.34, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }

  const drawParticles = () => {
    for (const p of particles) {
      const s = scaleAt(p.z)
      if (s <= 0) continue
      const a = Math.min(p.life / p.maxLife, 1)
      ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`
      ctx.beginPath()
      ctx.arc(projX(p.x, s), projY(p.h, s), p.size * s * 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawFloats = () => {
    ctx.textAlign = 'center'
    for (const f of floats) {
      const s = scaleAt(f.z)
      if (s <= 0) continue
      const a = Math.min(f.life / 0.85, 1)
      ctx.save()
      ctx.globalAlpha = a
      ctx.font = `800 ${Math.max(13 * s * 1.6, 11)}px system-ui, sans-serif`
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(10,25,50,0.55)'
      ctx.fillStyle = f.color
      const x = projX(f.x, s)
      const y = projY(f.h, s)
      ctx.strokeText(f.text, x, y)
      ctx.fillText(f.text, x, y)
      ctx.restore()
    }
  }

  /** 速度が上がるほど強くなる走行線。速度段が体感で分かるようにする。 */
  const drawSpeedLines = () => {
    const intensity = Math.min(0.3 + 0.7 * (speedStep() / GAUGE_FULL_STEP), 1.35)
    const n = Math.floor(4 + intensity * 12)
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + intensity * 0.28 + boostFlash * 0.4})`
    ctx.lineWidth = 2
    for (let i = 0; i < n; i++) {
      const seed = (i * 2654435761) % 1000
      const side = i % 2 === 0 ? -1 : 1
      const x = LW / 2 + side * (LW * 0.2 + ((seed * 0.37) % (LW * 0.32)))
      const t = (elapsed * (3 + intensity * 5) + seed * 0.013) % 1
      const y = horizonY() + t * (LH - horizonY())
      const len = 12 + t * 60 * (0.4 + intensity)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + side * t * 34, y + len)
      ctx.stroke()
    }
  }

  const drawHud = () => {
    const dist = Math.floor(distance)
    const mult = multiplierFor(feathers)

    ctx.save()
    ctx.textAlign = 'left'
    // 距離
    ctx.font = '800 26px system-ui, sans-serif'
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(10,25,50,0.5)'
    ctx.fillStyle = '#ffffff'
    const distText = `${dist.toLocaleString('en-US')}`
    // 単位を添える位置は、フォントを変える前に測っておく
    const dw = ctx.measureText(distText).width
    ctx.strokeText(distText, 12, 32)
    ctx.fillText(distText, 12, 32)
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.lineWidth = 3.5
    ctx.strokeText('m', 17 + dw, 32)
    ctx.fillText('m', 17 + dw, 32)

    // 倍率
    ctx.font = '800 15px system-ui, sans-serif'
    ctx.lineWidth = 4
    ctx.fillStyle = feathers > 0 ? '#ffd24a' : '#e8eef7'
    const multText = `×${mult.toFixed(2)}`
    ctx.strokeText(multText, 12, 52)
    ctx.fillText(multText, 12, 52)

    // 残り時間。これが唯一の終了条件なので、いちばん大きく出す
    const t = Math.max(timeLeft, 0)
    const urgent = t <= 10
    // 残り10秒を切ったら鼓動のように明滅させる(数字を読まなくても分かる)
    const beat = urgent ? 0.62 + 0.38 * Math.abs(Math.sin(elapsed * 5)) : 1
    ctx.textAlign = 'right'
    ctx.font = '800 30px system-ui, sans-serif'
    ctx.lineWidth = 5.5
    ctx.strokeStyle = 'rgba(10,25,50,0.5)'
    ctx.globalAlpha = beat
    ctx.fillStyle = urgent ? '#ff6b6b' : '#ffffff'
    // 秒は切り上げ。残り 0.4 秒で「0」と出ると、まだ滑れるのに終わったように見える
    const secText = `${Math.ceil(t)}`
    ctx.strokeText(secText, LW - 16, 34)
    ctx.fillText(secText, LW - 16, 34)
    const sw = ctx.measureText(secText).width
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.lineWidth = 3.5
    ctx.strokeText('秒', LW - 18 - sw, 34)
    ctx.fillText('秒', LW - 18 - sw, 34)
    ctx.globalAlpha = 1

    // 速度ゲージ
    const gw = 96
    const gx = LW - 16 - gw
    const gy = 40
    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(10,25,50,0.35)'
    ctx.beginPath()
    ctx.roundRect(gx, gy, gw, 8, 4)
    ctx.fill()
    const step = speedStep()
    const ratio = Math.min(step / GAUGE_FULL_STEP, 1)
    // 次の段までの進み具合。あと少しで上がると分かると、無理な突っ込みを我慢する動機になる
    if (step < GAUGE_FULL_STEP) {
      const nextRatio = (step + (cleanT % STEP_TIME) / STEP_TIME) / GAUGE_FULL_STEP
      ctx.fillStyle = 'rgba(125,220,255,0.4)'
      ctx.beginPath()
      ctx.roundRect(gx, gy, gw * nextRatio, 8, 4)
      ctx.fill()
    }
    if (ratio > 0) {
      const g = ctx.createLinearGradient(gx, 0, gx + gw, 0)
      g.addColorStop(0, '#7ddcff')
      g.addColorStop(1, '#ffd24a')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.roundRect(gx, gy, gw * ratio, 8, 4)
      ctx.fill()
    }
    // ゲージを振り切ってもまだ加速する。振り切れたことが分かるよう脈打たせる
    if (step > GAUGE_FULL_STEP) {
      const over = Math.min((step - GAUGE_FULL_STEP) / GAUGE_FULL_STEP, 1)
      ctx.save()
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(elapsed * 6))
      ctx.strokeStyle = `rgba(255,${Math.round(210 - over * 130)},120,0.95)`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.roundRect(gx - 2, gy - 2, gw + 4, 12, 6)
      ctx.stroke()
      ctx.restore()
    }
    ctx.textAlign = 'right'
    ctx.font = '700 10px system-ui, sans-serif'
    ctx.lineWidth = 3
    ctx.fillStyle = '#e8eef7'
    ctx.strokeText(`SPEED ${speedStep()}`, LW - 16, gy + 22)
    ctx.fillText(`SPEED ${speedStep()}`, LW - 16, gy + 22)
    ctx.restore()
  }

  const drawLevelBanner = (th: SkiTheme) => {
    const since = elapsed - levelUpAt
    if (since < 0 || since >= 1.5) return
    const p = since / 1.5
    ctx.save()
    ctx.textAlign = 'center'
    ctx.globalAlpha = p < 0.75 ? 1 : (1 - p) / 0.25
    ctx.translate(LW / 2, LH * 0.3)
    const pop = 1 + 0.3 * Math.exp(-6 * p)
    ctx.scale(pop, pop)
    ctx.font = '800 34px system-ui, sans-serif'
    ctx.lineWidth = 7
    ctx.strokeStyle = 'rgba(6,20,44,0.6)'
    ctx.fillStyle = '#ffffff'
    ctx.strokeText(`LEVEL ${level}`, 0, 0)
    ctx.fillText(`LEVEL ${level}`, 0, 0)
    ctx.font = '700 14px system-ui, sans-serif'
    ctx.lineWidth = 4
    ctx.strokeText(th.name, 0, 24)
    ctx.fillText(th.name, 0, 24)
    ctx.restore()
  }

  const drawReady = () => {
    ctx.save()
    ctx.fillStyle = 'rgba(8,22,48,0.35)'
    ctx.fillRect(0, 0, LW, LH)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(6,20,44,0.55)'
    ctx.font = '800 26px system-ui, sans-serif'
    ctx.strokeText('シャトポコスキー', LW / 2, LH * 0.36)
    ctx.fillText('シャトポコスキー', LW / 2, LH * 0.36)
    // ラケットも羽根も見ればわかるので、ここでは目的と操作だけ伝える
    ctx.font = '800 19px system-ui, sans-serif'
    ctx.lineWidth = 5
    ctx.fillStyle = '#ffd24a'
    ctx.strokeText(`${TIME_LIMIT}秒でどこまで行けるか！`, LW / 2, LH * 0.45)
    ctx.fillText(`${TIME_LIMIT}秒でどこまで行けるか！`, LW / 2, LH * 0.45)
    ctx.font = '700 15px system-ui, sans-serif'
    ctx.lineWidth = 4
    ctx.fillStyle = '#ffffff'
    ctx.strokeText('スワイプで移動してね', LW / 2, LH * 0.52)
    ctx.fillText('スワイプで移動してね', LW / 2, LH * 0.52)
    ctx.font = '800 16px system-ui, sans-serif'
    const blink = 0.55 + 0.45 * Math.sin(elapsed * 4)
    ctx.globalAlpha = blink
    ctx.strokeText('タップでスタート', LW / 2, LH * 0.63)
    ctx.fillText('タップでスタート', LW / 2, LH * 0.63)
    ctx.restore()
  }

  const render = () => {
    const th = currentTheme()
    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    // 転倒時の画面ゆれ
    if (shakeT > 0) {
      const k = shakeT / 0.4
      ctx.translate((Math.random() - 0.5) * 10 * k, (Math.random() - 0.5) * 10 * k)
    }

    ctx.clearRect(-20, -20, LW + 40, LH + 40)
    drawSky(th)
    drawRidges(th)
    drawSlope(th)

    // 奥のものから順に描く(手前が上に重なる)
    const drawables: Array<{ z: number; draw: () => void }> = []
    for (const t of sideTrees) drawables.push({ z: t.z, draw: () => drawTree(th, t.x, t.z, t.seed) })
    for (const o of obstacles) drawables.push({ z: o.z, draw: () => drawObstacle(th, o) })
    for (const it of items) drawables.push({ z: it.z, draw: () => drawItem(it) })
    drawables.sort((a, b) => b.z - a.z)
    for (const d of drawables) {
      if (d.z > Z_FAR + 6 || d.z < -2) continue
      // 通り過ぎた物は 2m かけて消す。足元に残ると自機と重なって見える
      ctx.globalAlpha = d.z < 0 ? Math.max(0, 1 + d.z / 2) : 1
      d.draw()
    }
    ctx.globalAlpha = 1

    drawParticles()
    drawSpeedLines()
    drawShatopoko()
    drawFloats()
    drawHud()
    drawLevelBanner(th)
    if (phase === 'ready') drawReady()

    // タイムアップの暗転と表示(結果モーダルは React 側)
    if (phase === 'over') {
      const t = Math.min((elapsed - diedAt) / 0.5, 1)
      ctx.fillStyle = `rgba(8,22,48,${0.35 * t})`
      ctx.fillRect(-20, -20, LW + 40, LH + 40)
      ctx.save()
      ctx.textAlign = 'center'
      ctx.globalAlpha = t
      const pop = 1 + 0.4 * Math.exp(-7 * t)
      ctx.translate(LW / 2, LH * 0.26)
      ctx.scale(pop, pop)
      ctx.font = '800 40px system-ui, sans-serif'
      ctx.lineWidth = 8
      ctx.strokeStyle = 'rgba(6,20,44,0.65)'
      ctx.fillStyle = '#ffd24a'
      ctx.strokeText('TIME UP!', 0, 0)
      ctx.fillText('TIME UP!', 0, 0)
      ctx.restore()
    }
  }

  // ---- ループ ----------------------------------------------------------

  const loop = (t: number) => {
    if (disposed) return
    const dt = Math.min((t - last) / 1000, 1 / 20)
    last = t
    if (dt > 0) update(dt)
    render()
    raf = requestAnimationFrame(loop)
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('keydown', onKeyDown)

  resize()
  toReady(true)
  last = performance.now()
  raf = requestAnimationFrame(loop)

  return {
    restart: () => {
      toReady()
    },
    snapshot,
    dispose: () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
