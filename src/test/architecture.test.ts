/**
 * 構造ルールの機械チェック。
 *
 * CLAUDE.md に「お願い」として書いていたルールのうち、ソースを読めば判定できるものをここで固定する。
 * ルールは破られうるが、テストは CI で必ず走る（エージェントのミスを指示の書き足しではなく
 * チェックで防ぐ方針）。ルールを変えるときは CLAUDE.md とこのテストを同時に直すこと。
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { GAMES } from '../components/game/catalog'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const ROUTES = join(SRC, 'routes')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const rel = (p: string) => relative(ROOT, p)
const read = (p: string) => readFileSync(p, 'utf8')
const sourceFiles = walk(SRC).filter(
  (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.endsWith('routeTree.gen.ts'),
)
const routeFiles = walk(ROUTES).filter((p) => /\.tsx?$/.test(p))

/** 公開中のミニゲームのページ（lab の試作は除く）。 */
const gamePages = readdirSync(ROUTES)
  .filter((n) => /^game_\.[a-z]+\.tsx$/.test(n))
  .map((n) => join(ROUTES, n))

describe('ミニゲーム', () => {
  it('ゲームページが1つ以上ある（このテスト自体が空振りしていない）', () => {
    expect(gamePages.length).toBeGreaterThan(0)
  })

  it.each(gamePages.map((p) => [rel(p), p]))(
    '%s は GameGuide(本文)を持つ — 削ると AdSense 審査で「有用性の低いコンテンツ」になる',
    (_, p) => {
      expect(read(p)).toMatch(/<GameGuide[\s>]/)
    },
  )

  it.each(gamePages.map((p) => [rel(p), p]))(
    '%s の <AdSlot /> はちょうど1つ',
    (_, p) => {
      expect(read(p).match(/<AdSlot[\s/>]/g) ?? []).toHaveLength(1)
    },
  )

  it('catalog.ts のエントリと game_.{slug}.tsx が1対1で対応する', () => {
    const fromCatalog = GAMES.map((g) => g.to.replace(/^\/game\//, '')).sort()
    const fromRoutes = gamePages.map((p) => p.match(/game_\.([a-z]+)\.tsx$/)![1]).sort()
    expect(fromCatalog).toEqual(fromRoutes)
  })
})

describe('広告は /game に閉じる', () => {
  it('AdSlot を import してよいのは /game 配下のルートだけ', () => {
    const allowed = /^src\/routes\/game(_\.[^/]+)?\.tsx$/
    const offenders = sourceFiles
      .filter((p) => /import\s+\{[^}]*\bAdSlot\b[^}]*\}\s+from/.test(read(p)))
      .map(rel)
      .filter((p) => !allowed.test(p))
    expect(offenders).toEqual([])
  })

  it('AdSense の <script> を JSX に書かない（hydration mismatch #418 の原因。__root.tsx の useEffect で足す）', () => {
    const offenders = sourceFiles
      .filter((p) => p.endsWith('.tsx'))
      .filter((p) => /<script[^>]*(pagead2\.googlesyndication|adsbygoogle)/s.test(read(p)))
      .map(rel)
    expect(offenders).toEqual([])
  })
})

describe('フィーチャーマップ(docs/feature-map.md)が腐っていない', () => {
  const mapPath = join(ROOT, 'docs/feature-map.md')
  const map = read(mapPath)

  it('書かれているパスが実在する', () => {
    const paths = [...map.matchAll(/`((?:src|e2e|public|docs)\/[^`*\s]+)`/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(0)
    const missing = paths.filter((p) => !existsSync(join(ROOT, p)))
    expect(missing).toEqual([])
  })

  it('src/routes/ のルートファイルが全部書かれている', () => {
    const unlisted = routeFiles.map(rel).filter((p) => !map.includes(`\`${p}\``))
    // __root.tsx も「全ページ共通」として地図に載せる
    expect(unlisted).toEqual([])
  })
})
