/**
 * theme.js
 * Player-selected themes. Each theme except Classic is unlocked by an
 * achievement, and the locked hint shown on the Themes page is that
 * achievement's hint.
 *
 * To add a theme, append { id, name, unlockedBy } and style it in style.css
 * under :root[data-theme="<id>"], plus a .theme-swatch--<id> preview.
 *
 * ?theme=<id> previews any theme without saving it, locked or not.
 */

import { storage } from './storage.js'
import { ACHIEVEMENTS, hasEarned } from './achievements.js'

const KEY = 'theme'
const DEFAULT_ID = 'classic'
const BLOOD_DROPS = 14

/** @typedef {{ id: string, name: string, unlockedBy: string | null }} Theme */

/** @type {readonly Theme[]} */
export const THEMES = Object.freeze([
  { id: 'classic',   name: 'Classic',      unlockedBy: null },
  { id: 'halloween', name: 'Halloween',    unlockedBy: 'october-win' },
  { id: 'bloody',    name: 'Bloody Scary', unlockedBy: 'october-two-wins' },
])

const isUnlocked = theme => !theme.unlockedBy || hasEarned(theme.unlockedBy)

function selectedThemeId() {
  const theme = THEMES.find(t => t.id === storage.get(KEY))
  return theme && isUnlocked(theme) ? theme.id : DEFAULT_ID
}

/**
 * @typedef {{ id: string, name: string, hint: string, unlocked: boolean, selected: boolean }} ThemeEntry
 * @returns {ThemeEntry[]}
 */
export function themeEntries() {
  const selected = selectedThemeId()
  return THEMES.map(theme => ({
    id: theme.id,
    name: theme.name,
    hint: ACHIEVEMENTS.find(a => a.id === theme.unlockedBy)?.hint ?? '',
    unlocked: isUnlocked(theme),
    selected: theme.id === selected,
  }))
}

/** Saves and applies an unlocked theme. Locked or unknown ids are ignored. */
export function selectTheme(id) {
  const theme = THEMES.find(t => t.id === id)
  if (!theme || !isUnlocked(theme)) return
  storage.set(KEY, id)
  applyTheme()
}

export function applyTheme() {
  const preview = new URLSearchParams(location.search).get('theme')
  const id = THEMES.some(t => t.id === preview) ? preview : selectedThemeId()
  const root = document.documentElement
  if (id === DEFAULT_ID) delete root.dataset.theme
  else root.dataset.theme = id
  syncBloodDrops(id === 'bloody')
}

/** Empty spans for the background drips; their placement and timing live in style.css. */
function syncBloodDrops(on) {
  const existing = document.getElementById('blood-drops')
  if (!on) { existing?.remove(); return }
  if (existing) return
  const layer = document.createElement('div')
  layer.id = 'blood-drops'
  layer.className = 'blood-drops'
  layer.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < BLOOD_DROPS; i++) layer.append(document.createElement('span'))
  document.body.prepend(layer)
}
