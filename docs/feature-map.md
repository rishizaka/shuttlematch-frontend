# フィーチャーマップ

「ユーザーから見た機能」→「どのファイルが実現しているか」→「どう検証するか」の地図。
エージェントは作業の最初にここを見て、触る場所と完了の確かめ方を決める。

- 手順の実行は `/verify` スキル（`.claude/skills/verify/SKILL.md`）、
  地図と実物のずれの点検は `/maintain-feature-map` スキル。
- **機械的に固定していること**（`src/test/architecture.test.ts`）:
  - この文書にバッククォートで書いたパス（`src/` `e2e/` `public/` `docs/` で始まるもの）は実在する
  - `src/routes/` のルートファイルは全部、この文書のどこかに書かれている
  - `e2e/` の spec は全部、どこかの「検証」欄に書かれている
  - `src/` のテスト（`*.test.ts(x)`）は全部、ファイルそのものか親ディレクトリ（`src/features/room/` など）の形で書かれている
  - ルートやテストを足したのにここへ書き忘れると `npm run test` が落ちる。

**フィーチャー構成への移行中**: src/features/（機能名）/ に移った機能は、そのディレクトリを見れば全体が分かる。
まだ `components/` `lib/` に散らばっている機能は、下の各項目に列挙したファイルを見る。

検証レベルの凡例:
- **L1** = `npm run typecheck` + `fnm exec --using=22 npm run lint` + `fnm exec --using=22 npm run test`（常に必須）
- **L2** = dev サーバーで実際に画面を開いて確認（`/verify` の手順）
- **L3** = E2E（backend 8080 が必要。`fnm exec --using=22 npm run e2e -- <spec>`）
- **UI** = UI 回帰（`fnm exec --using=22 npm run e2e:ui`。backend 不要、CI で毎回走る）。下の「UI 回帰」参照

---

## 1. 試合表（中核機能）

### 1-1. 練習会（ルーム）を作る
- 入口: `/`（かんたん作成）、`/organizer/rooms/new`
- ファイル: `src/routes/index.tsx`, `src/routes/organizer/rooms.new.tsx`,
  `src/hooks/queries.ts`（`useQuickCreateRoom` / `useCreateRoom`）, `src/lib/api.ts`, `src/lib/local-store.ts`
- 検証: L3 `e2e/organizer-lifecycle.spec.ts`（作成→試合表→削除）

### 1-2. 試合表を見る・運営する
- 入口: `/rooms/{id}/matches`（旧 `/rooms/{id}` はここへリダイレクト）
- ファイル: `src/routes/rooms/$roomId_.matches.tsx`（ルーティング・SSR の loader・OGP だけ）, `src/routes/rooms/$roomId.tsx`,
  `src/features/matches-page/`（画面本体。下の2つと運営者用リンクを組み合わせる）,
  `src/features/match-schedule/`（試合表の表示。フィーチャー構成。`MatchScheduleList` / `MatchCard` / `SetStartAnnouncement` / `MatchesSkeleton`）,
  `src/features/room/`（ルームの運営と参加。フィーチャー構成。`ParticipantManager` / `ParticipantList` / `FixedPairEditor` / `RenameModal` / `RosterAccordion` / `ShareButtons`）,
  `src/components/room/QrModal.tsx`（運営者用リンクと共用）
- 操作: セット開始・取り消し、セット追加、早退・遅刻（復帰）、再編成、末尾参加者の削除（開始前のみ）
- 検証: L1 `src/features/match-schedule/` と `src/features/room/` のテスト, L3 `e2e/fairness.spec.ts`（公平性: 出場/休み回数・連続出場・ペア偏り）,
  `e2e/redirect.spec.ts`, UI `e2e/ui/matches-participant.spec.ts`（参加者視点・スマホ幅）
- 注意: 運営操作は運営者トークンが要る。E2E では `e2e/helpers.ts` の `createRoomAsOrganizer` / `actAsOrganizer` を使う
- 注意: SSR で中身ごと描画し、ハイドレーションが済むまでは画面全体が `inert`（操作不可）。E2E は `e2e/helpers.ts` の `gotoMatches` で inert が外れるのを待ってから操作する

### 1-3. 参加者として自分の番号を知る
- 入口: 共有リンク（短縮URL `/r/{code}`）→ 試合表ページで番号を選ぶ
- ファイル: `src/routes/r.$code.tsx`,
  `src/features/room/ClaimNumberModal.tsx`, `src/features/room/QuickJoinBanner.tsx`,
  `src/lib/guests.ts`
