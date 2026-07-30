/**
 * AdSense のクライアント ID(パブリッシャー ID)。ページソースに出る公開情報なので秘匿は不要。
 * `ca-pub-` の数字部分がそのまま ads.txt の `pub-` にも使われる(同一の値)。
 */
export const ADSENSE_CLIENT_ID = 'ca-pub-6948488602238162'

/**
 * ミニゲームページに置く表示広告のスロット ID。
 * AdSense 管理画面で「広告ユニット」(表示広告)を作成すると発行される。
 * まだ作成していないので undefined のまま。`AdSlot` はこれが未設定のあいだ
 * プレースホルダーを表示し続ける(空のスロット ID で `<ins>` を出すと
 * コンソールにエラーが出るだけで広告も表示されないため)。
 *
 * 発行されたらここに文字列で設定するだけで本番に反映できる。
 */
export const ADSENSE_SLOT_ID: string | undefined = undefined
