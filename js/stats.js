/**
 * stats.js
 * Tracks game statistics in localStorage and renders the stats modal.
 *
 * Guess distribution is per lock (4, 5, and 6 letters). Each solved lock
 * adds one count to the bucket for how many guesses that lock took.
 */

import { storage } from './storage.js'

const KEY = 'stats'
const LOCKS = 3
const GUESS_BUCKETS = [1, 2, 3, 4, 5]

function emptyLockDist() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

function emptyDist() {
  return Array.from({ length: LOCKS }, emptyLockDist)
}

function isPerLockDist(dist) {
  return Array.isArray(dist)
    && dist.length === LOCKS
    && dist.every(lock => lock && typeof lock === 'object' && !Array.isArray(lock))
}

const DEFAULTS = {
  played:    0,
  wins:      0,
  streak:    0,
  maxStreak: 0,
  recordedDates: [],
  dist:      emptyDist(),
}

export function loadStats() {
  const saved = storage.get(KEY, {})
  const dist = isPerLockDist(saved.dist)
    ? saved.dist.map(lock => ({ ...emptyLockDist(), ...lock }))
    : emptyDist()

  return {
    ...DEFAULTS,
    ...saved,
    recordedDates: Array.isArray(saved.recordedDates) ? saved.recordedDates : [],
    dist,
  }
}

/**
 * Count each solved lock in the bucket for its own guess count.
 * A 1 / 3 / 5 solve increments three different bars — never a single clamped total.
 * @param {Object} stats
 * @param {Array<{ solved?: boolean, tries?: number }>} results
 */
function addLockResults(stats, results) {
  if (!Array.isArray(results)) return
  results.forEach((result, i) => {
    if (!result?.solved || i >= LOCKS) return
    const tries = Math.min(5, Math.max(1, result.tries | 0))
    const key = String(tries)
    stats.dist[i][key] = (stats.dist[i][key] ?? 0) + 1
  })
}

/**
 * Record a completed game result and persist.
 * @param {boolean} won
 * @param {Array<{ solved?: boolean, tries?: number }>} results
 * @param {string} [dateStr]  UTC day, so a reload cannot count the same puzzle twice
 * @returns {Object} Updated stats
 */
export function recordResult(won, results, dateStr) {
  const stats = loadStats()
  if (dateStr && stats.recordedDates.includes(dateStr)) return stats

  stats.played++

  if (won) {
    stats.wins++
    stats.streak++
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak)
  } else {
    stats.streak = 0
  }

  addLockResults(stats, results)
  if (dateStr) stats.recordedDates.push(dateStr)

  storage.set(KEY, stats)
  return stats
}

/**
 * Fold a game that was already counted by an older build into the per-lock chart.
 * Does not change played / wins / streak.
 * @param {string} dateStr
 * @param {Array<{ solved?: boolean, tries?: number }>} results
 * @returns {Object}
 */
export function backfillDistribution(dateStr, results) {
  const stats = loadStats()
  if (!dateStr || stats.recordedDates.includes(dateStr)) return stats

  addLockResults(stats, results)
  stats.recordedDates.push(dateStr)
  storage.set(KEY, stats)
  return stats
}

/**
 * Renders stat values and per-lock distribution bars into the stats modal.
 * @param {Object} stats
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

  const highlights = Array(LOCKS).fill(null)
  if (Array.isArray(highlightResults)) {
    highlightResults.forEach((result, i) => {
      if (result?.solved && i < LOCKS) highlights[i] = result.tries
    })
  }

  stats.dist.forEach((lockDist, lockIdx) => {
    const maxVal = Math.max(1, ...GUESS_BUCKETS.map(g => lockDist[g] ?? 0))
    const col = document.createElement('div')
    col.className = 'dist-col'

    const head = document.createElement('div')
    head.className = 'dist-col__head'
    head.innerHTML = `<span class="dist-col__len">${lockIdx + 4}</span><span class="dist-col__unit">LETTERS</span>`
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
