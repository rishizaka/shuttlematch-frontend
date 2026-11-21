---
name: verify
description: shuttlematch-frontend の変更が「本当に動くか」をエージェント自身で確かめる手順。起動→準備確認→実際のユーザー操作→証拠の記録→後片付けまで。コードを変更して完了を報告する前、「動作確認して」「検証して」と言われたとき、PR を作る前に使う。
---

# /verify — このリポジトリの検証手順

**ゴール**: 人間に確認を頼まず、エージェントだけで「変更が意図どおり動く」ことを示す証拠を揃える。
証拠のない「できました」は報告しない。

## 0. どこを・どのレベルで検証するか決める

1. `docs/feature-map.md` を開き、変更したファイルが属する機能を特定する。
2. その機能の「検証」欄に書かれたレベル（L1/L2/L3）を**全部**やる。
   地図に載っていないファイルを触った場合は、作業の最後に地図へ追記する（`/maintain-feature-map`）。
3. 判断に迷ったら一段上のレベルまでやる。UI を変えたら最低 L2。

## 1. L1: 静的チェックと単体テスト（常に必須）

```bash
npm run typecheck
fnm exec --using=22 npm run lint
fnm exec --using=22 npm run test
```

- ルートを追加・改名したら先に `npm run generate-routes`（忘れると `createFileRoute` の型が通らない）。
- `src/test/architecture.test.ts` が落ちたら、**テストを緩めるのではなく構造を直す**。
  ルール自体を変えるべきだと判断したら、そのことをユーザーに明示して相談する。
- 純粋な計算（スコア式・当たり判定・試合表の偏り判定など）を変えたら、テストも足す。

## 2. L2: 実際に画面を開いて確認する

### 起動
```bash
# backend(8080) が要る画面か？ 試合表・参加・ランキング・ログインは要る。静的ページ・ゲーム本体は不要。
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/actuator/health   # 200 なら起動済み
# 起動していなければ（別ターミナル相当で、バックグラウンド実行）:
#   cd ~/Develop/shuttlematch && ./run.sh
fnm exec --using=22 npm run dev    # run_in_background で起動する
```

**落とし穴（2026-11-21 に実際に踏んだ）**:
- **開発中のブラウザは API を `http://localhost:8080` へ直接呼ぶ**（`src/lib/api.ts`。vite のプロキシは通らない）。
  backend の CORS が許可しているのは既定で **`localhost:3000` と `localhost:5173` だけ**。
  それ以外のポートで dev サーバーを動かすと、SSR の画面は出るのにブラウザからの API がすべて CORS で失敗し、
  運営操作・参加などの E2E が一斉に落ちる（「backend が古い」と誤認しやすい。実際に誤認した）。
- **3000 番が別の worktree / 別リポジトリの dev サーバーに使われていることがある**
  （`shuttlematch-frontend-preview` など）。`lsof -iTCP:3000 -sTCP:LISTEN` → `lsof -p <PID> | grep cwd` で
  どのディレクトリのサーバーか確かめる。他人のサーバーは止めない。Playwright は既定で 3000 を
  `reuseExistingServer` するので、そのままだと**別のコードを検証してしまう**。
  - 代わりに **5173 番**で起動する（CORS 許可済み）: `fnm exec --using=22 npx vite dev --port 5173 --strictPort`
- **8080 の backend が今のコードとは限らない**（別ディレクトリから昔起動したものが残っている等。`lsof` で cwd と起動時刻を見る）。
  最新の backend で確かめたいときは、既存のものは止めずに別ポートで起動し、フロントもそこへ向ける:
  ```bash
  # backend（~/Develop/shuttlematch）: ポートと CORS 許可元を環境変数で変える
  SERVER_PORT=8081 APP_CORS_ALLOWED_ORIGINS=http://localhost:5173 JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew bootRun
  # frontend: SSR・ブラウザの両方の API 先を 8081 に（VITE_API_BASE_URL は両方に効く）
  VITE_API_BASE_URL=http://localhost:8081 fnm exec --using=22 npx vite dev --port 5173 --strictPort
  ```
- E2E が落ちたら、まず**変更前のコード（`git worktree add --detach <dir> origin/main`）を同じポート・同じ backend で
  動かして同じ spec を流し、比べる**。同じテストが同じように落ちるなら今回の変更のせいではない。
  ブラウザのコンソールを見れば CORS かどうかはすぐ分かるので、比べる前に一度見る。
- **既知の失敗**（2026-11-21 時点、origin/main でも再現）: `e2e/participant-self-number.spec.ts` の4件。
  試合表ページが SSR になってから、入力した名前がハイドレーションで消えて空のまま送信される
  （テストがハイドレーション完了を待っていない）。直るまでは、この4件の失敗は変更の良し悪しの判断に使わない。

### 準備ができたかの確認
```bash
until curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q 200; do sleep 1; done
```
- 試合表ページは SSR → ハイドレーションまで `main [inert]` で操作不可。操作は inert が外れてから。

### 実際のユーザー操作
- ブラウザ操作は Claude in Chrome（`claude-in-chrome` スキル）か、使い捨ての Playwright スクリプトで行う。
- 使い捨てスクリプトはスクラッチパッドに置き、`e2e/helpers.ts` の
  `quickCreateRoom` / `createRoomAsOrganizer` / `actAsOrganizer` / `fillFieldsStable` / `deleteRoom` を流用してよい。
- 見るべきもの:
  - 変更した操作をユーザーと同じ手順で一通り行い、期待した表示になるか
  - **ブラウザのコンソールにエラーが出ていないか**（特に React error #418 = hydration mismatch）
  - スマホ幅（390px 前後）でも崩れないか
  - ミニゲーム: 1プレイしてゲームオーバー → スコア表示 → ランキング欄まで

### 証拠の記録
- スクリーンショットをスクラッチパッドに保存し、報告にパスを書く（変更前/後があるとなおよい）。
- 実行したコマンドと結果（テスト件数・HTTP ステータス・コンソールエラーの有無）を報告に含める。

## 3. L3: E2E（backend が必要）

```bash
fnm exec --using=22 npm run e2e -- e2e/<spec>.spec.ts   # 関係する spec だけでよい
# 5173 で起動したサーバーに向けるとき（webServer の自動起動は無効になる。backend を 8081 にしたら E2E_API_BASE も合わせる）:
E2E_BASE_URL=http://localhost:5173 E2E_API_BASE=http://localhost:8080 fnm exec --using=22 npx playwright test e2e/<spec>.spec.ts
```
- 試合表の生成・再編成・早退/遅刻に触れたら `e2e/fairness.spec.ts` は必ず回す。
- ルームを作る副作用があるので直列実行（設定済み）。**本番向け `e2e:prod` はユーザーに確認してから**。

## 4. 後片付け

- 手動確認で作ったルームは削除する（`e2e/helpers.ts` の `deleteRoom` 相当の API）。
- 自分で起動した dev サーバー・backend は停止する（もともと起動していたものは止めない）。
- 一時スクリプトやスクショはスクラッチパッドに置き、リポジトリに残さない。

## 5. 報告の形

最後に次の3つのどれかで締める:
- **検証済み**: 何を・どのレベルで確認したか、証拠（コマンド結果・スクショのパス）
- **一部未検証**: 何ができなかったか、なぜか（例: backend が起動できない）、代わりに何を確認したか
- **失敗**: 何が落ちたか（出力を貼る）
