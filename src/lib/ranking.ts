import type { RankingEntry } from './types'

/** ランキングに残る件数。バックエンドの Ranking.SIZE と揃える。 */
export const RANKING_SIZE = 5

/**
 * このスコアを今から記録したときの順位。ランクインしないなら null。
 *
 * 昔のゲーセンの表と同じで、同点なら先に記録した方が上位。後から同じ点を出しても
 * 追い落とせないので、「自分より大きいか同点の記録の数 + 1」が順位になる。
 *
 * バックエンドの Ranking.rankFor と同じ規則。ここでの判定は名前入力を出すかどうかの
 * 先読みで、確定は登録時のサーバーの応答による(その間に他の人が記録することがある)。
 */
export function rankForScore(entries: RankingEntry[], score: number): number | null {
  const better = entries.filter((entry) => entry.score >= score).length
  const rank = better + 1
  return rank <= RANKING_SIZE ? rank : null
}

/** 名前入力を出してよいスコアか。0点でランクインを促してもうれしくないので除く。 */
export function canEnterRanking(entries: RankingEntry[], score: number): boolean {
  return score > 0 && rankForScore(entries, score) != null
}
