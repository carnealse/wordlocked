/**
 * seed.js
 * Deterministic daily puzzle selection.
 * The puzzle day is the calendar date in PUZZLE_TIME_ZONE, so every player
 * worldwide is on the same puzzle at the same moment.
 */

import { PUZZLE_TIME_ZONE } from './config.js'

// hourCycle h23: some engines otherwise report midnight as hour 24.
const zoneClock = new Intl.DateTimeFormat('en-US', {
  timeZone: PUZZLE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
})

/** Wall-clock fields in PUZZLE_TIME_ZONE at `instant`. */
function wallClock(instant) {
  const f = {}
  for (const { type, value } of zoneClock.formatToParts(instant)) f[type] = Number(value)
  return f
}

/** How far PUZZLE_TIME_ZONE is ahead of UTC at `instant`, in ms (negative in the Americas). */
function zoneOffsetMs(instant) {
  const w = wallClock(instant)
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** Puzzle day at `now`, as 'YYYY-MM-DD'. */
export function getPuzzleDate(now = new Date()) {
  const { year, month, day } = wallClock(now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * The instant the next puzzle day begins. Correct across DST changes:
 * the offset is re-read at the target instant, not assumed from `now`.
 */
export function nextPuzzleAt(now = new Date()) {
  const { year, month, day } = wallClock(now)
  const midnightAsUtc = Date.UTC(year, month - 1, day + 1)
  const guess = midnightAsUtc - zoneOffsetMs(now)
  return new Date(midnightAsUtc - zoneOffsetMs(new Date(guess)))
}

/**
 * Puzzle day of public puzzle #1.
 * Puzzle numbers increase by one at each midnight in PUZZLE_TIME_ZONE after this day.
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
