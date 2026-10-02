/**
 * dev.js
 * Testing helpers, loaded by main.js only on localhost. Run them from the browser console:
 *
 *   wordlocked.unlockAll()   earn every achievement (and so every theme)
 *   wordlocked.lockAll()     remove every achievement
 *   wordlocked.reset()       wipe stats, achievements, today's game and the theme
 *
 * Each one reloads the page.
 */

import { ACHIEVEMENTS } from './achievements.js'

/** @param {import('./vault.js').VaultWriter} vault */
export function install(vault) {
  const done = () => location.reload()
  window.wordlocked = Object.freeze({
    unlockAll() {
      vault.write('achievements', { earned: Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, 1])) })
      done()
    },
    lockAll() {
      vault.remove('achievements')
      done()
    },
    reset() {
      ['stats', 'achievements', 'daily'].forEach(key => vault.remove(key))
      localStorage.removeItem('wordlocked_theme')
      done()
    },
  })
  console.info('[WORDLOCKED] Testing helpers: wordlocked.unlockAll(), wordlocked.lockAll(), wordlocked.reset()')
}
