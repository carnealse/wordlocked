/**
 * state.js
 * Single source of truth for all game state.
 * State is never mutated directly — always replaced via update().
 * Subscribers are notified of every change.
 */

/** @typedef {'idle' | 'playing' | 'won' | 'lost'} GameStatus */

/**
 * @typedef {Object} LevelResult
 * @property {boolean} solved
 * @property {number}  tries   — guesses used on this specific level
 */

/**
 * @typedef {Object} GameState
 * @property {string}         todayStr
 * @property {number}         dayIndex
 * @property {string[]}       words          — ['WORD','FIVER','SIXLET']
 * @property {string[]}       hints
 * @property {number}         level          — 0 | 1 | 2
 * @property {number}         guessesUsed    — total across all levels
 * @property {number}         levelGuessStart — guessesUsed at start of current level
 * @property {string[][]}     wheels         — dial wheels for current level
 * @property {number[]}       positions      — current dial index per position
 * @property {boolean[]}      correct        — locked-correct mask per position
 * @property {LevelResult[]}  results        — completed level outcomes
 * @property {GameStatus}     status
 */

const MAX_GUESSES = 5

/** @type {GameState} */
let _state = createInitial()

/** @type {Array<(state: GameState) => void>} */
const _subscribers = []

function createInitial() {
  return {
    todayStr:        '',
    dayIndex:        0,
    words:           [],
    hints:           [],
    level:           0,
    guessesUsed:     0,
    levelGuessStart: 0,
    wheels:          [],
    positions:       [],
    correct:         [],
    results:         [],
    status:          'idle',
  }
}

/** Read-only snapshot of current state */
export function getState() { return _state }

export const MAX = MAX_GUESSES

/** Replace state and notify all subscribers */
function update(partial) {
  _state = { ..._state, ...partial }
  _subscribers.forEach(fn => fn(_state))
}

/** Subscribe to every state change */
export function subscribe(fn) {
  _subscribers.push(fn)
  return () => {
    const i = _subscribers.indexOf(fn)
    if (i >= 0) _subscribers.splice(i, 1)
  }
}

// ── PUBLIC MUTATORS ──────────────────────────────────────────────
// These are the only ways to change state.

export function initState(fields) {
  update({ ...createInitial(), ...fields, status: 'playing' })
}

export function restoreState(saved) {
  update({ ...saved, status: saved.status })
}

export function setDialPosition(dialIdx, position) {
  const positions = [..._state.positions]
  positions[dialIdx] = position
  update({ positions })
}

export function setWheelsAndPositions(wheels, positions, correct) {
  update({ wheels, positions, correct })
}

/**
 * Apply a guess result.
 * @param {boolean[]} correctMask  Per-position correctness for this guess
 * @returns {{ allCorrect: boolean, outOfGuesses: boolean }}
 */
export function applyGuess(correctMask) {
  const merged = _state.correct.map((was, i) => was || correctMask[i])
  const allCorrect = merged.every(Boolean)
  const guessesUsed = _state.guessesUsed + 1
  const outOfGuesses = guessesUsed >= MAX_GUESSES && !allCorrect

  update({ correct: merged, guessesUsed })
  return { allCorrect, outOfGuesses }
}

/** Advance to the next level after a crack */
export function advanceLevel(wheels, positions) {
  const level = _state.level + 1
  update({
    level,
    levelGuessStart: _state.guessesUsed,
    wheels,
    positions,
    correct: new Array(wheels.length).fill(false),
  })
}

/** Record outcome for the current level */
export function recordLevelResult(solved) {
  const tries = _state.guessesUsed - _state.levelGuessStart
  const results = [..._state.results, { solved, tries }]
  update({ results })
  return results
}

export function setStatus(status) {
  update({ status })
}
