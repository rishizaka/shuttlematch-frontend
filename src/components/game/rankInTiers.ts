/**
 * ランクインの祝福の「派手さ」の定義。順位が上ほど要素を足す。
 *
 * three.js を使うシーン本体(rankInScene.ts)とは別モジュールにしてある。
 * 呼び出し側は演出の長さだけを知りたいので、ここを静的 import しても
 * three.js は読み込まれない(シーン側は動的 import のまま分割される)。
 */

/** 順位ごとの派手さ。1位を上限に、順位が下がるほど要素を削る。 */
export interface TierConfig {
  particles: number
  rings: number
  /**
   * 順位ごとの世界観。1位は深宇宙(ワープアウト・星雲・惑星・彗星)、
   * 2位は昼の大海原(うねる海面・水平線・光の道・カモメ)、
   * 3位は大陸(見下ろす大地・メサ・砂塵)。夜 → 昼 → 昼、と順位が下がるほど
   * 舞台が地に足がつく。実体は rankIn*Stage.ts。
   * 見せ場が順に立ち上がるので、舞台を持たせるなら durationMs も長めが要る。
   */
  stage: 'cosmic' | 'ocean' | 'continent'
  /** プレートが回る回数。多いほど大げさに見える。 */
  spins: number
  durationMs: number
  /** 主色(金・銀・銅)。 */
  color: number
  label: string
}

export const RANK_IN_TIERS: Record<number, TierConfig> = {
  1: {
    particles: 900,
    rings: 3,
    stage: 'cosmic',
    spins: 3,
    // 減速しきったワープの先に惑星が昇り、彗星が横切るまでを見せる長さ。
    durationMs: 5600,
    color: 0xffd24a,
    label: '1ST',
  },
  2: {
    particles: 420,
    rings: 2,
    stage: 'ocean',
    spins: 2,
    // 水平線までうねりが続き、カモメが横切るまでを見せる長さ。
    durationMs: 4400,
    color: 0xdfe9ff,
    label: '2ND',
  },
  3: {
    particles: 200,
    rings: 1,
    stage: 'continent',
    spins: 1,
    // 地平線まで見渡してから、砂塵が横切るまでを見せる長さ。
    durationMs: 3600,
    color: 0xff9d4a,
    label: '3RD',
  },
}

/** 3D シーンで祝う順位か(4位以下は CSS だけの軽い演出にする)。 */
export function hasRankInScene(rank: number): boolean {
  return rank in RANK_IN_TIERS
}

/** 演出の長さ(ms)。呼び出し側の自動クローズに使う。 */
export function rankInDuration(rank: number): number {
  return RANK_IN_TIERS[rank]?.durationMs ?? 1200
}
