/**
 * 運営者用リンク（別の端末・共同運営者に運営権を渡すリンク）。
 *
 * 試合表ページの「運営者用リンク」欄（コピー・QR 表示）と、リンクを開いたときに
 * URL のフラグメントから運営者トークンを読み取る処理。トークンの保存先は共通の lib/local-store。
 * 機能の外（routes など）からは、この index.ts で export しているものだけを使う。
 */
export { OrganizerLinkSection } from './OrganizerLinkSection'
export { readOrganizerTokenFromHash } from './organizer-link'
