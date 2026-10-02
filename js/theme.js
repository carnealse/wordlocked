/**
 * theme.js
 * Seasonal themes. A theme is on for every puzzle day in its date range,
 * using the same Eastern-time puzzle date as the words, so it switches at
 * the same midnight as the puzzle.
 *
 * To add a theme, append { id, from, to } with 'MM-DD' dates (inclusive)
 * and style it in style.css under :root[data-theme="<id>"]. A range may
 * wrap the new year, e.g. from '12-20' to '01-01'.
 *
 * Preview any theme with ?theme=<id>, or the default look with ?theme=none.
 */

import { getPuzzleDate } from './seed.js'

const SEASONAL_THEMES = Object.freeze([
  { id: 'halloween', from: '10-01', to: '10-31' },
])

/** @param {string} date 'YYYY-MM-DD' @returns {string | null} */
export function themeFor(date) {
  const md = date.slice(5)
  const theme = SEASONAL_THEMES.find(({ from, to }) =>
    from <= to ? md >= from && md <= to : md >= from || md <= to)
  return theme?.id ?? null
}

export function applyTheme(date = getPuzzleDate()) {
  const preview = new URLSearchParams(location.search).get('theme')
  const id = preview === 'none' ? null : preview || themeFor(date)
  if (id) document.documentElement.dataset.theme = id
  else delete document.documentElement.dataset.theme
}
