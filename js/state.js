/**
 * state.js
 * Single source of truth for all game state.
 * State is never mutated directly — always replaced via update().
 */

/** @typedef {'idle' | 'playing' | 'won' | 'lost'} GameStatus */

/**
 * @typedef {Object} LevelResult
 * @property {boolean} solved
 * @property {number}  tries  — guesses used on this specific level
 */

/**
 * @typedef {Object} GameState
 * @property {string}         todayStr
 * @property {number}         dayIndex
 * @property {number}         puzzleNumber   — public puzzle id; selects word id in each bank
 * @property {string[]}       words
 * @property {string[]}       hints
 * @property {number}         level          — 0 | 1 | 2
 * @property {number}         guessesUsed    — guesses used on current level (resets each level)
 * @property {number}         totalGuesses   — cumulative across all levels (for stats)
 * @property {string[][]}     wheels
 * @property {number[]}       positions
 * @property {boolean[]}      correct
 * @property {LevelResult[]}  results
 * @property {GameStatus}     status
 */

export const MAX = 5  // guesses per level

/** @type {GameState} */
let _state = _initial()

/** @type {Array<(state: GameState) => void>} */
const _subs = []

function _initial() {
  return {
    todayStr:     '',
    dayIndex:     0,
    puzzleNumber: 0,
    words:        [],
    hints:        [],
    level:        0,
    guessesUsed:  0,
    totalGuesses: 0,
    wheels:       [],
    positions:    [],
    correct:      [],
    results:      [],
    status:       'idle',
  }
}

export function getState() { return _state }

function _update(partial) {
  _state = { ..._state, ...partial }
  _subs.forEach(fn => fn(_state))
}

export function subscribe(fn) {
  _subs.push(fn)
  return () => { const i = _subs.indexOf(fn); if (i >= 0) _subs.splice(i, 1) }
}

export function initState(fields) {
  _update({ ..._initial(), ...fields, status: 'playing' })
}

export function restoreState(saved) {
  _update({ ...saved })
}

export function setDialPosition(dialIdx, position) {
  const positions = [..._state.positions]
  positions[dialIdx] = position
  _update({ positions })
}

/**
 * Apply a guess result.
 * guessesUsed is per-level and resets when advancing.
 * @param {boolean[]} correctMask
 * @returns {{ allCorrect: boolean, outOfGuesses: boolean }}
 */
export function applyGuess(correctMask) {
  const merged      = _state.correct.map((was, i) => was || correctMask[i])
  const allCorrect  = merged.every(Boolean)
  const guessesUsed = _state.guessesUsed + 1
  const totalGuesses = _state.totalGuesses + 1
  const outOfGuesses = guessesUsed >= MAX && !allCorrect

  _update({ correct: merged, guessesUsed, totalGuesses })
  return { allCorrect, outOfGuesses }
}

/** Advance to next level — resets per-level guess counter */
export function advanceLevel(wheels, positions) {
  _update({
    level:       _state.level + 1,
    guessesUsed: 0,
    wheels,
    positions,
    correct:     new Array(wheels.length).fill(false),
  })
}

export function recordLevelResult(solved) {
  const tries   = _state.guessesUsed
  const results = [..._state.results, { solved, tries }]
  _update({ results })
  return results
}

export function setStatus(status) {
  _update({ status })
}
