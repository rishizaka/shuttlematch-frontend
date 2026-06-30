/** クラス名を結合する小さなユーティリティ (falsy は除外)。 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
