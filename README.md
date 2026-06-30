# ShuttleMatch Frontend

バドミントンサークル管理アプリ **ShuttleMatch** のフロントエンド。
出欠管理とダブルスのランダムマッチング（1セッション15試合）を提供する。

バックエンド: [`shuttlematch-backend`](https://github.com/rishizaka/shuttlematch-backend)（Java 21 / Spring Boot, DDD）

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | React 19 + TanStack Start（SSR） |
| ルーティング | TanStack Router（ファイルベース） |
| データ取得 | TanStack Query |
| スタイル | Tailwind CSS v4 |
| ビルド | Vite |
| テスト | Vitest + Testing Library（jsdom） |
| アイコン | lucide-react |

## 前提

- **Node.js 22 以上**（`.node-version` に `22.23.1` を指定。fnm 等で自動切替推奨）
- バックエンド（`shuttlematch-backend`）がローカルの `http://localhost:8080` で起動していること

## セットアップ

```bash
npm install
cp .env.example .env   # 必要に応じて VITE_API_BASE_URL を編集
npm run dev            # http://localhost:3000
```

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバ（ポート 3000） |
| `npm run build` | 本番ビルド（SSR 出力） |
| `npm start` | ビルド済みサーバを起動 |
| `npm test` | ユニットテスト（一度だけ実行） |
| `npm run test:watch` | テストのウォッチ実行 |
| `npm run test:coverage` | カバレッジ計測 |
| `npm run typecheck` | 型チェック（`tsc --noEmit`） |
| `npm run generate-routes` | ルートツリーの再生成 |

## ディレクトリ構成

```
src/
├── routes/                       # ファイルベースルーティング
│   ├── __root.tsx                # ドキュメントシェル + ヘッダー
│   ├── index.tsx                 # ダッシュボード
│   ├── login.tsx / signup.tsx    # 認証（暫定）
│   ├── circles/$circleId.tsx     # サークル詳細
│   ├── sessions/
│   │   ├── $sessionId.tsx        # セッション詳細
│   │   └── $sessionId.matches.tsx# 試合表（全体 / 自分）
│   └── organizer/                # オーガナイザー向け操作
│       ├── sessions.new.tsx
│       └── sessions.$sessionId.participants.tsx
├── components/
│   ├── ui/                       # 汎用 UI（Button, Card, Field, Badge ...）
│   ├── layout/Header.tsx
│   ├── session/                  # SessionCard, ParticipantList, JoinButton
│   └── match/                    # MatchCard, MatchScheduleList, GenerateMatchesButton
├── hooks/
│   ├── useCurrentUser.ts         # 現在ユーザー / 既知 ID の購読
│   └── queries.ts                # TanStack Query のクエリ・ミューテーション
└── lib/
    ├── api.ts                    # バックエンド REST クライアント
    ├── types.ts                  # API レスポンスに対応する型
    ├── format.ts                 # 日時・ラベル整形
    └── local-store.ts            # 暫定ストア（後述）
```

## バックエンド連携と暫定実装

現状のバックエンドは Phase 1 MVP の API に対応しており、フロントは以下に依存している。

実装済みの API（`src/lib/api.ts`）:

- `POST /api/v1/users`, `GET /api/v1/users/{id}`
- `POST /api/v1/circles`, `GET /api/v1/circles/{id}`, `POST /api/v1/circles/{id}/members`
- `POST /api/v1/circles/{id}/sessions`, `GET /api/v1/sessions/{id}`
- `POST /api/v1/sessions/{id}/participants`, `DELETE /.../participants/{participantId}`
- `POST /api/v1/sessions/{id}/matches/generate`, `GET /api/v1/sessions/{id}/matches`

バックエンド未実装のため、フロント側で暫定対応している点（`src/lib/local-store.ts`）:

- **認証（Cognito）が未実装**。`signup` でユーザーを作成し identity を `localStorage` に保持、
  `login` は既存ユーザー ID で復元する暫定フロー。`createdBy` / `userId` はクライアントの
  identity をリクエストに渡している。
- **一覧取得 API が未実装**。作成・閲覧した circle / session の ID を `localStorage` に保持し、
  個別取得 API でダッシュボードを構成している。

> これらは認証（Cognito）とサーバ側一覧 API が入り次第、置き換える前提の薄いシム。

### 試合の表示について

試合のペア（`pairA` / `pairB`）は **ParticipantId** を参照する（ゲスト対応のため）。
表示名は「セッションの参加者一覧（ParticipantId → userId / guestName）」と
「`GET /users` で解決した userId → 名前」を突き合わせて解決している
（`src/components/match/MatchCard.tsx` の `buildParticipantNameLookup`）。

## テスト方針（TDD）

仕様に沿い、カスタム Hooks・ユーティリティ・ドメインロジックのユニットテストを重視。

- `src/lib/format.test.ts` — 日時・ラベル・表示名整形
- `src/lib/api.test.ts` — API クライアント（リクエスト整形・エラー処理）
- `src/components/match/MatchScheduleList.test.ts` — 試合フィルタ・名前ルックアップ
- `src/components/match/MatchCard.test.tsx` — 試合カードの描画
- `src/components/session/JoinButton.test.ts` — 参加可否ロジック

```bash
npm test
```

## デプロイ

仕様上のホスティングは S3 + CloudFront だが、本構成は **TanStack Start（SSR）** のため
配信には Node ランタイム（ECS Fargate / Lambda 等）が必要。静的配信に寄せる場合は
SPA 出力への切り替えを検討する。
