/**
 * game.js
 * Core game logic: level progression, guess evaluation, word loading.
 * Coordinates state and binds input events; all rendering is delegated to ui.js.
 */

import { getPuzzleDate, getDayIndex, getPuzzleNumber, mulberry32, hashStr } from './seed.js'
import { buildWheelsForWord, wheelIndexOf, advancePosition } from './dials.js'
import { readSealed } from './vault.js'
import { LOCK_LENGTHS, LOCK_COUNT } from './config.js'
import {
  getState, isFinished,
  initState, restoreState, setDialPosition,
  applyGuess, advanceLevel,
  recordLevelResult, setStatus,
} from './state.js'
import {
  buildHud, renderPips, renderStages, renderPuzzleNumber, renderHint, renderDials,
  updateDialDisplay, animateCrack, animateShackleOpen,
  renderShackle, animateShake, flashCorrectDials,
  showToast, buildAndShowEndModal, showAchievementPages, startCountdownTimer,
  openModal, closeModal, navigateEndPage, openTrophyCase, revealStatsActions,
  renderThemePicker,
} from './ui.js'
import { themeEntries, selectTheme } from './theme.js'
import { createStatsRecorder, loadStats, renderStats } from './stats.js'
import { shareResult } from './share.js'
import { createAchievementAwarder, trophyEntries } from './achievements.js'

const STORAGE_DAILY = 'daily'

/*
 * Advertisement build: one fixed round for recording. None of these words are in
 * any word bank, so the round can never match a real puzzle. Every load starts a
 * fresh take, and nothing is saved, recorded, or awarded.
 */
const AD_WORDS = [
  { word: 'HASP',   hint: 'Noun' },
  { word: 'LATCH',  hint: 'Noun / Verb' },
  { word: 'CIPHER', hint: 'Noun' },
]

// Swipe tracking — module-level, not state
const _swipe = { active: false, startY: 0, lastY: 0, dialIdx: -1 }
let _focusedDial = 0

/*
 * Progress writers and today's puzzle identity live here, out of reach of the
 * console. Results are recorded against _today rather than game state, which
 * can be changed through state.js.
 */
/** @type {import('./vault.js').VaultWriter} */
let _vault
let _stats
let _award
let _today = { todayStr: '', puzzleNumber: 0 }
/* False when today's result was already counted before this game finished, e.g. the
   saved game was erased and the day replayed. A replay never awards achievements. */
let _rewarded = false

