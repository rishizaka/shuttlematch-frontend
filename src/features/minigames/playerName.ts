/**
 * ランキングに登録する名前。全ミニゲームで共有し、次に遊ぶときも引き継ぐ。
 * (サーバーの PlayerName と同じ上限。超える入力は登録時に 400 になる)
 */
export const PLAYER_NAME_KEY = 'shuttlematch:player-name'
export const PLAYER_NAME_MAX = 8
