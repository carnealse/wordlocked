/**
 * stats.js
 * Tracks game statistics in sealed storage (see vault.js) and renders the stats modal.
 *
 * Guess distribution is per lock. Each solved lock adds one count to the
 * bucket for how many guesses that lock took.
 */

import { readSealed } from './vault.js'
import { LOCK_LENGTHS, LOCK_COUNT, MAX_GUESSES } from './config.js'

const KEY = 'stats'
const GUESS_BUCKETS = Array.from({ length: MAX_GUESSES }, (_, i) => i + 1)
const DAY_MS = 86_400_000

/**
 * @typedef {Object} Stats
 * @property {number}   played
 * @property {number}   wins
 * @property {number}   streak         consecutive days won, reset by a loss or a missed day
 * @property {number}   maxStreak
 * @property {string[]} recordedDates  puzzle days already counted, oldest first
 * @property {string[]} wonDates       puzzle days won, oldest first (tracked from this build on)
 * @property {Array<Record<number, number>>} dist  per lock: guesses -> solves
 */

function emptyLockDist() {
  return Object.fromEntries(GUESS_BUCKETS.map(g => [g, 0]))
}

function emptyDist() {
  return Array.from({ length: LOCK_COUNT }, emptyLockDist)
}

function isPerLockDist(dist) {
  return Array.isArray(dist)
    && dist.length === LOCK_COUNT
    && dist.every(lock => lock && typeof lock === 'object' && !Array.isArray(lock))
}

const count = n => (Number.isInteger(n) && n > 0 ? n : 0)

/** @returns {Stats} */
export function loadStats() {
  const saved = readSealed(KEY) ?? {}
  return {
    played:        count(saved.played),
    wins:          count(saved.wins),
    streak:        count(saved.streak),
    maxStreak:     count(saved.maxStreak),
    recordedDates: Array.isArray(saved.recordedDates) ? saved.recordedDates : [],
    wonDates:      Array.isArray(saved.wonDates) ? saved.wonDates : [],
    dist: isPerLockDist(saved.dist)
      ? saved.dist.map(lock => ({ ...emptyLockDist(), ...lock }))
      : emptyDist(),
  }
}

function daysBetween(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS)
}

/**
 * Count each solved lock in the bucket for its own guess count.
 * A 1 / 3 / 5 solve increments three different bars — never a single clamped total.
 * @param {Stats} stats
 * @param {import('./state.js').LevelResult[]} results
 */
function addLockResults(stats, results) {
  if (!Array.isArray(results)) return
  results.forEach((result, i) => {
    if (!result?.solved || i >= LOCK_COUNT) return
    const tries = Math.min(MAX_GUESSES, Math.max(1, result.tries | 0))
    stats.dist[i][tries] = (stats.dist[i][tries] ?? 0) + 1
  })
}

/**
 * Record a completed game result and persist.
 * @param {import('./vault.js').VaultWriter} vault
 * @param {boolean} won
 * @param {import('./state.js').LevelResult[]} results
 * @param {string} [dateStr]  puzzle day, so a reload cannot count the same puzzle twice
 * @returns {Stats}
 */
function recordResult(vault, won, results, dateStr) {
  const stats = loadStats()
  if (dateStr && stats.recordedDates.includes(dateStr)) return stats

  const last = stats.recordedDates.at(-1)
  const missedDay = dateStr && last && daysBetween(last, dateStr) > 1

  stats.played++
  if (won) {
    stats.wins++
    if (dateStr) stats.wonDates.push(dateStr)
    stats.streak = missedDay ? 1 : stats.streak + 1
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak)
  } else {
    stats.streak = 0
  }

  addLockResults(stats, results)
  if (dateStr) stats.recordedDates.push(dateStr)

  vault.write(KEY, stats)
  return stats
}

/**
 * Fold a game that was already counted by an older build into the per-lock chart.
 * Does not change played / wins / streak.
 * @param {import('./vault.js').VaultWriter} vault
 * @param {string} dateStr
 * @param {Array<{ solved?: boolean, tries?: number }>} results
 * @returns {Stats}
 */
function backfillDistribution(vault, dateStr, results) {
  const stats = loadStats()
  if (!dateStr || stats.recordedDates.includes(dateStr)) return stats

  addLockResults(stats, results)
  stats.recordedDates.push(dateStr)
  vault.write(KEY, stats)
  return stats
}

/**
 * The functions that change stats, bound to the vault writer. Only code that was
 * handed the writer at startup can record results.
 * @param {import('./vault.js').VaultWriter} vault
 */
export function createStatsRecorder(vault) {
  return Object.freeze({
    recordResult:         (won, results, dateStr) => recordResult(vault, won, results, dateStr),
    backfillDistribution: (dateStr, results) => backfillDistribution(vault, dateStr, results),
  })
}

/**
 * Renders stat values and per-lock distribution bars into the stats modal.
 * @param {Stats} stats
 * @param {Array<{ solved?: boolean, tries?: number }>|null} highlightResults
 *        Solved locks highlight the matching bar. null = no highlight.
 */
export function renderStats(stats, highlightResults) {
  document.getElementById('stat-played').textContent    = stats.played
  document.getElementById('stat-winpct').textContent    = stats.played
    ? Math.round((stats.wins / stats.played) * 100)
    : 0
  document.getElementById('stat-streak').textContent    = stats.streak
  document.getElementById('stat-maxstreak').textContent = stats.maxStreak

  const barsEl = document.getElementById('dist-bars')
  barsEl.innerHTML = ''

  const highlights = Array(LOCK_COUNT).fill(null)
  if (Array.isArray(highlightResults)) {
    highlightResults.forEach((result, i) => {
      if (result?.solved && i < LOCK_COUNT) highlights[i] = result.tries
    })
  }

  stats.dist.forEach((lockDist, lockIdx) => {
    const maxVal = Math.max(1, ...GUESS_BUCKETS.map(g => lockDist[g] ?? 0))
    const col = document.createElement('div')
    col.className = 'dist-col'

    const head = document.createElement('div')
    head.className = 'dist-col__head'
    head.innerHTML = `<span class="dist-col__len">${LOCK_LENGTHS[lockIdx]}</span><span class="dist-col__unit">LETTERS</span>`
    col.appendChild(head)

    GUESS_BUCKETS.forEach(g => {
      const count  = lockDist[g] ?? 0
      const pct    = Math.max(8, Math.round((count / maxVal) * 100))
      const active = highlights[lockIdx] === g

      const row = document.createElement('div')
      row.className = 'dist-row'
      row.innerHTML = `
        <span class="dist-label">${g}</span>
        <div class="dist-track">
          <div class="dist-bar${active ? ' dist-bar--active' : ''}" style="width:${pct}%">
            ${count}
          </div>
        </div>`
      col.appendChild(row)
    })

    barsEl.appendChild(col)
  })
}
