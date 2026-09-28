/**
 * game.js
 * WORDLOCKED — core game engine
 */

import { buildShareText, copyShareText } from './share.js'
import { loadStats, recordResult, renderStats } from './stats.js'

// ── CONSTANTS ────────────────────────────────────────────────────
const MAX_GUESSES  = 5
const LEVELS       = [0, 1, 2]   // indices into word banks
const WORD_LENGTHS = [4, 5, 6]
const ALPHABET     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const VOWELS       = 'AEIOU'
const STORAGE_KEY  = 'wordlocked_daily'

// ── FAILURE MESSAGES (multi-page) ────────────────────────────────
const FAIL_PAGES = [
  {
    title: 'SYSTEM ANNOUNCEMENT',
    body: `Well, well, well. Look who decided to play digital locksmith and locked themselves out of victory instead.\n\nThe Bad News: Today's password puzzle has thoroughly defeated you. The lock didn't even click. It just made a tiny, wet raspberry sound at you.\n\nThe Good News: The Lock is merciful. Mostly because watching you brings it phenomenal entertainment value. The vault resets tomorrow!`,
  },
  {
    title: 'ACHIEVEMENT UNLOCKED',
    achievement: 'Linguistic Mistake Maker',
    body: `You stared at the lock, threw a dictionary at it, and missed every single word.\n\nReward: A single dose of locked regret. This reward cannot be shared or re-gifted.`,
  },
  {
    title: 'CONSOLATION PRIZE',
    body: `The combination lock has filed a restraining order. You are not permitted within 10 letters of it until tomorrow.\n\nSee you at midnight UTC, when the vault resets and you can confidently type complete gibberish all over again.`,
  },
]

const WIN_MESSAGES = [
  'CRACKED IT.',
  'THE LOCK YIELDS.',
  'COMBINATION CONFIRMED.',
  'VAULT OPEN.',
  'MASTERFUL.',
]

// ── STATE ─────────────────────────────────────────────────────────
let state = {
  todayStr:     '',
  dayIndex:     0,
  words:        [],       // ['WORD', 'FIVER', 'SIXLET']
  hints:        [],
  level:        0,        // current lock 0/1/2
  guessesUsed:  0,
  dialPositions: [],      // current letter index per dial
  dialWheels:   [],       // array of letter arrays per dial
  correctMask:  [],       // bool[] for current level
  levelResults: [],       // {solved, tries} per level
  guessesAtLevelStart: 0,
  done:         false,
  won:          false,
}

// ── DATE / SEED ──────────────────────────────────────────────────
function getTodayStr() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDayIndex(dateStr) {
  const epoch = new Date('2025-01-01T00:00:00Z').getTime()
  const today = new Date(dateStr + 'T00:00:00Z').getTime()
  return Math.floor((today - epoch) / 86_400_000)
}

// Mulberry32 seeded PRNG
function seededRng(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

// Hash a string to a uint32
function hashStr(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (Math.imul(h, 0x01000193)) >>> 0
  }
  return h
}

// ── WORD LOADING ─────────────────────────────────────────────────
async function loadWordBank(length) {
  const res  = await fetch(`words/${length}-letters.json`)
  return await res.json()
}

async function selectDailyWords(dayIndex, todayStr) {
  const banks = await Promise.all([
    loadWordBank(4),
    loadWordBank(5),
    loadWordBank(6),
  ])
  const seed = hashStr(todayStr)
  const rng  = seededRng(seed)
  return banks.map((bank) => {
    const idx = Math.floor(rng() * bank.length)
    return bank[idx]
  })
}

// ── DIAL WHEEL GENERATION ────────────────────────────────────────
function buildDialWheel(correctLetter, rng) {
  const wheel = new Set()
  wheel.add(correctLetter)

  // Add 3–4 vowels (correct letter may already be a vowel)
  const vowelArr = VOWELS.split('')
  let vowelCount = 0
  const targetVowels = 3 + Math.floor(rng() * 2)  // 3 or 4
  while (vowelCount < targetVowels) {
    const v = vowelArr[Math.floor(rng() * vowelArr.length)]
    if (!wheel.has(v)) { wheel.add(v); vowelCount++ }
  }

  // Fill remaining to reach wheel size 10–13
  const targetSize = 10 + Math.floor(rng() * 4)
  let attempts = 0
  while (wheel.size < targetSize && attempts < 200) {
    const l = ALPHABET[Math.floor(rng() * ALPHABET.length)]
    wheel.add(l)
    attempts++
  }

  // Shuffle
  const arr = [...wheel]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}

