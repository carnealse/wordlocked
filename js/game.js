/**
 * game.js
 * Core game logic: level progression, guess evaluation, word loading.
 * Zero DOM access — coordinates state and delegates rendering to ui.js.
 */

import { getTodayUTC, getDayIndex, mulberry32, hashStr } from './seed.js'
import { buildWheelsForWord, wheelIndexOf, advancePosition } from './dials.js'
import { storage } from './storage.js'
import {
  getState, MAX,
  initState, restoreState, setDialPosition,
  setWheelsAndPositions, applyGuess, advanceLevel,
  recordLevelResult, setStatus,
} from './state.js'
import {
  renderPips, renderStages, renderHint, renderDials,
  updateDialDisplay, animateCrack, animateShackleOpen,
  resetShackle, animateShake, flashCorrectDials,
  showToast, buildAndShowEndModal, startCountdownTimer,
  openModal, closeModal, renderStats as uiRenderStats,
} from './ui.js'
import { recordResult, loadStats, renderStats } from './stats.js'
import { buildShareText, copyToClipboard } from './share.js'

const STORAGE_DAILY = 'daily'

// Swipe tracking — module-level, not state
const _swipe = { active: false, startY: 0, lastY: 0, dialIdx: -1 }
let _focusedDial = 0

// ── BOOT ─────────────────────────────────────────────────────────
export async function boot() {
  const todayStr = getTodayUTC()
  const dayIndex = getDayIndex(todayStr)

  const wordObjs = await loadWords(dayIndex, todayStr)
  const words    = wordObjs.map(o => o.word.toUpperCase())
  const hints    = wordObjs.map(o => o.hint)

  const saved = storage.get(STORAGE_DAILY)
  const isSameDay = saved?.todayStr === todayStr

  if (isSameDay) {
    // Rebuild wheels (not persisted — deterministic so we can always rebuild)
    const wheels    = buildWheelsForWord(words[saved.level], dayIndex, saved.level)
    const positions = saved.positions?.length === wheels.length
      ? saved.positions
      : defaultPositions(wheels, words[saved.level], dayIndex, saved.level)

    restoreState({ ...saved, words, hints, wheels, positions })
  } else {
    const wheels    = buildWheelsForWord(words[0], dayIndex, 0)
    const positions = defaultPositions(wheels, words[0], dayIndex, 0)

    initState({
      todayStr, dayIndex, words, hints,
      wheels, positions,
      correct: new Array(words[0].length).fill(false),
    })
  }

  renderAll()
  bindEvents()

  if (getState().status !== 'playing') {
    setTimeout(() => {
      buildAndShowEndModal(getState().status === 'won')
      startCountdownTimer()
    }, 300)
  }
}

// ── WORD LOADING ──────────────────────────────────────────────────
async function loadWords(dayIndex, todayStr) {
  const [bank4, bank5, bank6] = await Promise.all([
    fetch('words/4-letters.json').then(r => r.json()),
    fetch('words/5-letters.json').then(r => r.json()),
    fetch('words/6-letters.json').then(r => r.json()),
  ])

  const seed = hashStr(todayStr)
  const rng  = mulberry32(seed)
  return [bank4, bank5, bank6].map(bank => bank[Math.floor(rng() * bank.length)])
}

// ── INITIAL POSITIONS ─────────────────────────────────────────────
/**
 * Sets starting positions to random-but-not-correct letters,
 * so the player has something to do from the first view.
 */
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
    handleSpinUp,
    handleSpinDown,
    handleSwipeStart,
    handleSwipeMove,
    handleSwipeEnd,
  )
}

// ── SPIN ──────────────────────────────────────────────────────────
function spin(dialIdx, dir) {
  const { wheels, positions, correct } = getState()
  const wheel  = wheels[dialIdx]
  const newPos = advancePosition(positions[dialIdx], dir, wheel.length)
  setDialPosition(dialIdx, newPos)
  updateDialDisplay(dialIdx, wheel[newPos], correct[dialIdx], dir)
}