// ── BOOT ─────────────────────────────────────────────────────────
/** @param {import('./vault.js').VaultWriter} vault  claimed by main.js at startup */
export async function boot(vault) {
  if (_vault) return
  _vault = vault
  _stats = createStatsRecorder(vault)
  _award = createAchievementAwarder(vault)
  buildHud()

  const todayStr     = getPuzzleDate()
  const dayIndex     = getDayIndex(todayStr)
  const puzzleNumber = getPuzzleNumber(todayStr)
  _today = Object.freeze({ todayStr, puzzleNumber })

  const wordObjs = await loadWords(puzzleNumber)
  const words    = wordObjs.map(o => o.word.toUpperCase())
  const hints    = wordObjs.map(o => o.hint)

  const saved     = null
  const isSameDay = saved?.todayStr === todayStr && saved?.puzzleNumber === puzzleNumber

  if (isSameDay) {
    const wheels    = buildWheelsForWord(words[saved.level], dayIndex, saved.level)
    const positions = saved.positions?.length === wheels.length
      ? saved.positions
      : defaultPositions(wheels, words[saved.level], dayIndex, saved.level)

    restoreState({ ...saved, words, hints, wheels, positions })
    _rewarded = saved.rewarded === true
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

  if (isFinished()) {
    const stats = _stats.backfillDistribution(todayStr, getState().results)
    setTimeout(() => showEndOfDay(stats), 300)
  }
}

// ── WORD LOADING ──────────────────────────────────────────────────
/**
 * Puzzle #N uses the word whose id is N in each bank, wrapping to id 1 once
 * a bank runs out, so the game keeps working until new banks are appended.
 * Banks are written by tools/build_word_banks.py with ids 1..length in order.
 * @param {Array<{id: number, word: string, hint: string}>} bank
 * @param {number} puzzleNumber
 */
function wordForPuzzle(bank, puzzleNumber) {
  const id = ((puzzleNumber - 1) % bank.length) + 1
  const entry = bank[id - 1]
  if (entry?.id !== id) throw new Error(`Word bank is out of order at id ${id}`)
  return entry
}

async function fetchBank(length) {
  const res = await fetch(`words/${length}-letters.json`)
  if (!res.ok) throw new Error(`words/${length}-letters.json: HTTP ${res.status}`)
  return res.json()
}

/** One word per lock, in LOCK_LENGTHS order. */
async function loadWords(puzzleNumber) {
  const banks = await Promise.all(LOCK_LENGTHS.map(fetchBank))
  const used = new Set(banks.flat().map(o => o.word.toUpperCase()))
  if (AD_WORDS.some((o, i) => o.word.length !== LOCK_LENGTHS[i] || used.has(o.word))) {
    throw new Error('Ad round words must fit the locks and be absent from every bank')
  }
  return AD_WORDS
}

// ── END OF DAY ────────────────────────────────────────────────────
/** Records today's result, then shows the end modal. Call once, at the moment the day ends. */
async function finishDay(won, delayMs) {
  setStatus(won ? 'won' : 'lost')
  _rewarded = false
  const { results } = getState()
  const stats = loadStats()
  renderStats(stats, results)
  await sleep(delayMs)
  showEndOfDay(stats)
}

/** Awards any newly earned achievements (unless today is a replay) and opens the end modal. Safe on every load of a finished day. */
function showEndOfDay(stats) {
  const { status, results } = getState()
  const { puzzleNumber, todayStr } = _today
  const achievements = _rewarded
    ? _award({ stats, today: { status, results, puzzleNumber, date: todayStr } })
    : []
  revealStatsActions()
  buildAndShowEndModal(status === 'won', { achievements, trophies: trophyEntries() })
  startCountdownTimer(() => location.reload())
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
  renderPuzzleNumber()
  renderHint()
  renderShackle()
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

    if (level < LOCK_COUNT - 1) {
      const nextLevel  = level + 1
      const nextWord   = words[nextLevel]
      const { dayIndex } = getState()
      const nextWheels = buildWheelsForWord(nextWord, dayIndex, nextLevel)
      const nextPos    = defaultPositions(nextWheels, nextWord, dayIndex, nextLevel)

      advanceLevel(nextWheels, nextPos)
      _focusedDial = 0

      renderAll()
      showToast('LOCK CRACKED. NEXT LEVEL')
    } else {
      await finishDay(true, 200)
    }
  } else {
    animateShake()

    if (outOfGuesses) {
      recordLevelResult(false)
      await finishDay(false, 500)
    } else {
      showToast('NOT QUITE. KEEP SPINNING')
    }
  }

  renderPips()
  renderStages()
  persist()
}

// ── PERSIST ───────────────────────────────────────────────────────
/** The ad round never saves, so every load is a fresh take. */
function persist() {}

// ── SHARE ─────────────────────────────────────────────────────────
async function handleShare() {
  if (!isFinished()) {
    showToast("FINISH TODAY'S LOCKS TO SHARE")
    return
  }

  const { puzzleNumber, results } = getState()
  const outcome = await shareResult(puzzleNumber, results)
  if (outcome === 'shared')          { showToast('SHARED'); awardShareAchievements() }
  else if (outcome === 'copied-image') showToast('IMAGE COPIED')
  else if (outcome === 'copied')     showToast('COPIED TO CLIPBOARD')
  else if (outcome === 'cancelled')  { /* user dismissed share sheet */ }
  else                               showToast('SHARE FAILED. Try manually')
}

/**
 * A website only learns that the share sheet finished, not which app was picked
 * or whether the post went out, so a completed share is the closest signal.
 * Copy-to-clipboard fallbacks do not count.
 */
function awardShareAchievements() {
  if (!_rewarded) return
  const { status, results } = getState()
  const { puzzleNumber, todayStr } = _today
  const unlocked = _award({
    stats: loadStats(),
    today: { status, results, puzzleNumber, date: todayStr, shared: true },
  })
  if (!unlocked.length) return
  closeModal('modal-stats')
  showAchievementPages(unlocked, trophyEntries())
}

// ── EVENTS ────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-how').addEventListener('click', () => openModal('modal-how'))
  document.getElementById('btn-stats').addEventListener('click', () => {
    renderStats(loadStats(), isFinished() ? getState().results : null)
    openModal('modal-stats')
  })

  document.getElementById('btn-trophies').addEventListener('click', () => {
    closeModal('modal-stats')
    openTrophyCase(trophyEntries())
  })

  document.getElementById('btn-themes').addEventListener('click', () => {
    closeModal('modal-stats')
    renderThemePicker(themeEntries())
    openModal('modal-themes')
  })

  document.getElementById('theme-list').addEventListener('click', e => {
    const card = e.target.closest('[data-theme-id]')
    if (!card || card.disabled) return
    selectTheme(card.dataset.themeId)
    renderThemePicker(themeEntries())
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
