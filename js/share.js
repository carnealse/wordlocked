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
  const lockY = 530
  centers.forEach((cx, i) => {
    drawLock(ctx, cx, lockY, locks[i])
    ctx.fillStyle = '#6868a0'
    ctx.font = '600 28px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`${LENGTHS[i]} LETTERS`, cx, lockY + 155)
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
 * Brushed silver-gold metal fill (diagonal light catch).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function metalFill(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  g.addColorStop(0,    '#8a7f68')
  g.addColorStop(0.22, '#c4b89a')
  g.addColorStop(0.42, '#f2ead4')
  g.addColorStop(0.58, '#d0c4a4')
  g.addColorStop(0.78, '#9a8f74')
  g.addColorStop(1,    '#6e6554')
  return g
}

/**
 * Padlock matching share-graphic-ref silhouette with metal finish
 * (not a flat white-border slab).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy  — center of lock body
 * @param {{ solved: boolean, tries: number }} result
 */
function drawLock(ctx, cx, cy, result) {
  // Reference-like proportions: wider body, larger face, thinner metal rim
  const bodyW = 168
  const bodyH = 150
  const radius = 20
  const face = 120
  const shackleStroke = 22
  const shackleOuter = 100
  const shackleRise = 76
  const bodyTop = cy - bodyH / 2
  const bodyLeft = cx - bodyW / 2

  const shackleBottom = bodyTop + 6
  const legX = shackleOuter / 2
  const archR = shackleOuter / 2
  const archCy = shackleBottom - shackleRise + archR

  function strokeShackle(width, style) {
    ctx.beginPath()
    ctx.moveTo(cx - legX, shackleBottom)
    ctx.lineTo(cx - legX, archCy)
    ctx.arc(cx, archCy, archR, Math.PI, 0, false)
    ctx.lineTo(cx + legX, shackleBottom)
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // Soft drop shadow under the whole lock
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8

  strokeShackle(
    shackleStroke,
    metalFill(
      ctx,
      cx - legX - shackleStroke,
      archCy - archR,
      cx + legX + shackleStroke,
      shackleBottom,
    ),
  )

  // Body
  roundRect(ctx, bodyLeft, bodyTop, bodyW, bodyH, radius)
  ctx.fillStyle = metalFill(ctx, bodyLeft, bodyTop, bodyLeft + bodyW, bodyTop + bodyH)
  ctx.fill()
  ctx.restore()

  // Outer edge darken + inner metal ridge on shackle
  strokeShackle(shackleStroke, 'rgba(40, 32, 20, 0.28)')
  strokeShackle(
    shackleStroke - 4,
    metalFill(
      ctx,
      cx - legX - shackleStroke,
      archCy - archR,
      cx + legX + shackleStroke,
      shackleBottom,
    ),
  )

  // Specular ridge on shackle
  ctx.beginPath()
  ctx.moveTo(cx - legX - 3, shackleBottom - 2)
  ctx.lineTo(cx - legX - 3, archCy)
  ctx.arc(cx, archCy, archR - 3, Math.PI, Math.PI * 1.4, false)
  ctx.strokeStyle = 'rgba(255, 248, 230, 0.55)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.stroke()

  // Inner bevel on body
  roundRect(ctx, bodyLeft + 2, bodyTop + 2, bodyW - 4, bodyH - 4, radius - 2)
  ctx.strokeStyle = 'rgba(40, 32, 20, 0.4)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Top highlight strip
  ctx.save()
  roundRect(ctx, bodyLeft + 3, bodyTop + 3, bodyW - 6, bodyH * 0.4, radius - 3)
  ctx.clip()
  const hi = ctx.createLinearGradient(cx, bodyTop, cx, bodyTop + bodyH * 0.4)
  hi.addColorStop(0, 'rgba(255, 250, 235, 0.4)')
  hi.addColorStop(1, 'rgba(255, 250, 235, 0)')
  ctx.fillStyle = hi
  ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH * 0.4)
  ctx.restore()

  // Recessed status face (centered; larger than the old white-slab look)
  const faceX = cx - face / 2
  const faceY = bodyTop + (bodyH - face) / 2
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(faceX - 2, faceY - 2, face + 4, face + 4)

  ctx.fillStyle = result.solved ? '#22c55e' : '#ef4444'
  ctx.fillRect(faceX, faceY, face, face)

  const faceCy = faceY + face / 2
  ctx.fillStyle = '#09090f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (result.solved) {
    ctx.font = '700 56px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText(String(result.tries), cx, faceCy + 2)
  } else {
    ctx.font = '700 52px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.fillText('✕', cx, faceCy + 3)
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
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
