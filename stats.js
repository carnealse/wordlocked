/**
 * stats.js
 * Manages game statistics in localStorage and renders the stats modal.
 */

const KEY = 'wordlocked_stats'

const DEFAULT = {
  played:    0,
  wins:      0,
  streak:    0,
  maxStreak: 0,
  dist:      { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT, dist: { ...DEFAULT.dist } }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT,
      ...parsed,
      dist: { ...DEFAULT.dist, ...parsed.dist },
    }
  } catch {
    return { ...DEFAULT, dist: { ...DEFAULT.dist } }
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats))
  } catch {}
}

/**
 * Record a completed game.
 * @param {boolean} won
 * @param {number}  totalGuesses  1-5 (how many guesses used in total)
 * @param {string}  lastPlayedDay YYYY-MM-DD of last play (to break streaks)
 */
export function recordResult(won, totalGuesses, todayStr) {
  const stats = loadStats()

  stats.played++

  if (won) {
    stats.wins++
    stats.streak++
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak)
    const clampedGuesses = Math.min(5, Math.max(1, totalGuesses))
    stats.dist[clampedGuesses] = (stats.dist[clampedGuesses] || 0) + 1
  } else {
    stats.streak = 0
  }

  stats.lastPlayedDay = todayStr
  saveStats(stats)
  return stats
}

export function renderStats(stats, lastGuessCount) {
  document.getElementById('stat-played').textContent    = stats.played
  document.getElementById('stat-winpct').textContent    = stats.played
    ? Math.round((stats.wins / stats.played) * 100)
    : 0
  document.getElementById('stat-streak').textContent    = stats.streak
  document.getElementById('stat-maxstreak').textContent = stats.maxStreak

  const barsEl = document.getElementById('dist-bars')
  barsEl.innerHTML = ''
  const maxVal = Math.max(1, ...Object.values(stats.dist))

  for (let g = 1; g <= 5; g++) {
    const count   = stats.dist[g] || 0
    const pct     = Math.max(8, Math.round((count / maxVal) * 100))
    const isLast  = g === lastGuessCount

    const row = document.createElement('div')
    row.className = 'dist-row'
    row.innerHTML = `
      <span class="dist-row-label">${g}</span>
      <div class="dist-bar-wrap">
        <div class="dist-bar ${isLast ? 'highlight' : ''}" style="width:${pct}%">${count}</div>
      </div>
    `
    barsEl.appendChild(row)
  }
}
