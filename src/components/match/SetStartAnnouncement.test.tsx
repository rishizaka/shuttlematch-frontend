import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SetStartAnnouncement } from './SetStartAnnouncement'

describe('SetStartAnnouncement', () => {
  it('出場するセットではコートと4人の番号を表示する', () => {
    render(
      <SetStartAnnouncement
        setNumber={5}
        courtNumber={2}
        memberIndexes={[
          { index: 3, self: false },
          { index: 8, self: false },
          { index: 4, self: true },
          { index: 1, self: false },
        ]}
        identified
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('第5セット')).toBeInTheDocument()
    expect(screen.getByText('あなたは 2コート')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('出場しないセットでは休憩と表示し、ミニゲームを1つ紹介する', () => {
    render(
      <SetStartAnnouncement
        setNumber={5}
        courtNumber={null}
        memberIndexes={null}
        identified
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('今回は休憩です 🍵')).toBeInTheDocument()
    expect(screen.getByText('待ち時間にミニゲームどうぞ')).toBeInTheDocument()
    // セット番号でローテーション: 第5セット → (5-1) % 3 = 1 → スマッシュレイン
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/game/rain')
    expect(screen.getByText('スマッシュレイン')).toBeInTheDocument()
  })

  it('出場するセットにはミニゲーム導線を出さない', () => {
    render(
      <SetStartAnnouncement
        setNumber={5}
        courtNumber={2}
        memberIndexes={[
          { index: 3, self: false },
          { index: 8, self: false },
          { index: 4, self: true },
          { index: 1, self: false },
        ]}
        identified
        onClose={() => {}}
      />,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('自己申告していない閲覧者には出場情報を出さない', () => {
    render(
      <SetStartAnnouncement
        setNumber={5}
        courtNumber={null}
        memberIndexes={null}
        identified={false}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('第5セット')).toBeInTheDocument()
    expect(screen.queryByText('今回は休憩です 🍵')).not.toBeInTheDocument()
  })

  it('タップで閉じる', () => {
    const onClose = vi.fn()
    render(
      <SetStartAnnouncement
        setNumber={5}
        courtNumber={null}
        memberIndexes={null}
        identified
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(onClose).toHaveBeenCalled()
  })
})
