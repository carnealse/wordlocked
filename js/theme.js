/**
 * theme.js
 * Player-selected themes. Each theme except Classic is unlocked by an
 * achievement, and the locked hint shown on the Themes page is that
 * achievement's hint.
 *
 * To add a theme, append { id, name, unlockedBy } and style it in style.css
 * under :root[data-theme="<id>"], plus a .theme-swatch--<id> preview.
 */

import { storage } from './storage.js'
import { ACHIEVEMENTS, hasEarned } from './achievements.js'

const KEY = 'theme'
const DEFAULT_ID = 'classic'

/**
 * decor: class names of the empty spans placed in a background layer behind
 * the game; their look and motion live in style.css.
 * @typedef {{ id: string, name: string, unlockedBy: string | null,
 *             decor?: { className: string, children: string[] } }} Theme
 */

/** @type {readonly Theme[]} */
export const THEMES = Object.freeze([
  { id: 'classic',   name: 'Classic',      unlockedBy: null },
  { id: 'halloween', name: 'Halloween',    unlockedBy: 'october-win' },
  { id: 'bloody',    name: 'Bloody Scary', unlockedBy: 'october-two-wins',
    decor: { className: 'blood-drops', children: Array(14).fill('') } },
  { id: 'haunted',   name: 'Haunted',      unlockedBy: 'october-three-wins',
    decor: { className: 'haunt', children: [
      'chain', 'chain', 'chain', 'chain', 'chain',
      'chain chain--side', 'chain chain--side', 'chain chain--side', 'chain chain--side', 'chain chain--side',
      'ghost',
    ] } },
  { id: 'graveyard', name: 'Graveyard Fog', unlockedBy: 'october-four-wins',
    decor: { className: 'graveyard', children: ['tombs', 'fog', 'fog', 'fog', 'fog fog--mid', 'fog fog--mid'] } },
  { id: 'witching',  name: 'Witching Hour', unlockedBy: 'october-five-wins',
    decor: { className: 'witching', children: ['stars', 'stars', 'moon', 'witch', ...Array(28).fill('twinkle')] } },
  { id: 'spider',    name: "Spider's Den",  unlockedBy: 'october-streak-5',
    decor: { className: 'den', children: ['web', 'web', 'web web--side', 'web web--side', 'spider'] } },
  { id: 'bats',      name: 'Bat Swarm',     unlockedBy: 'october-streak-3',
    decor: { className: 'bats', children: ['bat', 'bat', 'bat'] } },
  { id: 'franken',   name: 'Frankenlock',   unlockedBy: 'october-efficient',
    decor: { className: 'storm', children: ['flash', ...Array(6).fill('bolt')] } },
  { id: 'final',     name: 'The Final Lock', unlockedBy: 'halloween-win',
    decor: { className: 'lanterns', children: [...Array(11).fill('eyes'), 'eyes eyes--side', 'eyes eyes--side'] } },
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
  const id = selectedThemeId()
  const root = document.documentElement
  if (id === DEFAULT_ID) delete root.dataset.theme
  else root.dataset.theme = id
  syncDecor(THEMES.find(t => t.id === id)?.decor)
}

function syncDecor(decor) {
  const existing = document.getElementById('theme-decor')
  if (existing?.className === decor?.className) return
  existing?.remove()
  if (!decor) return
  const layer = document.createElement('div')
  layer.id = 'theme-decor'
  layer.className = decor.className
  layer.setAttribute('aria-hidden', 'true')
  for (const name of decor.children) {
    const child = document.createElement('span')
    if (name) child.className = name
    layer.append(child)
  }
  document.body.prepend(layer)
}
