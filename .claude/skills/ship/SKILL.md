---
name: ship
description: 変更を「小さな PR」にして出す手順。最新の origin/main から worktree を切り、目的1つぶんの変更だけを載せ、/verify で検証し、証拠つきの PR を作って CI の結果まで確認する。「PR にして」「出して」「ship して」と言われたとき、作業が終わってコミット・push・PR 作成をするときに使う。main への直接 push の代わり。
---

# /ship — 小さな PR を出す

**ゴール**: 1つの目的だけを持つ、検証済みの小さな PR を作り、CI が通ったところまで見届ける。
**main への直接 push はしない**（main に入ると本番へ自動デプロイされるため。`CLAUDE.md` の「デプロイ」参照）。

## 0. 目的と大きさを決める

- **1 PR = 1 つの目的**。PR タイトルを1文で書けないなら分ける。
  - 例: 「ESLint 導入」と「検証用スキル追加」は別の目的 → 別 PR（少なくとも別コミット）。
  - リファクタと挙動変更を同じ PR に混ぜない。
- 大きさの目安: **差分 ~300 行以内**（`package-lock.json`・`src/routeTree.gen.ts` などの生成物は除く）。
  超えそうなら、独立して main に入れられる順に分割する（土台 → 使う側）。
  機械的な一括置換（lint の自動修正など）は行数が多くても1つの目的なのでよいが、他の変更と混ぜない。
- 分け方に迷ったら、何をどう分けるかをユーザーに提示してから進める。

## 1. 最新の origin/main から worktree を切る

**手元の main は古いことがある**（2026-11-21、33 コミット遅れていた）し、作業ツリーには
無関係な未コミット変更が混ざっていることが多い。ユーザーの作業ツリーには触らず、別の worktree で作る。

```bash
git fetch origin
BR=<type>/<短い名前>             # 例: feat/game-xxx, fix/matches-toast, chore/eslint
git worktree add -b "$BR" ".claude/worktrees/${BR#*/}" origin/main
cd ".claude/worktrees/${BR#*/}"
fnm exec --using=22 npm ci        # 数秒で終わる
```

- 作業ツリーにある変更を持っていくときは、**目的に関係するファイル・行だけ**を移す。
  - ファイルを丸ごと持っていけるのは、`git diff HEAD -- <file>` を見て差分が全部今回の目的のものだったときだけ。
  - それ以外は差分を見て必要な行だけを当てる。origin/main 側も変わっていることがあるので、
    当てたら必ず lint・型を通して整合を確かめる（ずれていたら origin/main に合わせて直す）。
- **ユーザーの作業ツリーで `git checkout -- <path>` / `git stash` / `git reset --hard` をしない。**
  一時的にファイルを戻して比べたいときは、比較用の worktree を別に切る（`git worktree add --detach <dir> origin/main`）。
- 戻せる状態を保つ: 一時的に書き換える前は `git diff > <scratchpad>/backup.patch` で退避する。
- zsh では `for f in $VAR` で単語分割されない。ファイル一覧のループは `while read` か配列を使う。

## 2. 変更する・検証する

- 変更したら **`/verify`** の手順で検証する（L1 は必須。UI を変えたら L2、試合表まわりは L3）。
- 機能やルートを足したり動かしたりしたら `docs/feature-map.md` も同じ PR で直す（構造テストが落ちて気づく）。
- E2E が落ちたら、**比較用の worktree で origin/main のまま同じ spec を流して比べる**。
  同じ件数・同じテストが落ちるなら環境の問題（古い backend など）。PR 本文にそう書いて先に進んでよい。

## 3. コミットする

- コミットは目的ごとに分ける。メッセージは既存の流儀に合わせる:
  `feat:` / `fix:` / `perf:` / `chore:` / `docs:` + 日本語で「何をしたか」、本文に「なぜ」。
- 末尾にはシステムから指示された Co-Authored-By 行を付ける。
- 秘密情報（`.env`、鍵、トークン）が混ざっていないかを `git diff --cached` で見てからコミットする。

## 4. push して PR を作る

```bash
git push -u origin "$BR"
gh pr create --base main --head "$BR" --title "<1文の目的>" --body-file - <<'EOF'
## 背景
<なぜこの変更が要るか。1〜3行>

## 変更
<何を変えたか。ファイル単位ではなく意味の単位で>

## 検証
- [x] npm run lint / typecheck / test（件数）
- [x] L2: <開いたページ・操作・確認したこと。コンソールエラーの有無>
- [ ] L3: <回した spec と結果。できなかったならその理由>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

- 「検証」欄には**実際にやったことだけ**を書く。できなかったことは `[ ]` のまま理由を書く。

## 5. CI を見届ける

```bash
# 起動まで少しかかる。run が現れるまで待ってから watch する
until [ -n "$(gh run list --branch "$BR" --limit 1 --json databaseId -q '.[0].databaseId')" ]; do sleep 5; done
gh run watch "$(gh run list --branch "$BR" --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

- 落ちたら原因を直して同じブランチに push し直す（PR は作り直さない）。

## 6. マージ（ユーザーの指示があるときだけ）

- **マージ = 本番デプロイ**。ユーザーが「マージして」と言うまではマージしない。
  前の PR でマージの許可をもらっていても、次の PR には適用しない。
- マージは過去の PR に合わせてマージコミット方式: `gh pr merge <番号> --merge`
- マージしたら main の CI/CD（`Build & Test` → `Deploy to VPS`）が success になるまで見届け、
  本番（https://s-match.net）で変更したページを開いて確認する（HTTP 200、コンソールエラー、変更点）。

## 7. 報告

- PR の URL、CI の結果、検証の内容（できなかったことを含む）。
- マージしたなら、デプロイの結果と本番での確認結果。
- 後片付けについて: マージ済みの worktree は `git worktree remove <path>` で消せることを伝える
  （ユーザーの作業ツリーにある、PR と同じパスの未追跡ファイルは pull の邪魔になるので、それも伝える）。
