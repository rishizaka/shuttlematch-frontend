# CLAUDE.md — shuttlematch-frontend

ShuttleMatch のフロントエンド（TanStack Start + Vite + React 19、SSR）。

## ローカル開発

- Node.js **22 以上が必須**。マシンのデフォルト node は v20 で、そのままだと vitest が起動エラー（`styleText` の `ERR_INVALID_ARG_VALUE`）になる。fnm に v22 が入っているので `fnm exec --using=22 <cmd>` で実行する。
- 開発: `fnm exec --using=22 npm run dev`（http://localhost:3000）
- 型チェック: `npm run typecheck`（v20 でも可）
- テスト（単体・vitest）: `fnm exec --using=22 npm run test`
- E2E（Playwright, ブラウザ操作）:
  - ローカル: **backend を 8080 で起動**したうえで `fnm exec --using=22 npm run e2e`
    （frontend の dev サーバーは Playwright が自動起動）。
  - 本番スモーク: `fnm exec --using=22 npm run e2e:prod`（`E2E_BASE_URL` を本番に向ける。
    QA用ルームを作成し最後に自動削除する）。
  - 仕様は `e2e/`:
    - `fairness`: 実際に試合表を生成しUIから操作(セット追加・早退・遅刻・再編成)しても、
      出場/休み回数・休みスパン(最大連続出場)・ペア偏り(同コート共起)が偏らないかを検証
      （6人1コート/10人2コート/13人2コート）。結果はUIがレンダするのと同じ試合表データで判定。
    - `organizer-lifecycle`（作成→試合表→削除）、`participant-self-number`（番号ハイライト）、
      `redirect`（旧URL→試合表）。
  - ルームを作る副作用があるので直列実行(`workers: 1`)。成果物は `.gitignore` 済み。

## ミニゲーム

現在5本（`flap` / `rain` / `coin` / `flick` / `ski`）。1本につき
**ページ `src/routes/game_.{slug}.tsx` とコア `src/components/game/{name}.ts` の対**で、
コアは canvas だけを受け取り React に依存しない（描画とゲームロジックはコア、
スコア表示・ランキング・シェアはページ側）。共通の型と体育館背景は `components/game/shared.ts`。

- 描画は**論理幅 360px 固定**で、`resize()` が DPR とクライアント幅から `scale` を出して
  `ctx.setTransform` する。高さ `LH` は縦横比から毎回決まるので、レイアウトを縦にも横にも
  効かせたいものは `LH` 基準で置く。
- 一覧は `components/game/catalog.ts` の 1 エントリ。ここに足すと `/game` のハブと
  セット開始アナウンスの「待ち時間にどうぞ」の両方に出る。
- **ランキングを持たせるなら backend の `MiniGame` enum に同じスラッグを足す**。
  忘れると登録 API が 400 を返し、結果画面のランキング欄だけが壊れる。
- 新しいルートを足したら `npm run generate-routes`（`tsr generate`）。忘れると
  `createFileRoute` の型が通らない。
- 純粋な計算(当たり判定・スコア式・弾道)はコアから export してテストする
  （`shuttleFlap.test.ts` / `shatopokoSki.test.ts`）。canvas ごと動かす必要はない。

## 広告・マネタイズ（/game に閉じる）

**マネタイズはミニゲーム（`/game`）のページだけに閉じる。試合表や TOP には広告を出さない。**

- 広告枠の実体は `src/components/game/AdSlot.tsx`。現在はダミー（`AD SPACE` のプレースホルダ）。
  各ゲームページは canvas の下に `<AdSlot />` を2つ並べている（同じ広告ユニットの繰り返し設置は
  AdSense のポリシー上問題ない）。以前あった「遊び方・コツ」の説明文（`GameGuide`）は
  広告面を確保するために削除した。canvas とのあいだの緩衝はレイアウトの
  `space-y-4`（1rem）のみなので、ゲームオーバーのモーダル操作直後に広告へ誤タップしやすい
  構成になっている点は把握しておくこと（AdSense では誤クリックは無効トラフィック扱い）。
- 法務ページは `src/lib/legal.ts` に文面、`src/routes/{privacy,terms}.tsx` が表示、
  `components/layout/Footer.tsx` が全ページから導線を出す（**フッターからの到達性は審査要件**）。
  文面を改定したら `PRIVACY_UPDATED_AT` / `TERMS_UPDATED_AT` も更新する。
  広告 Cookie とオプトアウト先の記載が消えていないかは
  `components/legal/LegalDocument.test.tsx` が固定している。
- 問い合わせ窓口は `contact@s-match.net`。実体は **Cloudflare Email Routing の転送**
  （s-match.net ゾーン → Email Routing → 宛先は運営者の個人メール）。受信専用なので、
  返信は個人メールから行うことになる。MX / SPF の TXT は Email Routing が自動で入れる
  （このドメインは他にメールを使っていないので競合しない）。疎通は `dig +short MX s-match.net`
  で `mx.cloudflare.net` 系が3件返ることで確認できる。
- AdSense のクライアント ID・スロット ID は `src/lib/ads.ts`。サイト確認用スクリプトは
  `__root.tsx` の head に本番ビルドでだけ載る（`import.meta.env.DEV` で分岐。Vite が
  ビルド時に静的展開するので env の設定忘れで開発サーバーに載ることはない）。
  `public/ads.txt` は設置済み（`google.com, pub-<ID>, DIRECT, f08c47fec0942fa0`。
  `ca-pub-` の数字部分がそのまま `pub-` になる、同一の値）。
