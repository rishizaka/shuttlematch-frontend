import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 各テスト後に DOM をクリーンアップする。
afterEach(() => {
  cleanup()
})
