/**
 * ミニゲームのカタログ。ゲームハブ(/game)の一覧と、
 * セット開始アナウンスの「待ち時間にどうぞ」ピックアップで共有する。
 */
export interface GameEntry {
  to: string
  icon: string
  iconBg: string
  name: string
  description: string
  bestKey: string
}

export const GAMES: GameEntry[] = [
  {
    to: '/game/flap',
    icon: '🏸',
    iconBg: 'from-sky-100 to-brand-100',
    name: 'シャトルフラップ',
    description: 'タップで浮かせて、ネットのすき間をくぐり抜けろ',
    bestKey: 'shuttlematch:shuttle-flap:best',
  },
  {
    to: '/game/rain',
    icon: '☔',
    iconBg: 'from-orange-100 to-rose-100',
    name: 'スマッシュレイン',
    description: '降り注ぐシャトルの雨を、左右によけて生き残れ',
    bestKey: 'shuttlematch:smash-rain:best',
  },
  {
    to: '/game/coin',
    icon: '🪙',
    iconBg: 'from-amber-100 to-yellow-100',
    name: '10円ゲーム',
    description: '駄菓子屋の名機。穴を飛び越え、下まで転がして10円ゲット',
    bestKey: 'shuttlematch:coin-drop:best',
  },
  {
    to: '/game/flick',
    icon: '🎯',
    iconBg: 'from-emerald-100 to-teal-100',
    name: '10円はじき',
    description: 'エレメカ風。長押しチャージではじいて、当たりポケットを狙え',
    bestKey: 'shuttlematch:coin-flick:best',
  },
  {
    to: '/game/ski',
    icon: '⛷️',
    iconBg: 'from-sky-100 to-indigo-100',
    name: 'シャトポコのスキー',
    description: '120秒の一本勝負。3本のコースを横スワイプ、加速して距離をかせげ',
    bestKey: 'shuttlematch:shatopoko-ski:best',
  },
]
