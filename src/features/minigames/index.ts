// ミニゲーム(/game)の公開窓口。ルートはここからだけ import する。
// 一覧データ(カタログ)は sitemap やセット開始アナウンスからも使う共通データなので src/lib/game-catalog.ts。
export { AdSlot } from './AdSlot'
export { GameGuide } from './GameGuide'
export { GameOverRanking } from './GameOverRanking'
export { RankingModal } from './RankingModal'
export type { GamePhase, MiniGameHandle } from './shared'

export { createShuttleFlapGame, levelOf } from './shuttleFlap'
export type { ShuttleFlapHandle } from './shuttleFlap'
export { createSmashRainGame, rainLevelOf } from './smashRain'
export { coinLevelOf, createCoinDropGame } from './coinDrop'
export { createCoinFlickGame, flickLevelOf } from './coinFlick'
export { TIME_LIMIT, createShatopokoSkiGame, skiLevelOf } from './shatopokoSki'
export type { SkiHandle, SkiSnapshot } from './shatopokoSki'
