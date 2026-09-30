/**
 * messages.js
 * Content pools for the end-of-day modal. Pure data plus a seeded picker.
 *
 * To add a message, append an object to the matching pool. Shape:
 *   { title: string, body: string[] }
 *
 * Picks are seeded by puzzle number, so reopening the modal on the same
 * day always shows the same message, while different days vary.
 * No em dashes in any player-facing text.
 */

import { mulberry32, hashStr, seededPick } from './seed.js'

/** Shown after a failed day. The answer reveal is attached by ui.js. */
export const FAIL_MESSAGES = [
  {
    title: 'SYSTEM ANNOUNCEMENT',
    body: [
      'Well, well, well. Look who played digital locksmith and locked themselves out of victory instead.',
      "The Bad News: Today's password puzzle won. The lock didn't even click. It just made a tiny, wet raspberry sound at you.",
      'The Good News: The Lock is merciful. Mostly because you bring it phenomenal entertainment value. The vault resets tomorrow. You get to wake up, stare at brand new locks, and confidently guess gibberish all over again.',
    ],
  },
  {
    title: 'LOCK STATUS REPORT',
    body: [
      'Inspection complete. The lock is undamaged. Your confidence, however, took a hit.',
      'The Bad News: That was not the word. It was not even in the same zip code as the word.',
      'The Good News: A fresh vault is waiting tomorrow. The Lock has promised to act surprised when you return.',
    ],
  },
  {
    title: 'A MESSAGE FROM THE VAULT',
    body: [
      'The vault has reviewed your attempt and would like to file it under "brave."',
      'The Bad News: The tumblers never even flinched.',
      'The Good News: New locks tomorrow. Bring snacks and a better guess.',
    ],
  },
  {
    title: 'BREAKING NEWS',
    body: [
      'Local guesser defeated by padlock. Witnesses say the lock remained calm throughout.',
      'The Bad News: Sources confirm it was not even close.',
      'The Good News: A rematch is scheduled for midnight UTC. The padlock has agreed to attend.',
    ],
  },
  {
    title: 'TUMBLER TALK',
    body: [
      'That was a lot of spinning for a whole lot of nothing.',
      'The Bad News: The lock did not click. It did not even clear its throat.',
      'The Good News: The vault resets tomorrow with brand new locks and a fresh supply of your optimism.',
    ],
  },
]

/** Shown after a failed day, after any achievements. */
export const CONSOLATIONS = [
  {
    title: 'CONSOLATION PRIZE',
    body: [
      'The combination lock has filed a restraining order. You are not permitted within 10 letters of it until tomorrow.',
      'See you at midnight UTC, when the vault resets!',
    ],
  },
  {
    title: 'CONSOLATION PRIZE',
    body: [
      'You have won a lifetime supply of almost.',
      'Redeem it tomorrow at midnight UTC, when the vault resets.',
    ],
  },
  {
    title: 'CONSOLATION PRIZE',
    body: [
      'A participation trophy, hand carved from a single unsolved padlock.',
      'Display it proudly. Or hide it. The Lock will know either way.',
    ],
  },
  {
    title: 'CONSOLATION PRIZE',
    body: [
      'The Lock would like to offer you a hug, but it has no arms. It is a padlock.',
      'Try again at midnight UTC!',
    ],
  },
  {
    title: 'CONSOLATION PRIZE',
    body: [
      'Every master locksmith has failed a lock. They just did it in private.',
      'You did it in front of the whole vault. Bold. See you tomorrow!',
    ],
  },
]

/** Shown after a won day. ui.js appends the total guess count line. */
export const WIN_MESSAGES = [
  { title: 'VAULT OPEN',         body: ['You cracked the combination.'] },
  { title: 'DOORS SWING OPEN',   body: ['The vault doors swing open.'] },
  { title: 'CLICK CLICK CLICK',  body: ['The tumblers clicked into place.'] },
  { title: 'MASTERFUL',          body: ["That's the sound of mastery."] },
  { title: 'COMBINATION CONFIRMED', body: ['Combination confirmed. The Lock is impressed and a little scared.'] },
]

/** Deterministic pick: same pool, salt, and puzzle number always give the same entry. */
function pick(pool, salt, puzzleNumber) {
  return seededPick(pool, mulberry32(hashStr(`${salt}-${puzzleNumber}`)))
}

export const pickFailMessage = puzzleNumber => pick(FAIL_MESSAGES, 'fail', puzzleNumber)
export const pickConsolation = puzzleNumber => pick(CONSOLATIONS,  'consolation', puzzleNumber)
export const pickWinMessage  = puzzleNumber => pick(WIN_MESSAGES,  'win', puzzleNumber)
