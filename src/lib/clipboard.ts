/**
 * テキストをクリップボードにコピーする。
 * Clipboard API は secure context (HTTPS/localhost) でのみ使えるため、
 * HTTP 配信時は動かない。その場合は非表示 textarea 経由の execCommand にフォールバックする。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // フォールバックへ
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
