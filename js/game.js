/**
 * game.js
 * Core game logic: level progression, guess evaluation, word loading.
 * Zero DOM access — coordinates state and delegates rendering to ui.js.
 */

import { getTodayUTC, getDayIndex, getPuzzleNumber, mulberry32, hashStr } from './seed.js'
import { buildWheelsForWord, wheelIndexOf, advancePosition } from './dials.js'
import { storage } from './storage.js'
import {
  getState,
  initState, restoreState, setDialPosition,
  applyGuess, advanceLevel,
  recordLevelResult, setStatus,
} from './state.js'
import {
  renderPips, renderStages, renderHint, renderDials,
  updateDialDisplay, animateCrack, animateShackleOpen,
  resetShackle, animateShake, flashCorrectDials,
  showToast, buildAndShowEndModal, startCountdownTimer,
  openModal, closeModal, navigateEndPage,
} from './ui.js'
import { recordResult, backfillDistribution, loadStats, renderStats } from './stats.js'
import { shareResult } from './share.js'

const STORAGE_DAILY = 'daily'

// Swipe tracking — module-level, not state
const _swipe = { active: false, startY: 0, lastY: 0, dialIdx: -1 }
let _focusedDial = 0

// ── BOOT ─────────────────────────────────────────────────────────
export async function boot() {
  const todayStr = getTodayUTC()
  const dayIndex = getDayIndex(todayStr)

  const wordObjs = await loadWords(todayStr)
  const words    = wordObjs.map(o => o.word.toUpperCase())
  const hints    = wordObjs.map(o => o.hint)

  const saved    = storage.get(STORAGE_DAILY)
  const puzzleNumber = getPuzzleNumber(todayStr)
  const isSameDay = saved?.todayStr === todayStr && saved?.puzzleNumber === puzzleNumber

  if (isSameDay) {
    const wheels    = buildWheelsForWord(words[saved.level], dayIndex, saved.level)
    const positions = saved.positions?.length === wheels.length
      ? saved.positions
      : defaultPositions(wheels, words[saved.level], dayIndex, saved.level)

    restoreState({ ...saved, words, hints, wheels, positions })
  } else {
    const wheels    = buildWheelsForWord(words[0], dayIndex, 0)
    const positions = defaultPositions(wheels, words[0], dayIndex, 0)

    initState({
      todayStr, dayIndex, puzzleNumber, words, hints,
      wheels, positions,
      correct: new Array(words[0].length).fill(false),
    })
  }

  renderAll()
  bindEvents()

  const { status, results } = getState()
  if (status === 'won' || status === 'lost') {
    backfillDistribution(todayStr, results)
    document.getElementById('stats-actions').removeAttribute('hidden')
    setTimeout(() => {
      buildAndShowEndModal(status === 'won')
      startCountdownTimer()
    }, 300)
  }
}

// ── WORD LOADING ──────────────────────────────────────────────────
/**
 * Puzzle #N uses the word whose id is N in each bank.
 * @param {Array<{id: number, word: string, hint: string}>} bank
 * @param {number} puzzleNumber
 */
function wordForPuzzle(bank, puzzleNumber) {
  const matches = bank.filter(entry => entry.id === puzzleNumber)
  if (matches.length !== 1) {
    throw new Error(`Expected one word with id ${puzzleNumber}, found ${matches.length}`)
  }
  return matches[0]
}

async function loadWords(todayStr) {
  const [bank4, bank5, bank6] = await Promise.all([
    fetch('words/4-letters.json').then(r => r.json()),
    fetch('words/5-letters.json').then(r => r.json()),
    fetch('words/6-letters.json').then(r => r.json()),
  ])

  const puzzleNumber = getPuzzleNumber(todayStr)
  return [bank4, bank5, bank6].map(bank => wordForPuzzle(bank, puzzleNumber))
}

// ── INITIAL POSITIONS ─────────────────────────────────────────────
function defaultPositions(wheels, word, dayIndex, levelIdx) {
  const seed = hashStr(`pos-${dayIndex}-${levelIdx}`)
  const rng  = mulberry32(seed)
  return wheels.map((wheel, i) => {
    const correctIdx = wheelIndexOf(wheel, word[i])
    let pos
    do { pos = Math.floor(rng() * wheel.length) } while (pos === correctIdx)
    return pos
  })
}

// ── RENDER ALL ────────────────────────────────────────────────────
function renderAll() {
  renderPips()
  renderStages()
  renderHint()
  renderDials(
    handleSpinLeft,
    handleSpinRight,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
  )
}

// ── SPIN ──────────────────────────────────────────────────────────
function spin(dialIdx, dir) {
  const { wheels, positions } = getState()
  const wheel  = wheels[dialIdx]
  const newPos = advancePosition(positions[dialIdx], dir, wheel.length)
  setDialPosition(dialIdx, newPos)
  updateDialDisplay(dialIdx, dir)
}

function handleSpinLeft(dialIdx)  { spin(dialIdx, -1) }
function handleSpinRight(dialIdx) { spin(dialIdx,  1) }

// ── SWIPE ─────────────────────────────────────────────────────────
function handleSwipeStart(e, dialIdx) {
  _swipe.active  = true
  _swipe.startY  = e.clientY
  _swipe.lastY   = e.clientY
  _swipe.dialIdx = dialIdx
  e.currentTarget.setPointerCapture(e.pointerId)
}

