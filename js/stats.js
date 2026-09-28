/**
 * stats.js
 * Tracks game statistics in localStorage and renders the stats modal.
 */

import { storage } from './storage.js'

const KEY = 'stats'

const DEFAULTS = {
  played:    0,
  wins:      0,
  streak:    0,
  maxStreak: 0,
  dist:      { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}

export function loadStats() {
  const saved = storage.get(KEY, {})
  return {
    ...DEFAULTS,
    ...saved,
    dist: { ...DEFAULTS.dist, ...(saved.dist ?? {}) },
  }
}

/**
 * Record a completed game result and persist.
 * @param {boolean} won
 * @param {number}  totalGuesses
 * @returns {Object} Updated stats
 */
export function recordResult(won, totalGuesses) {
  const stats = loadStats()
  stats.played++

  if (won) {
    stats.wins++
    stats.streak++
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak)
    const key = String(Math.min(5, Math.max(1, totalGuesses)))
    stats.dist[key] = (stats.dist[key] ?? 0) + 1
  } else {
    stats.streak = 0
  }

  storage.set(KEY, stats)
  return stats
}

/**
 * Renders stat values and distribution bars into the stats modal.
 * @param {Object}      stats
 * @param {number|null} lastGuessCount  Highlights the matching bar; null = no highlight
 */
export function renderStats(stats, lastGuessCount) {
  document.getElementById('stat-played').textContent    = stats.played
  document.getElementById('stat-winpct').textContent    = stats.played
    ? Math.round((stats.wins / stats.played) * 100)
    : 0
  document.getElementById('stat-streak').textContent    = stats.streak
  document.getElementById('stat-maxstreak').textContent = stats.maxStreak

  const maxVal  = Math.max(1, ...Object.values(stats.dist))
  const barsEl  = document.getElementById('dist-bars')
  barsEl.innerHTML = ''

  for (let g = 1; g <= 5; g++) {
    const count  = stats.dist[g] ?? 0
    const pct    = Math.max(8, Math.round((count / maxVal) * 100))
    const active = g === lastGuessCount

    const row = document.createElement('div')
    row.className = 'dist-row'
    row.innerHTML = `
      <span class="dist-label">${g}</span>
      <div class="dist-track">
        <div class="dist-bar${active ? ' dist-bar--active' : ''}" style="width:${pct}%">
          ${count}
        </div>
      </div>`
    barsEl.appendChild(row)
  }
}