- **未了**: `ADSENSE_SLOT_ID` が未設定。AdSense 管理画面で `/game` 用の表示広告ユニットを
  作成して発行された ID をここに設定するまで、`AdSlot` はプレースホルダーのまま。
  **審査が通ったら、AdSense の Auto ads はオフのままにしておくこと**（オンだと Google が
  試合表や TOP にも自動で広告を差し込みうる。ads.txt とスクリプトは全ページの head に
  乗っているため、Auto ads を止める歯止めは AdSense 側の設定しかない）。

## デプロイ（本番反映）

> **main に push すれば自動デプロイされる**（`.github/workflows/ci.yml`）。以下の手動手順は
> Actions が使えないときの緊急用。backend も同じ方式（`shuttlematch-backend` の `ci.yml`）。

**CI/CD（GitHub Actions）**
- `build`: Node22 で `npm ci` → `typecheck` → `vitest` → `build`。main への push と PR で発火。
  `dist.tgz` と **production の `node_modules.tgz`** を artifact 化。
- `deploy`: **main への push のときだけ**実行（PR では走らない）。`concurrency` で直列化。
  - `dist` を差し替え → `systemctl restart` → health check（最大120秒リトライ）
  - **失敗したら `dist.old` / `serve.mjs.prev` / `node_modules.old` へ自動ロールバック**
  - 最後に `https://s-match.net/` が 200 を返すか確認。
- **依存(node_modules)は runner 側で用意する。** EC2 はメモリ 912MB で backend が約半分を
  使っており、そこで `npm ci` を走らせると backend を OOM で巻き込む。**EC2 上で npm ci しないこと。**
- node_modules は 200MB 超あるため、`package-lock.json` の sha256 を EC2 と比較し、
  **変わったときだけ転送**する（通常のデプロイは dist のみで数秒）。
- **SSH の到達性**: EC2 の 22番は自宅IP(`14.8.61.161/32`)にしか開いていない。runner は
  GitHub OIDC で IAM ロール `github-actions-shuttlematch-deploy` を AssumeRole し、
  自分の IP を /32 で SG に一時追加 → 完了後（失敗時も `if: always()`）必ず revoke する。
  **22番を常時開放しない設計なので、この仕組みを外さないこと。**
- Secrets: `EC2_HOST` / `EC2_SSH_KEY`（frontend 専用 ed25519 鍵。EC2 の authorized_keys に
  `github-actions-deploy-frontend@shuttlematch` として登録済み）/ `AWS_ROLE_ARN` / `EC2_SG_ID`。
- **E2E は CI に入れていない**（本番にルームを作る副作用があるため）。リリース後の確認は
  手元から `npm run e2e:prod` を実行する。

**本番環境**
- EC2 インスタンス `shuttlematch-app`（`3.113.92.223`, ap-northeast-1, t3.micro）
- SSH: `ssh -i ~/.ssh/shuttlematch-key.pem ec2-user@3.113.92.223`（passwordless sudo 可）
- 公開URL: **https://s-match.net**（および `https://www.s-match.net`）
  - CloudFront `E2ZAQ39VPHE72R`（`d1yeqpydnk6epr.cloudfront.net`）が TLS を終端し、
    `/api/*` を backend(8080)、それ以外を frontend(3000) に振り分ける。
  - DNS は **Cloudflare**（レジストラも Cloudflare）。apex と `www` を CloudFront へ CNAME、
    **Proxy は DNS only（グレー雲）**。オレンジ雲にすると二重CDNになるので変更しないこと。
  - 証明書は ACM(us-east-1) の DNS 検証。検証用 CNAME を消すと自動更新に失敗するので残しておく。
  - オリジン直: `http://3.113.92.223:3000`（nginx なし、node が `0.0.0.0:3000` で直接公開。backend は 8080）
- systemd: `shuttlematch-frontend.service`（WorkingDir `~/frontend`、`node serve.mjs` → srvx で `dist/server/server.js` を SSR + `dist/client` を静的配信、PORT 3000）

**手順（frontend のコードを変更したとき）**

```bash
# 1. ローカルで本番ビルド（Node22）
cd ~/Develop/shuttlematch-frontend
fnm exec --using=22 npm run build            # dist/ を生成（server/ と client/）

# 2. EC2 へ転送し、現行 dist を dist.old にローテートして差し替え
KEY=~/.ssh/shuttlematch-key.pem; HOST=3.113.92.223
tar czf /tmp/sm-dist.tgz -C dist .
scp -i "$KEY" /tmp/sm-dist.tgz ec2-user@$HOST:/tmp/sm-dist.tgz
ssh -i "$KEY" ec2-user@$HOST '
  set -e; cd ~/frontend
  rm -rf dist.old; mv dist dist.old; mkdir dist
  tar xzf /tmp/sm-dist.tgz -C dist'

# 3. 再起動 & 確認
ssh -i "$KEY" ec2-user@$HOST '
  sudo systemctl restart shuttlematch-frontend
  sleep 3
  systemctl is-active shuttlematch-frontend
  curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/'
```

- 依存（package.json）を変更していなければ EC2 の `node_modules` は据え置きでよい。変更した場合は転送後に `cd ~/frontend && npm ci` が必要。
- **ロールバック**: `ssh ... 'sudo systemctl stop shuttlematch-frontend; cd ~/frontend; rm -rf dist; mv dist.old dist; sudo systemctl start shuttlematch-frontend'`

backend のデプロイ手順は `shuttlematch`（backend）リポジトリの CLAUDE.md を参照。
