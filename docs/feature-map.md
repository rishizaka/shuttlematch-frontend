# フィーチャーマップ

「ユーザーから見た機能」→「どのファイルが実現しているか」→「どう検証するか」の地図。
エージェントは作業の最初にここを見て、触る場所と完了の確かめ方を決める。

- 手順の実行は `/verify` スキル（`.claude/skills/verify/SKILL.md`）、
  地図と実物のずれの点検は `/maintain-feature-map` スキル。
- **機械的に固定していること**（`src/test/architecture.test.ts`）:
  - この文書にバッククォートで書いたパス（`src/` `e2e/` `public/` `docs/` で始まるもの）は実在する
  - `src/routes/` のルートファイルは全部、この文書のどこかに書かれている
  - ルートを足したのにここへ書き忘れると `npm run test` が落ちる。

**フィーチャー構成への移行中**: src/features/（機能名）/ に移った機能は、そのディレクトリを見れば全体が分かる。
まだ `components/` `lib/` に散らばっている機能は、下の各項目に列挙したファイルを見る。

検証レベルの凡例:
- **L1** = `npm run typecheck` + `fnm exec --using=22 npm run lint` + `fnm exec --using=22 npm run test`（常に必須）
- **L2** = dev サーバーで実際に画面を開いて確認（`/verify` の手順）
- **L3** = E2E（backend 8080 が必要。`fnm exec --using=22 npm run e2e -- <spec>`）

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
  `src/features/room/`（ルームの運営と参加。フィーチャー構成。`Lobby` / `ParticipantManager` / `ParticipantList` / `FixedPairEditor` / `RenameModal` / `RosterAccordion` / `ShareButtons`）,
  `src/components/room/QrModal.tsx`（運営者用リンクと共用）
- 操作: セット開始・取り消し、セット追加、早退・遅刻（復帰）、再編成、末尾参加者の削除（開始前のみ）
- 検証: L1 `src/features/match-schedule/` と `src/features/room/` のテスト, L3 `e2e/fairness.spec.ts`（公平性: 出場/休み回数・連続出場・ペア偏り）,
  `e2e/redirect.spec.ts`
- 注意: 運営操作は運営者トークンが要る。E2E では `e2e/helpers.ts` の `createRoomAsOrganizer` / `actAsOrganizer` を使う

### 1-3. 参加者として自分の番号を知る
- 入口: 共有リンク（短縮URL `/r/{code}`）→ 試合表ページで番号を選ぶ
- ファイル: `src/routes/r.$code.tsx`,
  `src/features/room/ClaimNumberModal.tsx`, `src/features/room/QuickJoinBanner.tsx`,
  `src/lib/guests.ts`
- 検証: L1 `src/features/room/ClaimNumberModal.test.tsx`, L3 `e2e/participant-self-number.spec.ts`

### 1-4. 運営権を別の端末・共同運営者に渡す（運営者用リンク）
- 入口: 試合表ページの「運営者用リンク」（形は `/rooms/{id}/matches#organizer={トークン}`）
- ファイル: `src/features/organizer-link/`（フィーチャー構成。公開は `OrganizerLinkSection` と `readOrganizerTokenFromHash`）,
  共通部品 `src/lib/local-store.ts`（運営者トークンの保存）・`src/components/room/QrModal.tsx`
- 検証: L1 `src/features/organizer-link/organizer-link.test.ts`, L3 `e2e/organizer-link.spec.ts`

### 1-5. 印刷用の試合表
- 入口: `/rooms/{id}/matches/print`
- ファイル: `src/routes/rooms/$roomId_.matches_.print.tsx`, `src/features/match-schedule/MatchScheduleList.tsx`
- 検証: L2（印刷プレビューで1ページに収まるか）

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
- サービス紹介: `/about` — `src/routes/about.tsx`, `src/components/about/`
- OGP / sitemap: `src/lib/og.ts`, `src/lib/sitemap.ts`
- 検証: L1 `src/lib/sitemap.test.ts`, L2（`<title>` と OG メタを確認）

## 5. 法務・広告・全体レイアウト
- 法務: `/privacy`, `/terms` — `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/lib/legal.ts`
  （改定時は `PRIVACY_UPDATED_AT` / `TERMS_UPDATED_AT` も更新）
- 全ページ共通: `src/routes/__root.tsx`（AdSense スクリプトはマウント後に DOM で追加。JSX に置かない）,
  `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`（法務ページへの導線は審査要件）,
  マイクロインタラクション `src/lib/motion.ts`
- アプリ内ブラウザ（Instagram 等）の案内: `src/components/layout/InAppBrowserNotice.tsx`, `src/components/ui/OpenInBrowserModal.tsx`,
  `src/lib/in-app-browser.ts`（Cloudflare のボット対策でアプリ内ブラウザからの作成が 403 になるため外のブラウザへ誘導）
  — 検証: L1 `src/lib/in-app-browser.test.ts`
- 広告設定: `src/lib/ads.ts`, `public/ads.txt`
- 検証: L1 `src/components/legal/LegalDocument.test.tsx`, `src/test/architecture.test.ts`
  （AdSlot は /game 配下のみ・AdSense の `<script>` を JSX に書かない）
