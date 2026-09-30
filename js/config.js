/**
 * config.js
 * The shape of a daily puzzle. Every module derives lock counts,
 * word lengths, and guess limits from here.
 */

/** Word length of each lock, in play order. Each needs a words/<n>-letters.json bank. */
export const LOCK_LENGTHS = Object.freeze([4, 5, 6])

export const LOCK_COUNT = LOCK_LENGTHS.length

/** Guesses allowed per lock. */
export const MAX_GUESSES = 5
