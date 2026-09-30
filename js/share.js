/**
 * share.js
 * Spoiler-free share text + image card for end-of-day results.
 *
 * One row per lock. Each row shows one padlock icon per guess used,
 * so a row is never longer than MAX_GUESSES icons:
 *   - solved:      (guesses - 1) neutral locks, then a green lock
 *   - failed:      (MAX_GUESSES - 1) neutral locks, then a red lock
 *   - not reached: a single muted lock
 *
 * Icon: Phosphor "lock-fill" (MIT, (c) 2023 Phosphor Icons), embedded as
 * a path so there is no runtime dependency and no asset to load.
 */

import { LOCK_LENGTHS, LOCK_COUNT, MAX_GUESSES } from './config.js'

const SITE_URL = 'https://wordlocked.com'

const LOCK_PATH =
  'M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208' +
  'a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm-80,84a12,12,0,1,1,12-12A12,12,0,0,1,128,164Z' +
  'm32-84H96V56a32,32,0,0,1,64,0Z'

const COLOR = {
  bg:      '#09090f',
  title:   '#e4e4f0',
  sub:     '#6868a0',
  label:   '#e4e4f0',
  neutral: '#8a8ab8',
  muted:   '#3a3a58',
  green:   '#22c55e',
  red:     '#ef4444',
  footer:  '#3a3a58',
}

/** @param {import('./state.js').LevelResult[]} results */
export function unlockedCount(results) {
  return results.filter(r => r.solved).length
}

/**
 * Always returns one row per lock.
 * @param {import('./state.js').LevelResult[]} results
 * @returns {{ kind: 'solved' | 'failed' | 'unreached', tries: number }[]}
 */
function normalizeResults(results) {
  const rows = []
  for (let i = 0; i < LOCK_COUNT; i++) {
    const r = results[i]
    if (!r)            rows.push({ kind: 'unreached', tries: 0 })
    else if (r.solved) rows.push({ kind: 'solved', tries: r.tries })
    else               rows.push({ kind: 'failed', tries: MAX_GUESSES })
  }
  return rows
}

/**
 * The icon sequence for one row, as color keys.
 * @returns {('neutral' | 'green' | 'red' | 'muted')[]}
 */
function rowIcons(row) {
  if (row.kind === 'unreached') return ['muted']
  const misses = Array(row.kind === 'solved' ? row.tries - 1 : MAX_GUESSES - 1).fill('neutral')
  return [...misses, row.kind === 'solved' ? 'green' : 'red']
}

// ── TEXT ──────────────────────────────────────────────────────────

const TEXT_ICON = { neutral: '🔒', green: '🟩', red: '🟥', muted: '🔒' }

/**
 * @param {number} puzzleNumber
 * @param {import('./state.js').LevelResult[]} results
 */
export function buildShareText(puzzleNumber, results) {
  const rows = normalizeResults(results)

  const lines = rows.map((row, i) =>
    `${LOCK_LENGTHS[i]} Letters - ${rowIcons(row).map(k => TEXT_ICON[k]).join('')}`
  )

  return [
    `WORDLOCKED #${puzzleNumber}  ${unlockedCount(results)}/${LOCK_COUNT} unlocked`,
    '',
    ...lines,
    '',
    SITE_URL,
  ].join('\n')
}

// ── IMAGE ─────────────────────────────────────────────────────────

const W = 1080
const H = 960

const ICON_SIZE   = 100
const ICON_GAP    = 16
const LABEL_GAP   = 56
const ROW_TOP     = 400
const ROW_PITCH   = 150
const FONT        = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const LABEL_FONT  = `700 46px ${FONT}`

const lockPath = typeof Path2D === 'function' ? new Path2D(LOCK_PATH) : null

function drawLock(ctx, x, yCenter, color) {
  const s = ICON_SIZE / 256
  ctx.save()
  ctx.translate(x, yCenter - ICON_SIZE / 2)
  ctx.scale(s, s)
  ctx.fillStyle = color
  ctx.fill(lockPath)
  ctx.restore()
}

/**
 * Paints the whole card onto a 1080x960 context.
 * Separate from canvas creation so it can be run anywhere.
 */
export function drawShareCard(ctx, puzzleNumber, results) {
  const rows = normalizeResults(results)

  ctx.fillStyle = COLOR.bg
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, 520)
  glow.addColorStop(0, 'rgba(26, 26, 58, 0.9)')
  glow.addColorStop(1, 'rgba(9, 9, 15, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = COLOR.title
  ctx.font = `700 76px ${FONT}`
  ctx.fillText('WORDLOCKED', W / 2, 150)

  ctx.fillStyle = COLOR.sub
  ctx.font = `500 38px ${FONT}`
  ctx.fillText(`Puzzle #${puzzleNumber}  \u00b7  ${unlockedCount(results)}/${LOCK_COUNT} unlocked`, W / 2, 224)

  // Center the widest possible row (label + MAX_GUESSES icons) in the card.
  ctx.font = LABEL_FONT
  const labelW  = Math.ceil(Math.max(...LOCK_LENGTHS.map(n => ctx.measureText(`${n} Letters`).width)))
  const iconsW  = MAX_GUESSES * ICON_SIZE + (MAX_GUESSES - 1) * ICON_GAP
  const labelX  = Math.round((W - (labelW + LABEL_GAP + iconsW)) / 2)
  const iconsX  = labelX + labelW + LABEL_GAP

  rows.forEach((row, i) => {
    const y = ROW_TOP + i * ROW_PITCH

    ctx.textAlign = 'left'
    ctx.fillStyle = COLOR.label
    ctx.font = LABEL_FONT
    ctx.fillText(`${LOCK_LENGTHS[i]} Letters`, labelX, y)

    rowIcons(row).forEach((key, n) => {
      drawLock(ctx, iconsX + n * (ICON_SIZE + ICON_GAP), y, COLOR[key])
    })
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR.footer
  ctx.font = `500 30px ${FONT}`
  ctx.fillText('wordlocked.com', W / 2, H - 90)
}

/**
 * @param {number} puzzleNumber
 * @param {import('./state.js').LevelResult[]} results
 * @returns {HTMLCanvasElement}
 */
export function buildShareCanvas(puzzleNumber, results) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  drawShareCard(canvas.getContext('2d'), puzzleNumber, results)
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

// ── SHARE ─────────────────────────────────────────────────────────

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
    blob = await canvasToPngBlob(buildShareCanvas(puzzleNumber, results))
  } catch { /* image optional, text share still works */ }

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
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copied-image'
    } catch { /* fall through */ }
  }

  const ok = await copyToClipboard(text)
  return ok ? 'copied' : 'failed'
}