function buildDialsForWord(word, dayIndex, levelIdx) {
  const seed = hashStr(`${dayIndex}-${levelIdx}`)
  const rng  = seededRng(seed)
  return word.split('').map((letter) => buildDialWheel(letter, rng))
}

// ── STORAGE ───────────────────────────────────────────────────────
function loadDailyState(todayStr) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.todayStr !== todayStr) return null
    return parsed
  } catch { return null }
}

function saveDailyState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      todayStr:     state.todayStr,
      guessesUsed:  state.guessesUsed,
      level:        state.level,
      levelResults: state.levelResults,
      dialPositions: state.dialPositions,
      correctMask:  state.correctMask,
      done:         state.done,
      won:          state.won,
      guessesAtLevelStart: state.guessesAtLevelStart,
    }))
  } catch {}
}

// ── INIT ─────────────────────────────────────────────────────────
async function init() {
  const todayStr = getTodayStr()
  const dayIndex = getDayIndex(todayStr)
  const wordObjs = await selectDailyWords(dayIndex, todayStr)

  state.todayStr  = todayStr
  state.dayIndex  = dayIndex
  state.words     = wordObjs.map(o => o.word.toUpperCase())
  state.hints     = wordObjs.map(o => o.hint)

  const saved = loadDailyState(todayStr)

  if (saved && saved.done) {
    // Restore completed game for viewing
    state = { ...state, ...saved }
    buildDialsForCurrentLevel()
    renderAll()
    if (saved.done) {
      setTimeout(() => showEndModal(), 400)
    }
    return
  }

  if (saved) {
    state = { ...state, ...saved }
    // Rebuild dial wheels (not stored)
    buildDialsForCurrentLevel()
  } else {
    // Fresh game
    state.level        = 0
    state.guessesUsed  = 0
    state.levelResults = []
    state.done         = false
    state.won          = false
    state.guessesAtLevelStart = 0
    buildDialsForCurrentLevel()
  }

  renderAll()
  setupEvents()
}

function buildDialsForCurrentLevel() {
  const word = state.words[state.level]
  state.dialWheels = buildDialsForWord(word, state.dayIndex, state.level)

  if (!state.dialPositions || state.dialPositions.length !== word.length) {
    // Set each dial to show a random letter from its wheel (not necessarily correct)
    const seed = hashStr(`${state.dayIndex}-init-${state.level}`)
    const rng  = seededRng(seed)
    state.dialPositions = state.dialWheels.map((wheel) =>
      Math.floor(rng() * wheel.length)
    )
  }

  if (!state.correctMask || state.correctMask.length !== word.length) {
    state.correctMask = new Array(word.length).fill(false)
  }
}

// ── RENDER ────────────────────────────────────────────────────────
function renderAll() {
  renderGuessPips()
  renderStageBar()
  renderHint()
  renderDials()
  renderGuessRemaining()
}

function renderGuessPips() {
  const pips = document.querySelectorAll('.pip')
  pips.forEach((pip, i) => {
    pip.classList.remove('used', 'cracked')
    if (i < state.guessesUsed) pip.classList.add('used')
  })
  // Mark cracked guesses per level
  let g = 0
  state.levelResults.forEach((r) => {
    for (let i = 0; i < r.tries; i++) {
      if (g < pips.length) {
        pips[g].classList.remove('used')
        if (r.solved) pips[g].classList.add('cracked')
        g++
      }
    }
  })
}

function renderStageBar() {
  LEVELS.forEach((i) => {
    const chip = document.getElementById(`stage-${i}`)
    chip.classList.remove('active', 'done')
    const lockEl = chip.querySelector('.stage-lock')
    if (i < state.level || (state.levelResults[i] && state.levelResults[i].solved)) {
      chip.classList.add('done')
      lockEl.textContent = '🔓'
    } else if (i === state.level && !state.done) {
      chip.classList.add('active')
      lockEl.textContent = '🔒'
    } else {
      lockEl.textContent = '🔒'
    }
  })
}

