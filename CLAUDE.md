# CLAUDE.md — shuttlematch-frontend

ShuttleMatch のフロントエンド（TanStack Start + Vite + React 19、SSR）。

## ローカル開発

- Node.js **22 以上が必須**。マシンのデフォルト node は v20 で、そのままだと vitest が起動エラー（`styleText` の `ERR_INVALID_ARG_VALUE`）になる。fnm に v22 が入っているので `fnm exec --using=22 <cmd>` で実行する。
- 開発: `fnm exec --using=22 npm run dev`（http://localhost:3000）
- 型チェック: `npm run typecheck`（v20 でも可）
- テスト: `fnm exec --using=22 npm run test`

## デプロイ（本番反映）

> CI/CD は未整備（`ci.yml` は backend の Build&Test のみ）。**デプロイは手動で、Claude に依頼して実施している**。将来的に CI/CD 化したい。

**本番環境**
- EC2 インスタンス `shuttlematch-app`（`3.113.92.223`, ap-northeast-1, t3.micro）
- SSH: `ssh -i ~/.ssh/shuttlematch-key.pem ec2-user@3.113.92.223`（passwordless sudo 可）
- 公開URL: **http://3.113.92.223:3000**（nginx なし、node が `0.0.0.0:3000` で直接公開。backend は 8080）
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
