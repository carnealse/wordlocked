/**
 * main.js
 * Entry point. Imports and boots the game.
 * This is the only file referenced by index.html.
 */

import { boot } from './game.js'
import { applyTheme } from './theme.js'

applyTheme()
boot().catch(err => {
  console.error('[WORDLOCKED] Boot failed:', err)
  document.getElementById('dials-row').innerHTML =
    '<p style="color:#ef4444;text-align:center;padding:20px">Failed to load puzzle. Please refresh.</p>'
})
