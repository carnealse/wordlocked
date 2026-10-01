/**
 * seed.js
 * Deterministic daily puzzle selection.
 * The puzzle day runs midnight to midnight US Eastern time (EST/EDT), and
 * all players on the same Eastern date receive identical words.
 */

export const PUZZLE_TIME_ZONE = 'America/New_York'

const _zoneFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: PUZZLE_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})

/** Wall-clock parts in the puzzle time zone, as numbers. */
function zonedParts(ms) {
  const parts = {}
  for (const { type, value } of _zoneFormat.formatToParts(ms)) parts[type] = Number(value)
  return parts
}

/** Puzzle-day date string → 'YYYY-MM-DD' */
export function getToday(now = Date.now()) {
  const { year, month, day } = zonedParts(now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Epoch ms of the next puzzle-day midnight. */
export function getNextPuzzleTime(now = Date.now()) {
  const { year, month, day } = zonedParts(now)
  const midnightAsUtc = Date.UTC(year, month - 1, day + 1)
  // DST switches at 2am, so the offset a few hours before midnight is the offset at midnight.
  const p = zonedParts(midnightAsUtc)
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - midnightAsUtc
  return midnightAsUtc - offset
}

/**
 * Puzzle-day date of public puzzle #1.
 * Puzzle numbers increase by one each Eastern midnight after this day.
 */
export const LAUNCH_DATE = '2026-09-30'

/** Days elapsed since the RNG epoch. Seeds dials — not the public puzzle number. */
export function getDayIndex(dateStr) {
  const epoch = Date.UTC(2025, 0, 1)
  const today = new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.floor((today - epoch) / 86_400_000)
}

/** Public puzzle number. Launch day is #1. */
export function getPuzzleNumber(dateStr) {
  const launch = new Date(`${LAUNCH_DATE}T00:00:00Z`).getTime()
  const today = new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.floor((today - launch) / 86_400_000) + 1
}

/**
 * Mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * Returns a closure that produces floats in [0, 1).
 */
export function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/** FNV-1a string hash → uint32 */
export function hashStr(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * Selects one item from an array using the provided rng.
 * Advances rng exactly once.
 */
export function seededPick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * Fisher-Yates shuffle using the provided rng.
 * Returns a new shuffled array — does not mutate input.
 */
export function seededShuffle(arr, rng) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
