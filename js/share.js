/**
 * share.js
 * Spoiler-free share text + image card for end-of-day results.
 */

const SITE_URL = 'https://wordlocked.com'
const LENGTHS = [4, 5, 6]

/** @param {import('./state.js').LevelResult[]} results */
export function unlockedCount(results) {
  return results.filter(r => r.solved).length
}

/**
 * Pad results to three locks (unreached levels count as failed / locked).
 * @param {import('./state.js').LevelResult[]} results
 * @returns {{ solved: boolean, tries: number }[]}
 */
function normalizeResults(results) {
  const out = results.map(r => ({ solved: !!r.solved, tries: r.tries ?? 0 }))
  while (out.length < 3) out.push({ solved: false, tries: 0 })
  return out.slice(0, 3)
}

/**
 * @param {number} dayIndex
 * @param {import('./state.js').LevelResult[]} results
 * @returns {string}
 */
export function buildShareText(dayIndex, results) {
  const locks = normalizeResults(results)
  const unlocked = unlockedCount(locks)

  const header = `WORDLOCKED #${dayIndex} — ${unlocked}/3 unlocked`

  const lines = locks.map((r, i) => {
    const label = `${LENGTHS[i]} letters`
    if (r.solved) {
      const unit = r.tries === 1 ? 'try' : 'tries'
      return `🔓 ${label}: ${r.tries} ${unit}`
    }
    return `🔒 ${label}: ✕`
  })

  return [header, '', ...lines, '', SITE_URL].join('\n')
}

/**
 * Draw the share card onto a canvas (matches media/share-graphic-ref.png layout).
 * @param {number} dayIndex
 * @param {import('./state.js').LevelResult[]} results
 * @returns {HTMLCanvasElement}
 */
export function buildShareCanvas(dayIndex, results) {
  const locks = normalizeResults(results)
  const unlocked = unlockedCount(locks)

  const W = 1080
  const H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#09090f'
  ctx.fillRect(0, 0, W, H)

  // Soft top glow
  const glow = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, 520)
  glow.addColorStop(0, 'rgba(26, 26, 58, 0.9)')
  glow.addColorStop(1, 'rgba(9, 9, 15, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Title
  ctx.fillStyle = '#e4e4f0'
  ctx.font = '700 72px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('WORDLOCKED', W / 2, 180)

  // Subtitle — unlocked metric (not guesses)
  ctx.fillStyle = '#6868a0'
  ctx.font = '500 36px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(`#${dayIndex} — ${unlocked}/3 unlocked`, W / 2, 250)

  // Three locks
  const centers = [W * 0.22, W * 0.5, W * 0.78]
  const lockY = 520
  centers.forEach((cx, i) => {
    drawLock(ctx, cx, lockY, locks[i])
    ctx.fillStyle = '#6868a0'
    ctx.font = '600 28px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`${LENGTHS[i]} LETTERS`, cx, lockY + 175)
  })

  // Footer
  ctx.fillStyle = '#3a3a58'
  ctx.font = '500 28px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('wordlocked.com', W / 2, H - 100)

  return canvas
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy  — center of lock body
 * @param {{ solved: boolean, tries: number }} result
 */
function drawLock(ctx, cx, cy, result) {
  const bodyW = 150
  const bodyH = 170
  const radius = 28
  const shackleR = 48
  const shackleStroke = 18
  const face = 78

  // Shackle
  ctx.beginPath()
  ctx.arc(cx, cy - bodyH / 2 + 10, shackleR, Math.PI, 0, false)
  ctx.strokeStyle = '#e4e4f0'
  ctx.lineWidth = shackleStroke
  ctx.lineCap = 'round'
  ctx.stroke()

  // Body
  roundRect(ctx, cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, radius)
  ctx.fillStyle = '#e4e4f0'
  ctx.fill()

  // Colored face
  const faceX = cx - face / 2
  const faceY = cy - face / 2 + 8
  ctx.fillStyle = result.solved ? '#22c55e' : '#ef4444'
  ctx.fillRect(faceX, faceY, face, face)

  // Try count or ✕
  ctx.fillStyle = '#09090f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (result.solved) {
    ctx.font = '700 48px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(String(result.tries), cx, cy + 8)
  } else {
    ctx.font = '700 44px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText('✕', cx, cy + 10)
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** @returns {Promise<Blob>} */
export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode share image'))
    }, 'image/png')
  })
}

/** Copies text to clipboard with a textarea fallback for older browsers. */
export async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* fall through */ }
  }

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

/**
 * Share image + text via Web Share API when available; otherwise clipboard.
 * Preference order: native files share → native text share → image clipboard → text clipboard.
 *
 * @param {number} dayIndex
 * @param {import('./state.js').LevelResult[]} results
 * @returns {Promise<'shared' | 'copied-image' | 'copied' | 'cancelled' | 'failed'>}
 */
export async function shareResult(dayIndex, results) {
  const text = buildShareText(dayIndex, results)
  const canvas = buildShareCanvas(dayIndex, results)
  let blob
  try {
    blob = await canvasToPngBlob(canvas)
  } catch {
    blob = null
  }

  const file = blob
    ? new File([blob], `wordlocked-${dayIndex}.png`, { type: 'image/png' })
    : null

  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: 'WORDLOCKED',
        text,
        files: [file],
      })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // fall through
    }
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'WORDLOCKED', text })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // fall through
    }
  }

  if (blob && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      return 'copied-image'
    } catch { /* fall through */ }
  }

  const ok = await copyToClipboard(text)
  return ok ? 'copied' : 'failed'
}
