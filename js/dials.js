/**
 * dials.js
 * Builds and manages the letter wheel for each dial position.
 * Pure logic — no DOM access.
 */

import { mulberry32, hashStr, seededShuffle } from './seed.js'

const ALPHABET  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const VOWELS    = 'AEIOU'.split('')
const CONSONANTS = ALPHABET.filter(l => !VOWELS.includes(l))

const WHEEL_SIZE      = 12   // letters per dial wheel
const TARGET_VOWELS   = 3    // vowels guaranteed per wheel (excl. correct letter if vowel)

/**
 * Builds one dial wheel for a single letter position.
 * Guarantees:
 *  - The correct letter is present exactly once
 *  - 3–4 vowels total in the wheel
 *  - WHEEL_SIZE total letters, shuffled deterministically
 *
 * @param {string} correctLetter  Uppercase single character
 * @param {Function} rng          Seeded PRNG
 * @returns {string[]}            Array of uppercase letters
 */
function buildWheel(correctLetter, rng) {
  const pool = new Set([correctLetter])

  // Guarantee vowel count — correct letter may already be a vowel
  const targetVowels = TARGET_VOWELS + (rng() > 0.5 ? 1 : 0)  // 3 or 4
  let vowelCount = VOWELS.includes(correctLetter) ? 1 : 0

  while (vowelCount < targetVowels) {
    const v = VOWELS[Math.floor(rng() * VOWELS.length)]
    if (!pool.has(v)) { pool.add(v); vowelCount++ }
  }

  // Fill remaining with consonants (avoid dupes)
  let safety = 0
  while (pool.size < WHEEL_SIZE && safety < 500) {
    const c = CONSONANTS[Math.floor(rng() * CONSONANTS.length)]
    pool.add(c)
    safety++
  }

  return seededShuffle([...pool], rng)
}

/**
 * Builds all dial wheels for a given word.
 * Each position gets its own independently-seeded wheel.
 *
 * @param {string} word       Uppercase word
 * @param {number} dayIndex
 * @param {number} levelIndex 0 | 1 | 2
 * @returns {string[][]}      Array of wheels, one per letter position
 */
export function buildWheelsForWord(word, dayIndex, levelIndex) {
  // Each position gets a unique seed derived from day + level + position
  return word.split('').map((letter, pos) => {
    const seed = hashStr(`wl-${dayIndex}-${levelIndex}-${pos}`)
    const rng  = mulberry32(seed)
    return buildWheel(letter, rng)
  })
}

/**
 * Returns the index within a wheel where a given letter lives.
 * Wheels are guaranteed to contain the correct letter, so this
 * always returns a valid index.
 */
export function wheelIndexOf(wheel, letter) {
  const idx = wheel.indexOf(letter)
  return idx === -1 ? 0 : idx
}

/**
 * Advances a dial position by `delta` steps, wrapping around the wheel.
 */
export function advancePosition(current, delta, wheelLength) {
  return ((current + delta) % wheelLength + wheelLength) % wheelLength
}
