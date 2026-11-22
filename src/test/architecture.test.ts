/**
 * 構造ルールの機械チェック。
 *
 * CLAUDE.md に「お願い」として書いていたルールのうち、ソースを読めば判定できるものをここで固定する。
 * ルールは破られうるが、テストは CI で必ず走る（エージェントのミスを指示の書き足しではなく
 * チェックで防ぐ方針）。ルールを変えるときは CLAUDE.md とこのテストを同時に直すこと。
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { GAMES } from '../lib/game-catalog'

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

  it('lib/game-catalog.ts のエントリと game_.{slug}.tsx が1対1で対応する', () => {
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

  it('e2e/ の spec が全部書かれている', () => {
    const specs = readdirSync(join(ROOT, 'e2e'))
      .filter((n) => n.endsWith('.spec.ts'))
      .map((n) => `e2e/${n}`)
    expect(specs.length).toBeGreaterThan(0)
    expect(specs.filter((p) => !map.includes(`\`${p}\``))).toEqual([])
  })

  it('src/ のテストが全部、ファイルか親ディレクトリの形で書かれている', () => {
    const tests = walk(SRC).filter((p) => /\.test\.tsx?$/.test(p)).map(rel)
    expect(tests.length).toBeGreaterThan(0)
    const listed = (p: string) => {
      if (map.includes(`\`${p}\``)) return true
      // 親ディレクトリは src/features/room/ のように3階層以上のものだけ認める
      // （`src/` や `src/lib/` で丸ごと済ませると、このチェックが空振りするため）
      const parts = p.split('/')
      for (let i = parts.length - 1; i >= 3; i--) {
        if (map.includes(`\`${parts.slice(0, i).join('/')}/\``)) return true
      }
      return false
    }
    expect(tests.filter((p) => !listed(p))).toEqual([])
  })
})

describe('フィーチャー構成(src/features)の境界', () => {
  const FEATURES = join(SRC, 'features')
  const features = existsSync(FEATURES)
    ? readdirSync(FEATURES).filter((n) => statSync(join(FEATURES, n)).isDirectory())
    : []
  // テストも含めた全ソース(テストが機能の中身を直接触るのも境界違反として扱う)
  const allFiles = walk(SRC).filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith('routeTree.gen.ts'))
  /** 機能を import してはいけない共通側。依存の向きは「機能 → 共通」だけ。 */
  const SHARED = ['components', 'lib', 'hooks', 'integrations'].map((d) => join(SRC, d))

  /** import 指定子を src 内の絶対パスに解決する(外部パッケージは null)。 */
  function resolveSpecifier(from: string, spec: string): string | null {
    if (spec.startsWith('.')) return resolve(dirname(from), spec)
    const alias = spec.match(/^[#@]\/(.*)$/)
    return alias ? join(SRC, alias[1]) : null
  }
  function importsOf(file: string): string[] {
    const src = read(file)
    return [
      ...src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]/g),
      ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1])
  }
  /** パスが属する機能名(機能の外なら null)。 */
  const featureOf = (p: string) => {
    const r = relative(FEATURES, p)
    return r.startsWith('..') || r === '' ? null : r.split('/')[0]
  }

  it.each(features.map((f) => [f]))('features/%s は公開窓口の index.ts を持つ', (f) => {
    expect(existsSync(join(FEATURES, f, 'index.ts'))).toBe(true)
  })

  it.each(features.map((f) => [f]))(
    'features/%s/index.ts は `export ... from` だけ(vite.config.ts で副作用なしと宣言しているため)',
    (f) => {
      const body = read(join(FEATURES, f, 'index.ts'))
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      // 正しい re-export(複数行の { } も含む)を全部取り除き、何か残れば違反。
      const reExport = /export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"][^'"]+['"];?/g
      const notReExport = body
        .replace(reExport, '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      expect(notReExport).toEqual([])
    },
  )

  it('機能の外からは index.ts 経由でだけ import する(中のファイルを直接 import しない)', () => {
    const offenders: string[] = []
    for (const file of allFiles) {
      for (const spec of importsOf(file)) {
        const target = resolveSpecifier(file, spec)
        if (!target) continue
        const f = featureOf(target)
        if (!f || featureOf(file) === f) continue // 機能の外への import / 同じ機能の中どうしは自由
        const viaIndex = [join(FEATURES, f), join(FEATURES, f, 'index'), join(FEATURES, f, 'index.ts')]
        if (!viaIndex.includes(target)) offenders.push(`${rel(file)} → ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('共通側(components/lib/hooks/integrations)は機能を import しない', () => {
    const offenders = allFiles
      .filter((file) => SHARED.some((d) => file.startsWith(d + '/')))
      .flatMap((file) =>
        importsOf(file)
          .filter((spec) => {
            const t = resolveSpecifier(file, spec)
            return t !== null && featureOf(t) !== null
          })
          .map((spec) => `${rel(file)} → ${spec}`),
      )
    expect(offenders).toEqual([])
  })
})