function renderHint() {
  const hint = state.hints[Math.min(state.level, 2)]
  document.getElementById('hint-text').textContent = hint || '—'
}

function renderGuessRemaining() {
  const rem = MAX_GUESSES - state.guessesUsed
  document.getElementById('guess-remaining').textContent = `${rem} left`
}

function renderDials() {
  const row    = document.getElementById('dials-row')
  const word   = state.words[state.level]
  row.innerHTML = ''

  state.dialWheels.forEach((wheel, i) => {
    const pos     = state.dialPositions[i]
    const letter  = wheel[pos]
    const correct = state.correctMask[i]

    const col = document.createElement('div')
    col.className = 'dial-col'
    col.dataset.dial = i

    col.innerHTML = `
      <button class="dial-btn dial-up" data-i="${i}" aria-label="Spin dial ${i+1} up">▲</button>
      <div class="dial-window ${correct ? 'correct' : ''}" data-i="${i}" tabindex="0" aria-label="Dial ${i+1}: ${letter}">
        <span class="dial-letter">${letter}</span>
      </div>
      <button class="dial-btn dial-dn" data-i="${i}" aria-label="Spin dial ${i+1} down">▼</button>
    `

    row.appendChild(col)
  })

  attachDialEvents()
}

// ── DIAL INTERACTION ─────────────────────────────────────────────
function spinDial(i, dir) {
  // dir: +1 = next letter, -1 = prev letter
  const wheel  = state.dialWheels[i]
  const newPos = (state.dialPositions[i] + dir + wheel.length) % wheel.length
  state.dialPositions[i] = newPos

  const window = document.querySelector(`.dial-window[data-i="${i}"]`)
  if (!window) return

  const letter = wheel[newPos]
  const letterEl = window.querySelector('.dial-letter')

  // Quick flip animation
  letterEl.style.transform = dir > 0 ? 'translateY(-6px)' : 'translateY(6px)'
  letterEl.style.opacity   = '0'
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      letterEl.textContent = letter
      letterEl.style.transform = 'translateY(0)'
      letterEl.style.opacity   = '1'
    })
  })

  // Update aria
  window.setAttribute('aria-label', `Dial ${i+1}: ${letter}`)
}

function attachDialEvents() {
  // Up/down buttons
  document.querySelectorAll('.dial-up').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      spinDial(parseInt(btn.dataset.i), -1)
    })
  })

  document.querySelectorAll('.dial-dn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      spinDial(parseInt(btn.dataset.i), 1)
    })
  })

  // Touch swipe on dial window
  document.querySelectorAll('.dial-window').forEach(win => {
    let startY = null
    win.addEventListener('pointerdown', (e) => {
      startY = e.clientY
      win.setPointerCapture(e.pointerId)
    })
    win.addEventListener('pointermove', (e) => {
      if (startY === null) return
      const dy = e.clientY - startY
      if (Math.abs(dy) > 18) {
        spinDial(parseInt(win.dataset.i), dy > 0 ? 1 : -1)
        startY = e.clientY
      }
    })
    win.addEventListener('pointerup', () => { startY = null })
    win.addEventListener('pointercancel', () => { startY = null })
  })
}

// ── KEYBOARD ─────────────────────────────────────────────────────
let focusedDial = 0

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (state.done) return

    // Letter typing — advance focused dial to that letter
    if (/^[a-zA-Z]$/.test(e.key)) {
      const target = e.key.toUpperCase()
      const wheel  = state.dialWheels[focusedDial]
      const idx    = wheel.indexOf(target)
      if (idx >= 0) {
        state.dialPositions[focusedDial] = idx
        updateDialDisplay(focusedDial)
        if (focusedDial < state.words[state.level].length - 1) focusedDial++
      }
      return
    }

    if (e.key === 'ArrowUp')    { e.preventDefault(); spinDial(focusedDial, -1) }
    if (e.key === 'ArrowDown')  { e.preventDefault(); spinDial(focusedDial, 1) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); if (focusedDial > 0) focusedDial-- }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (focusedDial < state.words[state.level].length - 1) focusedDial++ }
    if (e.key === 'Enter')      { submitGuess() }
  })
}

