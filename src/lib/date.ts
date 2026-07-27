/** 'YYYY-MM-DD' を「2026年7月27日」形式に整形する。解釈できない値はそのまま返す。 */
export function formatJapaneseDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return date
  return `${y}年${m}月${d}日`
}
