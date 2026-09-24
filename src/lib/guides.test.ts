import { describe, expect, it } from 'vitest'
import { GAMES } from '../components/game/catalog'
import { GUIDES } from './guides'

describe('guides', () => {
  it('id が重複しない', () => {
    const ids = GUIDES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('関連記事・関連ゲームのリンク先が実在する', () => {
    const ids = new Set(GUIDES.map((g) => g.id))
    const games = new Set(GAMES.map((g) => g.to))
    for (const g of GUIDES) {
      for (const id of g.relatedGuideIds ?? []) expect(ids).toContain(id)
      for (const to of g.relatedGames ?? []) expect(games).toContain(to)
    }
  })
})
