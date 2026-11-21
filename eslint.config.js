// ESLint（flat config）。
//
// 方針: エージェント／人のミスを「お願い」ではなく機械的に止めるための制約。
// - error だけを使い、warn は使わない（warn は誰も見ないので制約にならない）。
// - ルールを足すときは、既存コードの違反を直してから error で入れる。
//   どうしても例外が要る行は `// eslint-disable-next-line <rule> -- 理由` と理由を書く
//   （理由なしの disable は `reportUnusedDisableDirectives` と code review で弾く）。
// - CLAUDE.md に書いた構造ルール（GameGuide 必須など）は src/test/architecture.test.ts 側。
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactDom from 'eslint-plugin-react-dom'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      '.claude/**',
      'src/routeTree.gen.ts',
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // serve.mjs(本番の Node サーバー)と設定ファイル
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks, 'react-dom': reactDom },
    rules: {
      // React Compiler 系を含む推奨ルール一式。既定で warn のものも error に上げる。
      // set-state-in-effect: SSR では読めない localStorage を「マウント後に読んで setState」する箇所は
      // 意図的な例外として行ごとに理由つきで disable している。新規コードでは
      // useSyncExternalStore（$roomId_.matches.tsx 参照）を使うこと。
      ...Object.fromEntries(
        Object.keys(reactHooks.configs['recommended-latest'].rules).map((r) => [r, 'error']),
      ),

      // DOM まわり（eslint-plugin-react-dom の推奨一式 + 未知の属性）。すべて error。
      // no-unknown-property: JSX に `stroke-width` などの HTML/SVG 表記を書くと React が警告を出し
      // 属性が効かない（2026-11-21 に /about の SVG で60箇所見つけて修正）。camelCase で書く。
      // no-dangerously-set-innerhtml: 構造化データ(JSON-LD)の3箇所だけ理由つきで disable。
      ...Object.fromEntries(
        Object.keys(reactDom.configs.recommended.rules).map((r) => [r, 'error']),
      ),
      'react-dom/no-unknown-property': 'error',

      // 型の抜け穴を塞ぐ。
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off', // canvas の getContext 等で多用。型で表しにくい
      '@typescript-eslint/consistent-type-imports': 'error', // verbatimModuleSyntax と揃える
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // 本番に残りがちなデバッグ出力。
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // テスト・E2E・設定ファイルは console もデバッグ用途で許す。
    files: ['**/*.test.{ts,tsx}', 'e2e/**', '*.config.{js,ts}', 'serve.mjs'],
    rules: { 'no-console': 'off' },
  },
)
