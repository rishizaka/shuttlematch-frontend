import { describe, expect, it } from 'vitest'
import { GAMES } from '../components/game/catalog'
import { GUIDES } from './guides'
import { GYMS } from './gyms'
import { RELEASES } from './releases'
import { buildSitemapXml, sitemapEntries, SITE_ORIGIN } from './sitemap'

const xml = buildSitemapXml('2026-08-10')
const paths = sitemapEntries('2026-08-10').map((e) => e.path)

describe('sitemap', () => {
  it('主要ページを載せる', () => {
    for (const p of ['/', '/about', '/past', '/game', '/guide', '/gym', '/releases', '/privacy', '/terms']) {
      expect(paths).toContain(p)
    }
  })

  it('ミニゲーム・ガイド記事・体育館レビュー・リリースノートは原本から自動で載る', () => {
    for (const g of GAMES) expect(paths).toContain(g.to)
    for (const g of GUIDES) expect(paths).toContain(`/guide/${g.id}`)
    for (const g of GYMS) expect(paths).toContain(`/gym/${g.id}`)
    for (const r of RELEASES) expect(paths).toContain(`/release/${r.id}`)
  })

  it('試合表と個人向けの導線は載せない', () => {
    // 試合表は番号の並びだけで実体が無く、練習会のたびに増える。
    // それ以外は検索から来ても意味が無いか、他人のルームに入る導線になる。
    for (const p of paths) {
      expect(p).not.toContain('/rooms/')
      expect(p).not.toContain('/join/')
      expect(p).not.toContain('/r/')
      expect(p).not.toContain('/organizer/')
      expect(p).not.toMatch(/^\/(login|signup)$/)
    }
  })

  it('絶対URLで、パスが重複しない', () => {
    expect(new Set(paths).size).toBe(paths.length)
    for (const p of paths) expect(xml).toContain(`<loc>${SITE_ORIGIN}${p}</loc>`)
  })

  it('sitemap の書式になっている', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
    // lastmod は 'YYYY-MM-DD' のみ
    for (const m of xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)) {
      expect(m[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
