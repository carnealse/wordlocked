/**
 * share.js
 * Generates a spoiler-free share string and copies to clipboard.
 */

export function buildShareText(dayIndex, totalGuesses, maxGuesses, levelResults) {
  // levelResults: array of { solved: bool, tries: number } for each lock
  const lines = []
  lines.push(`WORDLOCKED #${dayIndex} — ${totalGuesses}/${maxGuesses} guesses`)
  lines.push('')

  const lengths = [4, 5, 6]
  levelResults.forEach((result, i) => {
    const icon  = result.solved ? '🔓' : '🔒'
    const tries = result.solved
      ? `${result.tries} ${result.tries === 1 ? 'try' : 'tries'}`
      : 'Failed'
    lines.push(`${icon} Lock ${i + 1} (${lengths[i]} letters): [${tries}]`)
  })

  lines.push('')
  lines.push('https://wordlocked.com')

  return lines.join('\n')
}

export async function copyShareText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older mobile browsers
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  }
}