function updateDialDisplay(i) {
  const win    = document.querySelector(`.dial-window[data-i="${i}"]`)
  const letter = state.dialWheels[i][state.dialPositions[i]]
  if (win) {
    win.querySelector('.dial-letter').textContent = letter
    win.setAttribute('aria-label', `Dial ${i+1}: ${letter}`)
  }
}

// ── SUBMIT ────────────────────────────────────────────────────────
async function submitGuess() {
  if (state.done) return
  if (state.guessesUsed >= MAX_GUESSES) return

  const word  = state.words[state.level]
  const guess = state.dialWheels.map((wheel, i) => wheel[state.dialPositions[i]]).join('')

  state.guessesUsed++
  renderGuessRemaining()
  markUsedPip(state.guessesUsed - 1)

  // Check each letter
  let allCorrect = true
  guess.split('').forEach((letter, i) => {
    if (letter === word[i]) {
      state.correctMask[i] = true
    } else {
      allCorrect = false
    }
  })

  // Animate feedback
  await animateFeedback(allCorrect)

  if (allCorrect) {
    await crackLevel()
  } else {
    // Shake
    document.querySelector('.lock-body').classList.add('shake')
    setTimeout(() => document.querySelector('.lock-body').classList.remove('shake'), 500)

    if (state.guessesUsed >= MAX_GUESSES) {
      failGame()
    } else {
      saveDailyState()
    }
  }
}

function markUsedPip(idx) {
  const pip = document.querySelector(`.pip[data-pip="${idx}"]`)
  if (pip) pip.classList.add('used')
}

async function animateFeedback(allCorrect) {
  const wins = document.querySelectorAll('.dial-window')
  wins.forEach((win, i) => {
    const correct = state.correctMask[i]
    if (correct && !win.classList.contains('correct')) {
      win.classList.add('correct', 'pop')
      setTimeout(() => win.classList.remove('pop'), 400)
    }
  })
  await sleep(300)
}

async function crackLevel() {
  const tries = state.guessesUsed - state.guessesAtLevelStart
  state.levelResults.push({ solved: true, tries })

  // Update pip colors
  renderGuessPips()

  // Shackle open animation
  document.getElementById('lock-shackle').classList.add('open')
  await sleep(600)

  showToast(WIN_MESSAGES[Math.floor(Math.random() * WIN_MESSAGES.length)])
  await sleep(700)

  if (state.level < 2) {
    state.level++
    state.guessesAtLevelStart = state.guessesUsed
    state.correctMask = []
    state.dialPositions = []
    focusedDial = 0

    // Reset shackle
    document.getElementById('lock-shackle').classList.remove('open')
    buildDialsForCurrentLevel()
    renderAll()
  } else {
    // All 3 cracked — win!
    state.done = true
    state.won  = true
    saveDailyState()
    const stats = recordResult(true, state.guessesUsed, state.todayStr)
    renderStats(stats, state.guessesUsed)
    document.getElementById('stats-actions').removeAttribute('hidden')
    await sleep(400)
    showEndModal(true)
  }

  saveDailyState()
}

function failGame() {
  state.done = true
  state.won  = false

  // Fill remaining levels as failed
  while (state.levelResults.length < 3) {
    state.levelResults.push({ solved: false, tries: 0 })
  }

  saveDailyState()
  const stats = recordResult(false, state.guessesUsed, state.todayStr)
  renderStats(stats, null)
  showEndModal(false)
}

// ── END MODAL ─────────────────────────────────────────────────────
let endPageIdx = 0
let endPageTotal = 0

function buildEndPages(won) {
  const pages = []

  if (won) {
    pages.push({
      title: 'VAULT OPEN',
      body:  `You cracked all 3 locks in ${state.guessesUsed} of ${MAX_GUESSES} guesses. The combination was yours all along.`,
      showAnswers: false,
    })
  } else {
    // Show answer for the level they were on
    const failLevel = state.levelResults.filter(r => r.solved).length
    const failWord  = state.words[failLevel] || state.words[state.level]
    const failHint  = state.hints[failLevel] || state.hints[state.level]

    FAIL_PAGES.forEach((fp, i) => {
      const page = { ...fp }
      if (i === 0) {
        page.answerWord = failWord
        page.answerHint = failHint
      }
      pages.push(page)
    })
  }

  return pages
}