function handleSwipeMove(e, dialIdx) {
  if (!_swipe.active || _swipe.dialIdx !== dialIdx) return
  const dy = e.clientY - _swipe.lastY
  if (Math.abs(dy) >= 20) {
    spin(dialIdx, dy > 0 ? 1 : -1)
    _swipe.lastY = e.clientY
  }
}

function handleSwipeEnd() {
  _swipe.active = false
}

// ── KEYBOARD ──────────────────────────────────────────────────────
function handleKeyDown(e) {
  if (getState().status !== 'playing') return

  const { words, level, wheels } = getState()
  const wordLen = words[level].length

  if (e.key === 'ArrowLeft')  { e.preventDefault(); spin(_focusedDial, -1) }
  if (e.key === 'ArrowRight') { e.preventDefault(); spin(_focusedDial,  1) }
  if (e.key === 'ArrowUp')    { e.preventDefault(); _focusedDial = Math.max(0, _focusedDial - 1) }
  if (e.key === 'ArrowDown')  { e.preventDefault(); _focusedDial = Math.min(wordLen - 1, _focusedDial + 1) }
  if (e.key === 'Enter')      { submitGuess() }

  if (/^[a-zA-Z]$/.test(e.key)) {
    const target = e.key.toUpperCase()
    const wheel  = wheels[_focusedDial]
    const idx    = wheel.indexOf(target)
    if (idx >= 0) {
      setDialPosition(_focusedDial, idx)
      updateDialDisplay(_focusedDial, 1)
      if (_focusedDial < wordLen - 1) _focusedDial++
    }
  }
}

// ── SUBMIT ────────────────────────────────────────────────────────
async function submitGuess() {
  const { status, words, level, wheels, positions } = getState()
  if (status !== 'playing') return

  const target = words[level]
  const guess  = wheels.map((wheel, i) => wheel[positions[i]])

  const correctMask = guess.map((letter, i) => letter === target[i])
  const { allCorrect, outOfGuesses } = applyGuess(correctMask)

  flashCorrectDials()

  if (allCorrect) {
    animateCrack()
    await sleep(400)
    recordLevelResult(true)
    await animateShackleOpen()

    if (level < 2) {
      const nextLevel  = level + 1
      const nextWord   = words[nextLevel]
      const { dayIndex } = getState()
      const nextWheels = buildWheelsForWord(nextWord, dayIndex, nextLevel)
      const nextPos    = defaultPositions(nextWheels, nextWord, dayIndex, nextLevel)

      advanceLevel(nextWheels, nextPos)
      _focusedDial = 0

      resetShackle()
      renderAll()
      showToast('LOCK CRACKED — NEXT LEVEL')
    } else {
      setStatus('won')
      persist()
      const { results, todayStr } = getState()
      const stats = recordResult(true, results, todayStr)
      renderStats(stats, results)
      document.getElementById('stats-actions').removeAttribute('hidden')
      await sleep(200)
      buildAndShowEndModal(true)
      startCountdownTimer()
    }
  } else {
    animateShake()

    if (outOfGuesses) {
      recordLevelResult(false)
      setStatus('lost')
      persist()
      const finished = getState()
      recordResult(false, finished.results, finished.todayStr)
      renderStats(loadStats(), finished.results)
      document.getElementById('stats-actions').removeAttribute('hidden')
      await sleep(500)
      buildAndShowEndModal(false)
      startCountdownTimer()
    } else {
      showToast('NOT QUITE — KEEP SPINNING')
    }
  }

  renderPips()
  renderStages()
  persist()
}

// ── PERSIST ───────────────────────────────────────────────────────
function persist() {
  const { todayStr, dayIndex, puzzleNumber, level, guessesUsed, totalGuesses,
          positions, correct, results, status } = getState()
  storage.set(STORAGE_DAILY, {
    todayStr, dayIndex, puzzleNumber, level, guessesUsed, totalGuesses,
    positions, correct, results, status,
  })
}

// ── SHARE ─────────────────────────────────────────────────────────
async function handleShare() {
  const { todayStr, results, status } = getState()
  if (status !== 'won' && status !== 'lost') {
    showToast('FINISH TODAY\'S LOCKS TO SHARE')
    return
  }

  const puzzleNumber = getPuzzleNumber(todayStr || getTodayUTC())
  const outcome = await shareResult(puzzleNumber, results)
  if (outcome === 'shared')          showToast('SHARED')
  else if (outcome === 'copied-image') showToast('IMAGE COPIED')
  else if (outcome === 'copied')     showToast('COPIED TO CLIPBOARD')
  else if (outcome === 'cancelled')  { /* user dismissed share sheet */ }
  else                               showToast('SHARE FAILED — try manually')
}

// ── EVENTS ────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-how').addEventListener('click', () => openModal('modal-how'))
  document.getElementById('btn-stats').addEventListener('click', () => {
    const { status, results } = getState()
    const highlight = (status === 'won' || status === 'lost') ? results : null
    renderStats(loadStats(), highlight)
    openModal('modal-stats')
  })

  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  )

  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id)
    })
  )

  document.getElementById('submit-btn').addEventListener('click', submitGuess)

  document.querySelectorAll('[data-action="share"]').forEach(btn =>
    btn.addEventListener('click', handleShare)
  )

  document.getElementById('end-prev').addEventListener('click', () => navigateEndPage(-1))
  document.getElementById('end-next').addEventListener('click', () => navigateEndPage(1))

  document.addEventListener('keydown', handleKeyDown)
}

// ── UTILITY ───────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))