- 検証: L1 `src/features/room/ClaimNumberModal.test.tsx`, `src/lib/guests.test.ts`, L3 `e2e/participant-self-number.spec.ts`

### 1-4. 運営権を別の端末・共同運営者に渡す（運営者用リンク）
- 入口: 試合表ページの「運営者用リンク」（形は `/rooms/{id}/matches#organizer={トークン}`）
- ファイル: `src/features/organizer-link/`（フィーチャー構成。公開は `OrganizerLinkSection` と `readOrganizerTokenFromHash`）,
  共通部品 `src/lib/local-store.ts`（運営者トークンの保存）・`src/components/room/QrModal.tsx`
- 検証: L1 `src/features/organizer-link/organizer-link.test.ts`, `src/lib/api.test.ts`（運営者トークンを `X-Organizer-Token` で添える）, L3 `e2e/organizer-link.spec.ts`

### 1-5. 印刷用の試合表
- 入口: `/rooms/{id}/matches/print`
- ファイル: `src/routes/rooms/$roomId_.matches_.print.tsx`, `src/features/match-schedule/MatchScheduleList.tsx`
- 検証: UI `e2e/ui/matches-print.spec.ts`（白い覆いが全画面を覆い、全セットが見える）, L2（印刷プレビューで1ページに収まるか）
- 注意: 覆い（`position: fixed`）は body 直下へポータルで出す。ルートの中身は `animate-page-in`（transform）で包まれていて、
  その中の fixed は画面ではなくその要素が基準になる（モーダル類が全部ポータルなのも同じ理由）

### 1-6. 過去の開催・自分のルーム一覧
- 入口: `/past`, `/`（自分のルーム）
- ファイル: `src/routes/past.tsx`, `src/features/room-list/`（フィーチャー構成。`RoomCard` / `useMyRoomIdByPublicId`。
  公開一覧は roomId を返さないので `src/features/room-list/public-room-id.ts` で手元の roomId と突き合わせる）
- 検証: L1 `src/features/room-list/public-room-id.test.ts`, L2

### 1-7. 練習会の見積もり計算機・乱数表の例
- 入口: `/`
- ファイル: `src/features/practice-planner/`（フィーチャー構成。公開は `DoublesPracticePlanner` のみ）
- 検証: L1 `src/features/practice-planner/doubles-practice-plan.test.ts`, `src/features/practice-planner/doubles-practice-example.test.ts`

## 2. アカウント・管理者
- 入口: `/login`, `/signup`
- ファイル: `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/hooks/useCurrentUser.ts`, `src/lib/api.ts`
- 管理者モード: `/admin`（運営者本人だけが使う。noindex）— `src/routes/admin.tsx`, `src/lib/admin-token.ts`
- 検証: L2（backend 必須）

## 3. ミニゲーム（/game。マネタイズはここだけ）

### 3-1. ゲームハブ
- 入口: `/game`
- ファイル: `src/routes/game.tsx`, `src/lib/game-catalog.ts`（一覧データ。sitemap・ガイド・セット開始アナウンスも使う共通データなので lib）,
  `src/features/minigames/AdSlot.tsx`
- 検証: L1 `src/test/architecture.test.ts`（catalog とルートの対応）, L2

### 3-2. 各ゲーム（ページ＋コアの対）
コード本体は `src/features/minigames/`（フィーチャー構成。ルートは `index.ts` 経由でだけ import する）。
| ゲーム | ページ | コア |
|---|---|---|
| シャトルフラップ | `src/routes/game_.flap.tsx` | `src/features/minigames/shuttleFlap.ts` |
| スマッシュレイン | `src/routes/game_.rain.tsx` | `src/features/minigames/smashRain.ts` |
| 10円ゲーム | `src/routes/game_.coin.tsx` | `src/features/minigames/coinDrop.ts` |
| 10円はじき | `src/routes/game_.flick.tsx` | `src/features/minigames/coinFlick.ts` |
| シャトポコのスキー | `src/routes/game_.ski.tsx` | `src/features/minigames/shatopokoSki.ts` |

- 共通: `src/features/minigames/shared.ts`, `src/features/minigames/GameGuide.tsx`,
  ランキング `src/features/minigames/RankingBoard.tsx` / `src/features/minigames/GameOverRanking.tsx` / `src/features/minigames/ranking.ts`
- 検証: L1 `src/features/minigames/shuttleFlap.test.ts`, `src/features/minigames/shatopokoSki.test.ts`, `src/features/minigames/ranking.test.ts`,
  `src/test/architecture.test.ts`（GameGuide 必須・AdSlot はちょうど1つ）, L2（実際に1プレイしてゲームオーバー→ランキング表示まで）