function handleSpinUp(dialIdx)   { spin(dialIdx, -1) }
function handleSpinDown(dialIdx) { spin(dialIdx,  1) }

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

function handleSwipeEnd(_e, _dialIdx) {
  _swipe.active = false
}

// ── KEYBOARD ──────────────────────────────────────────────────────
function handleKeyDown(e) {
  if (getState().status !== 'playing') return

  const { words, level, wheels } = getState()
  const wordLen = words[level].length

  if (e.key === 'ArrowUp')    { e.preventDefault(); spin(_focusedDial, -1) }
  if (e.key === 'ArrowDown')  { e.preventDefault(); spin(_focusedDial,  1) }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); _focusedDial = Math.max(0, _focusedDial - 1) }
  if (e.key === 'ArrowRight') { e.preventDefault(); _focusedDial = Math.min(wordLen - 1, _focusedDial + 1) }
  if (e.key === 'Enter')      { submitGuess() }

  if (/^[a-zA-Z]$/.test(e.key)) {
    const target = e.key.toUpperCase()
    const wheel  = wheels[_focusedDial]
    const idx    = wheel.indexOf(target)
    if (idx >= 0) {
      setDialPosition(_focusedDial, idx)
      updateDialDisplay(_focusedDial, target, getState().correct[_focusedDial], 1)
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

  // Evaluate per-position correctness
  const correctMask = guess.map((letter, i) => letter === target[i])
  const { allCorrect, outOfGuesses } = applyGuess(correctMask)

  flashCorrectDials()

  if (allCorrect) {
    animateCrack()
    await sleep(400)
    recordLevelResult(true)
    await animateShackleOpen()

    if (level < 2) {
      // Advance to next lock
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
      // All 3 cracked
      setStatus('won')
      persist()
      const stats = recordResult(true, getState().guessesUsed)
      renderStats(stats, getState().guessesUsed)
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
      recordResult(false, getState().guessesUsed)
      renderStats(loadStats(), null)
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
  const { todayStr, dayIndex, level, guessesUsed, levelGuessStart,
          positions, correct, results, status, words, hints } = getState()
  storage.set(STORAGE_DAILY, {
    todayStr, dayIndex, level, guessesUsed, levelGuessStart,
    positions, correct, results, status,
    // Don't persist words/hints — reloaded from JSON on boot
  })
}

// ── SHARE ─────────────────────────────────────────────────────────
async function handleShare() {
  const { dayIndex, guessesUsed, results } = getState()
  const text = buildShareText(dayIndex, guessesUsed, MAX, results)
  const ok   = await copyToClipboard(text)
  showToast(ok ? 'COPIED TO CLIPBOARD' : 'COPY FAILED — try manually')
}

// ── EVENTS ────────────────────────────────────────────────────────
function bindEvents() {
  // Header
  document.getElementById('btn-how').addEventListener('click', () => openModal('modal-how'))
  document.getElementById('btn-stats').addEventListener('click', () => {
    renderStats(loadStats(), null)
    openModal('modal-stats')
  })

  // Close — both X buttons and overlay click
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  )
  document.querySelectorAll('.modal-overlay').forEach(overlay =>
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id)
    })
  )

  // Submit
  document.getElementById('submit-btn').addEventListener('click', submitGuess)

  // Share — both locations
  document.querySelectorAll('[data-action="share"]').forEach(btn =>
    btn.addEventListener('click', handleShare)
  )

  // End modal nav
  document.getElementById('end-prev').addEventListener('click', () =>
    import('./ui.js').then(m => m.navigateEndPage(-1))
  )
  document.getElementById('end-next').addEventListener('click', () =>
    import('./ui.js').then(m => m.navigateEndPage(1))
  )

  // Keyboard
  document.addEventListener('keydown', handleKeyDown)
}

// ── UTILITY ───────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))
