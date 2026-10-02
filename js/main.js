/**
 * main.js
 * Entry point. Imports and boots the game.
 * This is the only file referenced by index.html.
 */

import { boot } from './game.js'
import { applyTheme } from './theme.js'
import { claimWriter } from './vault.js'

const vault = claimWriter()

applyTheme()
boot(vault).catch(err => {
  console.error('[WORDLOCKED] Boot failed:', err)
  document.getElementById('dials-row').innerHTML =
    '<p style="color:#ef4444;text-align:center;padding:20px">Failed to load puzzle. Please refresh.</p>'
})

/* Testing helpers exist only when the game is served from this computer.
   Progress there is stored separately from the live site, so it cannot leak into it. */
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  import('./dev.js').then(dev => dev.install(vault))
}