## 4. コンテンツ（SEO・審査対策）
- ガイド記事: `/guide`, `/guide/{id}` — `src/routes/guide.tsx`, `src/routes/guide.index.tsx`, `src/routes/guide.$id.tsx`, `src/lib/guides.ts`
  （検証: L1 `src/lib/guides.test.ts`）
- リリースノート: `/releases`, `/release/{id}` — `src/routes/releases.tsx`, `src/routes/release.$id.tsx`, `src/lib/releases.ts`
- サービス紹介: `/about` — `src/routes/about.tsx`（ページ専用の CSS は `src/styles/about.css`）
- OGP / sitemap: `src/lib/og.ts`, `src/lib/sitemap.ts`
- 検証: L1 `src/lib/sitemap.test.ts`, L2（`<title>` と OG メタを確認）

## 5. 法務・広告・全体レイアウト
- 法務: `/privacy`, `/terms` — `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/features/legal/`（文面 `src/features/legal/legal.ts`）
  （改定時は `PRIVACY_UPDATED_AT` / `TERMS_UPDATED_AT` も更新）
- 全ページ共通: `src/routes/__root.tsx`（AdSense スクリプトはマウント後に DOM で追加。JSX に置かない）,
  `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`（法務ページへの導線は審査要件）,
  マイクロインタラクション `src/lib/motion.ts`
- アプリ内ブラウザ（Instagram 等）の案内: `src/components/layout/InAppBrowserNotice.tsx`, `src/components/ui/OpenInBrowserModal.tsx`,
  `src/lib/in-app-browser.ts`（Cloudflare のボット対策でアプリ内ブラウザからの作成が 403 になるため外のブラウザへ誘導）
  — 検証: L1 `src/lib/in-app-browser.test.ts`
- 広告設定: `src/lib/ads.ts`, `public/ads.txt`
- 検証: L1 `src/features/legal/LegalDocument.test.tsx`, `src/test/architecture.test.ts`
  （AdSlot は /game 配下のみ・AdSense の `<script>` を JSX に書かない）

## 6. 共通部品（機能ではないもの）
- UI 部品 `src/components/ui/`、型 `src/lib/types.ts`、API クライアント `src/lib/api.ts`、
  表示用の整形 `src/lib/format.ts`（日時・参加者名・ルームの既定タイトル）、`src/lib/date.ts`、`src/lib/clipboard.ts`、`src/lib/cn.ts`
- アクセス解析 `src/lib/analytics.ts`
- 検証: L1 `src/lib/api.test.ts`, `src/lib/format.test.ts`。触ったら、使っている機能の検証もやる（`grep -rn` で使い手を探す）

## リリース前の回帰セット
試合表まわり（1-1〜1-4）に触った PR は、L1 に加えて次の E2E を流す（backend が必要。手順は `/verify` の L3）:
`e2e/fairness.spec.ts`, `e2e/organizer-lifecycle.spec.ts`, `e2e/participant-self-number.spec.ts`, `e2e/organizer-link.spec.ts`, `e2e/redirect.spec.ts`

## UI 回帰（良くしたら、テストで固定する）
UI/UX を直したら、その改善が後の変更で戻らないようにテストで固定する。
- 仕組み: モック API `e2e/ui/mock-api.mjs`（固定データ `e2e/ui/fixtures/`）＋ 本番と同じビルドを `playwright.ui.config.ts` で開く。
  CI の「UI regression」（`.github/workflows/ui-regression.yml`）が PR ごとに走る。
- 見ているもの（画面ごとに1 spec。今は `e2e/ui/matches-participant.spec.ts` だけ）:
  コンソールエラー（hydration mismatch を含む）、スマホ幅での横スクロール、アクセシビリティ違反、スクショ。
- **アクセシビリティ違反は減らす一方にする**: 今ある違反は `e2e/ui/axe-known-violations.json` に載せて許容し、
  新しい違反が出たら落ちる。直したらリストからも消す（消し忘れもテストが落とす）。リストが改善の候補一覧。
- **見た目を意図して変えたら基準画像を更新する**: PR の UI regression が落ち、artifact `ui-regression-report` に差分画像が出る。
  意図どおりなら Actions → UI regression → Run workflow（`update_snapshots`）→ artifact `ui-screenshots` を
  `e2e/ui/__screenshots__/` に上書きコミット。基準画像は Linux 製だけが正（Mac で作った `-darwin.png` は gitignore 済み）。
- 画面を足すとき: 本物の backend の応答を取り、ID と時刻を固定値に置き換えて fixture にする。モックに無い API は 404 とログ（`[mock-api] 未定義`）になる。

