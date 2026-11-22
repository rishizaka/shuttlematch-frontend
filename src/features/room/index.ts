// ルーム(練習会)の運営と参加の公開窓口。試合表ページ(features/matches-page)が使う。
// 運営: 開始前のロビー・参加者管理・固定ペア・名前変更・共有。参加: 番号を選ぶ・かんたん参加・名簿。
// QR の表示(QrModal)は運営者用リンク(features/organizer-link)も使う共通部品なので components/room に残す。
export { ClaimNumberModal } from './ClaimNumberModal'
export { Lobby } from './Lobby'
export { ParticipantManager } from './ParticipantManager'
export { QuickJoinBanner } from './QuickJoinBanner'
export { RosterAccordion } from './RosterAccordion'
export { ShareButtons } from './ShareButtons'