function showEndModal(won) {
  const pages    = buildEndPages(won)
  endPageTotal   = pages.length
  endPageIdx     = 0

  const container = document.getElementById('end-pages')
  container.innerHTML = pages.map((page, i) => {
    let html = `<div class="end-page ${i === 0 ? 'active' : ''}">`

    if (page.title) html += `<p class="end-page-title">${page.title}</p>`
    if (page.achievement) {
      html += `<div class="end-achievement">
        <div class="end-achievement-title">ACHIEVEMENT UNLOCKED</div>
        <p><em>${page.achievement}</em></p>
      </div>`
    }
    if (page.body) {
      const paragraphs = page.body.split('\n\n')
      html += paragraphs.map(p => `<p>${p}</p>`).join('')
    }
    if (page.answerWord) {
      html += `<div class="answer-reveal">
        The lock you couldn't crack was:<br>
        <span class="word-answer">${page.answerWord}</span><br>
        <em>${page.answerHint}</em>
      </div>`
    }

    html += '</div>'
    return html
  }).join('')

  // Dots
  const dotWrap = document.getElementById('end-page-dot')
  dotWrap.innerHTML = pages.map((_, i) =>
    `<span class="end-dot ${i === 0 ? 'active' : ''}"></span>`
  ).join('')

  updateEndNav()
  document.getElementById('modal-end').removeAttribute('hidden')
}

function updateEndNav() {
  document.getElementById('end-prev').disabled = endPageIdx === 0
  document.getElementById('end-next').disabled = endPageIdx === endPageTotal - 1
  document.querySelectorAll('.end-dot').forEach((d, i) => {
    d.classList.toggle('active', i === endPageIdx)
  })
}

function goEndPage(dir) {
  const pages = document.querySelectorAll('.end-page')
  pages[endPageIdx].classList.remove('active')
  endPageIdx = Math.max(0, Math.min(endPageTotal - 1, endPageIdx + dir))
  pages[endPageIdx].classList.add('active')
  updateEndNav()
}

// ── TIMER ─────────────────────────────────────────────────────────
function startNextPuzzleTimer() {
  function tick() {
    const now      = new Date()
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    const ms       = midnight - now
    const h  = String(Math.floor(ms / 3_600_000)).padStart(2, '0')
    const m  = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0')
    const s  = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')
    const el = document.getElementById('next-timer')
    if (el) el.textContent = `${h}:${m}:${s}`
  }
  tick()
  setInterval(tick, 1000)
}

// ── SHARE ─────────────────────────────────────────────────────────
async function doShare() {
  const text = buildShareText(state.dayIndex, state.guessesUsed, MAX_GUESSES, state.levelResults)
  const ok   = await copyShareText(text)
  showToast(ok ? 'COPIED TO CLIPBOARD!' : 'COPY FAILED — try manually')
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2100)
}

// ── MODALS ────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).removeAttribute('hidden')
}

function closeModal(id) {
  document.getElementById(id).setAttribute('hidden', '')
}

// ── EVENTS ────────────────────────────────────────────────────────
function setupEvents() {
  // Header buttons
  document.getElementById('btn-how').addEventListener('click', () => openModal('modal-how'))
  document.getElementById('btn-stats').addEventListener('click', () => {
    renderStats(loadStats(), null)
    openModal('modal-stats')
  })

  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close))
  })

  // Overlay click to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id)
    })
  })

  // Submit
  document.getElementById('submit-btn').addEventListener('click', submitGuess)

  // Share
  document.getElementById('share-btn').addEventListener('click', doShare)
  document.getElementById('end-share-btn').addEventListener('click', doShare)

  // End page nav
  document.getElementById('end-prev').addEventListener('click', () => goEndPage(-1))
  document.getElementById('end-next').addEventListener('click', () => goEndPage(1))

  // Keyboard
  setupKeyboard()

  // Timer
  startNextPuzzleTimer()
}

// ── UTILITY ───────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── BOOT ──────────────────────────────────────────────────────────
init()
