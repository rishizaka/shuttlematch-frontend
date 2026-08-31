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
  `__root.tsx` の `useEffect` でマウント後に `document.head` へ動的に足す（本番ビルドでだけ。
  `import.meta.env.PROD` で分岐。Vite がビルド時に静的展開するので env の設定忘れで
  開発サーバーに載ることはない）。**JSX(SSR/ハイドレーション対象)には置いていない** —
  2026-08-27、AdSense のスクリプト自身が早いタイミングで `<head>` を書き換えることがあり、
  React が SSR した内容と食い違って hydration mismatch(React error #418)を起こすのを
  確認したため。原因の DOM 差分そのものは特定できていないが、AdSense タグの有無だけを
  切り替えて再現/非再現をローカルで複数回確認済み。マウント後に素の DOM 操作で足せば、
  React はこのタグの存在を最初から知らない(hydrate 対象外)ので衝突しない。
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
  `dist.tgz` を artifact 化。
- `deploy`: **main への push のときだけ**実行（PR では走らない）。`concurrency` で直列化。
  - `dist` を差し替え → VPS上で `npm ci --omit=dev` → `systemctl restart` → health check（最大120秒リトライ）
  - **失敗したら `dist.old` / `serve.mjs.prev` へ自動ロールバック**
  - 最後に `https://s-match.net/` が 200 を返すか確認。
- **依存(node_modules)はVPS上で `npm ci` する。** EC2時代(メモリ912MB)はrunner側でnode_modulesを
  ビルドして転送する必要があったが、**VPS(2GB)はメモリに余裕があるので毎回VPS上でnpm ciしてよい**
  （2026-08-31 AWS→VPS移行で単純化。数秒で終わる）。
- **SSH の到達性**: さくらのVPSはSSHを常時開けたまま（鍵認証のみ・パスワード認証は無効化済み）。
  EC2時代のようなIP一時開放・OIDC AssumeRoleの仕組みは不要になった。
- Secrets: `VPS_HOST` / `VPS_SSH_KEY`（frontend 専用 ed25519 鍵。VPS の authorized_keys に
  `github-actions-deploy-frontend@shuttlematch-vps` として登録済み）。
- **E2E は CI に入れていない**（本番にルームを作る副作用があるため）。リリース後の確認は
  手元から `npm run e2e:prod` を実行する。

**本番環境**
- さくらのVPS `160.16.52.211`（東京第2ゾーン、2GB、Ubuntu 24.04 LTS）
- SSH: `ssh -i ~/.ssh/shuttlematch-vps-key ubuntu@160.16.52.211`（sudoはNOPASSWD設定済み）
- 公開URL: **https://s-match.net**（および `https://www.s-match.net`）
  - **Cloudflare Tunnel**（`cloudflared`、トンネル名`shuttlematch`）がTLSを終端しVPSの3000番(frontend)へ
    振り分ける。`serve.mjs`が`/api/*`をさらに8080番(backend)へ中継するので、
    CloudFront時代と同じく同一オリジンでAPIを叩ける。設定は `/etc/cloudflared/config.yml`。
  - DNS は **Cloudflare**（レジストラも Cloudflare）。apex と `www` はトンネルへ**CNAME + オレンジ雲
    （Proxied）**（2026-08-31以前はCloudFront併用のためDNS onlyだったが、Tunnel経由に必要なので
    **今はオレンジ雲が正**。以前の「オレンジ雲にするな」の注意書きは逆になった）。
  - 証明書はCloudflareのUniversal SSLが自動管理(ACMのDNS検証は不要になった)。
  - オリジン直: `http://160.16.52.211:3000`。ただしVPSのufwがSSH以外の inbound を全て閉じているため、
    実際には Tunnel(アウトバウンド接続)経由でしか到達できない。
- systemd: `shuttlematch-frontend.service`（WorkingDir `~/frontend`、`node serve.mjs` → srvx で `dist/server/server.js` を SSR + `dist/client` を静的配信、PORT 3000）

**手順（frontend のコードを変更したとき）**

```bash
# 1. ローカルで本番ビルド（Node22）
cd ~/Develop/shuttlematch-frontend
fnm exec --using=22 npm run build            # dist/ を生成（server/ と client/）

# 2. VPS へ転送し、現行 dist を dist.old にローテートして差し替え
KEY=~/.ssh/shuttlematch-vps-key; HOST=160.16.52.211
tar czf /tmp/sm-dist.tgz -C dist .
scp -i "$KEY" /tmp/sm-dist.tgz ubuntu@$HOST:/tmp/sm-dist.tgz
ssh -i "$KEY" ubuntu@$HOST '
  set -e; cd ~/frontend
  rm -rf dist.old; mv dist dist.old; mkdir dist
  tar xzf /tmp/sm-dist.tgz -C dist'

# 3. 再起動 & 確認
ssh -i "$KEY" ubuntu@$HOST '
  sudo systemctl restart shuttlematch-frontend
  sleep 3
  systemctl is-active shuttlematch-frontend
  curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/'
```

- 依存（package.json）を変更していなければ VPS の `node_modules` は据え置きでよい。変更した場合は転送後に `cd ~/frontend && npm ci` が必要。
- **ロールバック**: `ssh ... 'sudo systemctl stop shuttlematch-frontend; cd ~/frontend; rm -rf dist; mv dist.old dist; sudo systemctl start shuttlematch-frontend'`

backend のデプロイ手順は `shuttlematch`（backend）リポジトリの CLAUDE.md を参照。
移行の経緯・落とし穴は `shuttlematch` リポジトリの `migration/README.md` を参照。
