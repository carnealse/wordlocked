/**
 * share.js
 * Builds and copies a spoiler-free share string.
 */

const SITE_URL = 'https://wordlocked.com'

/**
 * @param {number}        dayIndex
 * @param {number}        totalGuesses
 * @param {number}        maxGuesses
 * @param {LevelResult[]} results      — [{solved, tries}, ...]
 * @returns {string}
 */
export function buildShareText(dayIndex, totalGuesses, maxGuesses, results) {
  const LENGTHS = [4, 5, 6]

  const header = `WORDLOCKED #${dayIndex} — ${totalGuesses}/${maxGuesses} guesses`

  const locks = results.map((r, i) => {
    const icon  = r.solved ? '🔓' : '🔒'
    const tries = r.solved
      ? `${r.tries} ${r.tries === 1 ? 'try' : 'tries'}`
      : 'Failed'
    return `${icon} Lock ${i + 1} (${LENGTHS[i]} letters): [${tries}]`
  })

  // Pad any unseen locks as locked (game over before reaching them)
  while (locks.length < 3) {
    const i = locks.length
    locks.push(`🔒 Lock ${i + 1} (${LENGTHS[i]} letters): [Not reached]`)
  }

  return [header, '', ...locks, '', SITE_URL].join('\n')
}

/** Copies text to clipboard with a textarea fallback for older browsers. */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* fall through */ }
  }

  // Fallback
  const el = Object.assign(document.createElement('textarea'), {
    value: text,
    style: 'position:fixed;top:-9999px;left:-9999px;opacity:0',
    readOnly: true,
  })
  document.body.appendChild(el)
  el.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(el)
  return ok
}
