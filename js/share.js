/**
 * share.js
 * Spoiler-free share text + image card for end-of-day results.
 *
 * Lock artwork is the user's original share graphic asset — cropped and
 * composited via drawImage. No canvas path redrawing of the locks.
 */

const SITE_URL = 'https://wordlocked.com'
const LENGTHS = [4, 5, 6]

/** Untouched original lock graphic (user-provided). */
const LOCK_ART_SRC = 'assets/share-graphic-ref.png'

/**
 * Source crops inside assets/share-graphic-ref.png (720×420).
 * Solved = left lock (green face); failed = right lock (red ✕).
 * Face rect is relative to the solved crop — used only to stamp the try count.
 */
const SRC = {
  solved: { x: 60, y: 120, w: 160, h: 200, face: { x: 27, y: 89, w: 105, h: 87 } },
  failed: { x: 500, y: 120, w: 160, h: 200 },
}

/** @type {HTMLImageElement | null} */
let _lockArt = null

async function loadLockArt() {
  if (_lockArt?.complete && _lockArt.naturalWidth) return _lockArt
  const img = new Image()
  img.src = LOCK_ART_SRC
  await img.decode()
  _lockArt = img
  return img
}

/** @param {import('./state.js').LevelResult[]} results */
export function unlockedCount(results) {
  return results.filter(r => r.solved).length
}

/**
 * @param {import('./state.js').LevelResult[]} results
 * @returns {{ solved: boolean, tries: number }[]}
 */
function normalizeResults(results) {
  const out = results.map(r => ({ solved: !!r.solved, tries: r.tries ?? 0 }))
  while (out.length < 3) out.push({ solved: false, tries: 0 })
  return out.slice(0, 3)
}

/**
 * @param {number} puzzleNumber
 * @param {import('./state.js').LevelResult[]} results
 * @returns {string}
 */
export function buildShareText(puzzleNumber, results) {
  const locks = normalizeResults(results)
  const unlocked = unlockedCount(locks)

  const header = `WORDLOCKED #${puzzleNumber} — ${unlocked}/3 unlocked`

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
 * Composite a share card using the original lock graphic asset.
 * @param {number} puzzleNumber
 * @param {import('./state.js').LevelResult[]} results
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function buildShareCanvas(puzzleNumber, results) {
  const locks = normalizeResults(results)
  const unlocked = unlockedCount(locks)
  const art = await loadLockArt()

  const W = 1080
  const H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#09090f'
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, 520)
  glow.addColorStop(0, 'rgba(26, 26, 58, 0.9)')
  glow.addColorStop(1, 'rgba(9, 9, 15, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#e4e4f0'
  ctx.font = '700 72px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('WORDLOCKED', W / 2, 180)

  ctx.fillStyle = '#6868a0'
  ctx.font = '500 36px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.fillText(`#${puzzleNumber} — ${unlocked}/3 unlocked`, W / 2, 250)

  const scale = 1.55
  const destW = Math.round(SRC.solved.w * scale)
  const destH = Math.round(SRC.solved.h * scale)
  const centers = [W * 0.22, W * 0.5, W * 0.78]
  const lockMidY = 520

  centers.forEach((cx, i) => {
    const r = locks[i]
    const dx = Math.round(cx - destW / 2)
    const dy = Math.round(lockMidY - destH / 2)

    if (r.solved) {
      const s = SRC.solved
      ctx.drawImage(art, s.x, s.y, s.w, s.h, dx, dy, destW, destH)
      // Stamp try count onto the existing green face (asset pixels for the lock stay)
      const fx = dx + Math.round(s.face.x * scale)
      const fy = dy + Math.round(s.face.y * scale)
      const fw = Math.round(s.face.w * scale)
      const fh = Math.round(s.face.h * scale)
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(fx, fy, fw, fh)
      ctx.fillStyle = '#111111'
      ctx.font = `700 ${Math.round(56 * scale / 1.45)}px system-ui, -apple-system, "Segoe UI", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(r.tries), fx + fw / 2, fy + fh / 2 + 1)
    } else {
      const s = SRC.failed
      ctx.drawImage(art, s.x, s.y, s.w, s.h, dx, dy, destW, destH)
    }

    ctx.fillStyle = '#6868a0'
    ctx.font = '600 28px system-ui, -apple-system, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(`${LENGTHS[i]} LETTERS`, cx, dy + destH + 8)
  })

  ctx.fillStyle = '#3a3a58'
  ctx.font = '500 28px system-ui, -apple-system, "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('wordlocked.com', W / 2, H - 100)

  return canvas
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
 *
 * @param {number} puzzleNumber
 * @param {import('./state.js').LevelResult[]} results
 * @returns {Promise<'shared' | 'copied-image' | 'copied' | 'cancelled' | 'failed'>}
 */
export async function shareResult(puzzleNumber, results) {
  const text = buildShareText(puzzleNumber, results)

  let blob = null
  try {
    const canvas = await buildShareCanvas(puzzleNumber, results)
    blob = await canvasToPngBlob(canvas)
  } catch { /* image optional — text share still works */ }

  const file = blob
    ? new File([blob], `wordlocked-${puzzleNumber}.png`, { type: 'image/png' })
    : null

  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: 'WORDLOCKED', text, files: [file] })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'WORDLOCKED', text })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
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
