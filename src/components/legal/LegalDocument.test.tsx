import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LegalDocument } from './LegalDocument'
import { PRIVACY_LEAD, PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from '../../lib/legal'

describe('LegalDocument', () => {
  it('見出し・段落・箇条書き・参照リンクを描画する', () => {
    render(
      <LegalDocument
        title="テスト規約"
        updatedAt="2026-07-27"
        lead="前文です。"
        sections={[
          {
            heading: '1. 見出し',
            paragraphs: ['段落です。'],
            items: ['箇条書きです。'],
            links: [{ label: '参照先', href: 'https://example.com/' }],
          },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'テスト規約' })).toBeInTheDocument()
    expect(screen.getByText('2026年7月27日')).toBeInTheDocument()
    expect(screen.getByText('前文です。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '1. 見出し' })).toBeInTheDocument()
    expect(screen.getByText('段落です。')).toBeInTheDocument()
    expect(screen.getByText('箇条書きです。')).toBeInTheDocument()

    // 外部リンクは別タブで開き、リファラを渡さない
    const link = screen.getByRole('link', { name: '参照先' })
    expect(link).toHaveAttribute('href', 'https://example.com/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

/**
 * AdSense の審査・ポリシーで、広告 Cookie についての記載とオプトアウト先の明示が求められる。
 * 文面を整理した際にこれらが消えると審査に落ちるため、存在をテストで固定しておく。
 */
describe('プライバシーポリシーの広告に関する記載', () => {
  it('第三者配信広告・Cookie・オプトアウト先に触れている', () => {
    render(
      <LegalDocument
        title="プライバシーポリシー"
        updatedAt={PRIVACY_UPDATED_AT}
        lead={PRIVACY_LEAD}
        sections={PRIVACY_SECTIONS}
      />,
    )

    const body = document.body.textContent ?? ''
    expect(body).toContain('Google AdSense')
    expect(body).toContain('Cookie')
    expect(body).toContain('パーソナライズ広告を無効')
    expect(screen.getByRole('link', { name: 'Google の広告設定' })).toHaveAttribute(
      'href',
      'https://adssettings.google.com/',
    )
  })
})

/**
 * アクセス解析は Cookie を使わず個人を識別しないことを根拠に同意バナーを出していない。
 * その根拠がポリシーから消えると「何も告知せず計測している」状態になるので固定しておく。
 */
describe('プライバシーポリシーのアクセス解析に関する記載', () => {
  it('利用しているツールと、Cookie を使わない旨に触れている', () => {
    render(
      <LegalDocument
        title="プライバシーポリシー"
        updatedAt={PRIVACY_UPDATED_AT}
        lead={PRIVACY_LEAD}
        sections={PRIVACY_SECTIONS}
      />,
    )

    const body = document.body.textContent ?? ''
    expect(body).toContain('Cloudflare Web Analytics')
    expect(body).toContain('Cookie を使用せず')
    expect(body).toContain('個人として識別しません')
    // 「解析ツールを利用していません」という以前の記載が残っていないこと
    expect(body).not.toContain('アクセス解析ツールを利用していません')
  })
})
