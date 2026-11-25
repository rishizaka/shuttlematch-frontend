import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '../../components/ui/Toast'
import { OrganizerGettingStarted } from './OrganizerGettingStarted'

// 紙吹雪は Web Animations API(jsdom に無い)を使う演出なので、テストでは止める。
vi.mock('../../lib/motion', () => ({ burst: () => {} }))

const renderCard = (over: Partial<Parameters<typeof OrganizerGettingStarted>[0]> = {}) => {
  const props = {
    roomId: 'room-1',
    shareCode: 'abc12345',
    starting: false,
    onStartFirstSet: vi.fn(),
    onOpenOrganizerMenu: vi.fn(),
    ...over,
  }
  render(
    <ToastProvider>
      <OrganizerGettingStarted {...props} />
    </ToastProvider>,
  )
  return props
}

describe('OrganizerGettingStarted', () => {
  it('「リンクを送る → 第1セット開始」の2手を順に見せ、共有ボタンも置く', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: /当日はこの2つだけ/ })).toBeInTheDocument()
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
    expect(steps[0]).toContain('参加者にリンクを送る')
    expect(steps[1]).toContain('第1セット開始')
    expect(screen.getByRole('button', { name: /試合表を共有/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /QRを表示/ })).toBeInTheDocument()
  })

  it('「第1セット開始」を押すと開始する', () => {
    const props = renderCard()
    fireEvent.click(screen.getByRole('button', { name: '第1セット開始' }))
    expect(props.onStartFirstSet).toHaveBeenCalledTimes(1)
  })

  it('開始処理中は押せず、文言が「開始中…」になる(二重に押して2セット進まないように)', () => {
    const props = renderCard({ starting: true })
    const button = screen.getByRole('button', { name: '開始中…' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(props.onStartFirstSet).not.toHaveBeenCalled()
  })

  it('別端末で運営する人向けに、運営メニュー(運営者用リンク)を開ける', () => {
    const props = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /運営メニューを開く/ }))
    expect(props.onOpenOrganizerMenu).toHaveBeenCalledTimes(1)
  })
})
