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
  starfield: boolean
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
    starfield: true,
    spins: 3,
    durationMs: 3600,
    color: 0xffd24a,
    label: '1ST',
  },
  2: {
    particles: 420,
    rings: 2,
    starfield: false,
    spins: 2,
    durationMs: 2800,
    color: 0xdfe9ff,
    label: '2ND',
  },
  3: {
    particles: 200,
    rings: 1,
    starfield: false,
    spins: 1,
    durationMs: 2200,
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
