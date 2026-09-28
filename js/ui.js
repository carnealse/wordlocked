/**
 * ui.js
 * Renders DOM from state. Never holds state — reads only.
 * All animation is CSS-driven; JS only toggles classes.
 */

import { getState, MAX } from './state.js'

// ── TOAST ────────────────────────────────────────────────────────
let _toastTimer = null

export function showToast(msg, duration = 2000) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.remove('toast--out')
  el.classList.add('toast--in')

  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => {
    el.classList.replace('toast--in', 'toast--out')
  }, duration)
}

// ── MODALS ────────────────────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.removeAttribute('hidden')
  el.querySelector('[data-autofocus]')?.focus()
}

export function closeModal(id) {
  document.getElementById(id)?.setAttribute('hidden', '')
}

// ── GUESS PIPS ────────────────────────────────────────────────────
export function renderPips() {
  const { guessesUsed, results } = getState()

  // Determine pip colour per guess slot
  // Cracked slots get green; used-but-not-cracked get red; unused stay neutral
  const crackedGuesses = new Set()
  let g = 0
  results.forEach(r => {
    if (r.solved) {
      for (let i = 0; i < r.tries; i++) crackedGuesses.add(g++)
    } else {
      g += r.tries
    }
  })

  document.querySelectorAll('.pip').forEach((pip, i) => {
    pip.className = 'pip'
    if (i < guessesUsed) {
      pip.classList.add(crackedGuesses.has(i) ? 'pip--cracked' : 'pip--used')
    }
  })

  const rem = MAX - guessesUsed
  document.getElementById('guess-remaining').textContent =
    `${rem} ${rem === 1 ? 'guess' : 'guesses'} left`
}

// ── STAGE CHIPS ───────────────────────────────────────────────────
export function renderStages() {
  const { level, results, status } = getState()

  for (let i = 0; i < 3; i++) {
    const chip = document.getElementById(`stage-${i}`)
    const lock = chip.querySelector('.stage-lock')
    chip.className = 'stage-chip'

    if (results[i]?.solved) {
      chip.classList.add('stage-chip--done')
      lock.textContent = '🔓'
    } else if (i === level && status === 'playing') {
      chip.classList.add('stage-chip--active')
      lock.textContent = '🔒'
    } else {
      lock.textContent = '🔒'
    }
  }
}

// ── HINT ──────────────────────────────────────────────────────────
export function renderHint() {
  const { hints, level } = getState()
  document.getElementById('hint-text').textContent = hints[level] ?? '—'
}

// ── DIALS ─────────────────────────────────────────────────────────

/**
 * Full re-render of the dials row.
 * Called on level change or initial load.
 * Incremental updates (spin) go through updateDialDisplay().
 */
export function renderDials(onSpinUp, onSpinDown, onSwipeStart, onSwipeMove, onSwipeEnd) {
  const { wheels, positions, correct } = getState()
  const row = document.getElementById('dials-row')
  row.innerHTML = ''

  wheels.forEach((wheel, i) => {
    const letter  = wheel[positions[i]]
    const isCorrect = correct[i]

    const col = document.createElement('div')
    col.className = 'dial-col'

    col.innerHTML = `
      <button class="dial-btn dial-btn--up"
              data-dial="${i}"
              aria-label="Advance dial ${i + 1} up"
              tabindex="-1">▲</button>

      <div class="dial-window${isCorrect ? ' dial-window--correct' : ''}"
           id="dial-${i}"
           data-dial="${i}"
           role="spinbutton"
           aria-valuenow="${i}"
           aria-label="Dial ${i + 1}: ${letter}"
           tabindex="0">
        <div class="dial-strip">
          <span class="dial-letter">${letter}</span>
        </div>
      </div>

      <button class="dial-btn dial-btn--dn"
              data-dial="${i}"
              aria-label="Advance dial ${i + 1} down"
              tabindex="-1">▼</button>`

    row.appendChild(col)
  })

  // Attach dial-level events (delegated from row)
  row.querySelectorAll('.dial-btn--up').forEach(btn =>
    btn.addEventListener('pointerdown', e => {
      e.preventDefault()
      onSpinUp(parseInt(btn.dataset.dial))
    })
  )
  row.querySelectorAll('.dial-btn--dn').forEach(btn =>
    btn.addEventListener('pointerdown', e => {
      e.preventDefault()
      onSpinDown(parseInt(btn.dataset.dial))
    })
  )
  row.querySelectorAll('.dial-window').forEach(win => {
    win.addEventListener('pointerdown',  e => onSwipeStart(e, parseInt(win.dataset.dial)))
    win.addEventListener('pointermove',  e => onSwipeMove(e,  parseInt(win.dataset.dial)))
    win.addEventListener('pointerup',    e => onSwipeEnd(e,   parseInt(win.dataset.dial)))
    win.addEventListener('pointercancel',e => onSwipeEnd(e,   parseInt(win.dataset.dial)))
  })
}

/**
 * Incremental dial update after a spin — avoids full re-render.
 * @param {number}  dialIdx
 * @param {string}  letter
 * @param {boolean} correct
 * @param {number}  dir      +1 | -1 for animation direction
 */
export function updateDialDisplay(dialIdx, letter, correct, dir) {
  const win = document.getElementById(`dial-${dialIdx}`)
  if (!win) return

  const strip = win.querySelector('.dial-strip')

  // Slide out
  strip.style.transition = 'none'
  strip.style.transform  = `translateY(${dir > 0 ? '-' : ''}40%)`
  strip.style.opacity    = '0'

  requestAnimationFrame(() => {
    strip.querySelector('.dial-letter').textContent = letter
    win.setAttribute('aria-label', `Dial ${dialIdx + 1}: ${letter}`)

    requestAnimationFrame(() => {
      strip.style.transition = 'transform 0.12s ease, opacity 0.1s ease'
      strip.style.transform  = 'translateY(0)'
      strip.style.opacity    = '1'
    })
  })

  win.classList.toggle('dial-window--correct', correct)
}

/**
 * Flash all dials green on a successful crack.
 */
export function animateCrack() {
  document.querySelectorAll('.dial-window').forEach((win, i) => {
    setTimeout(() => {
      win.classList.add('dial-window--pop')
      win.addEventListener('animationend', () =>
        win.classList.remove('dial-window--pop'), { once: true })
    }, i * 60)
  })
}

/**
 * Open the shackle with a CSS class, resolve after animation.
 */
export function animateShackleOpen() {
  return new Promise(resolve => {
    const shackle = document.getElementById('lock-shackle')
    shackle.classList.add('lock-shackle--open')
    setTimeout(resolve, 600)
  })
}

/** Reset shackle to closed position (instant, no animation) */
export function resetShackle() {
  const shackle = document.getElementById('lock-shackle')
  shackle.classList.remove('lock-shackle--open')
}

/**
 * Shake the lock body on a wrong guess.
 */
export function animateShake() {
  const body = document.getElementById('lock-body')
  body.classList.add('lock-body--shake')
  body.addEventListener('animationend', () =>
    body.classList.remove('lock-body--shake'), { once: true })
}

/**
 * Highlight which dials are correct after a guess (before a crack).
 */
export function flashCorrectDials() {
  const { correct } = getState()
  correct.forEach((isCorrect, i) => {
    const win = document.getElementById(`dial-${i}`)
    if (win && isCorrect) {
      win.classList.add('dial-window--correct')
    }
  })
}

// ── NEXT PUZZLE TIMER ─────────────────────────────────────────────
let _timerInterval = null

export function startCountdownTimer() {
  const el = document.getElementById('next-timer')
  if (!el) return

  const tick = () => {
    const now  = new Date()
    const next = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
    ))
    const ms = next - now
    const h  = String(Math.floor(ms / 3_600_000)).padStart(2, '0')
    const m  = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0')
    const s  = String(Math.floor((ms % 60_000) / 1_000)).padStart(2, '0')
    el.textContent = `${h}:${m}:${s}`
  }

  clearInterval(_timerInterval)
  tick()
  _timerInterval = setInterval(tick, 1_000)
}

// ── END MODAL ─────────────────────────────────────────────────────
const FAIL_PAGES = [
  {
    title: 'SYSTEM ANNOUNCEMENT',
    body: [
      'Well, well, well. Look who decided to play digital locksmith and locked themselves out of victory instead.',
      'The Bad News: Today\'s password puzzle has thoroughly defeated you. The lock didn\'t even click. It just made a tiny, wet raspberry sound at you.',
      'The Good News: The Lock is merciful. Mostly because watching you brings it phenomenal entertainment value. The vault resets tomorrow — you get to wake up, stare at a brand new blank screen, and confidently type complete gibberish all over again.',
    ],
    showAnswer: true,
  },
  {
    title: 'ACHIEVEMENT UNLOCKED',
    achievement: 'Linguistic Mistake Maker',
    body: [
      'You stared at the lock, threw a dictionary at it, and missed every single word.',
      'Reward: A single dose of locked regret. This reward cannot be shared or re-gifted.',
    ],
  },
  {
    title: 'CONSOLATION PRIZE',
    body: [
      'The combination lock has filed a restraining order. You are not permitted within 10 letters of it until tomorrow.',
      'See you at midnight UTC, when the vault resets and you can confidently type complete gibberish all over again.',
    ],
  },
]

const WIN_LINES = [
  'You cracked the combination.',
  'The vault doors swing open.',
  'The tumblers clicked into place.',
  "That's the sound of mastery.",
  'Combination confirmed.',
]

let _endPageIdx = 0
let _endPages   = []

export function buildAndShowEndModal(won) {
  const { words, hints, level, results, guessesUsed } = getState()

  _endPages = won
    ? [{ title: 'VAULT OPEN', body: [WIN_LINES[guessesUsed % WIN_LINES.length], `You cracked all 3 locks using ${guessesUsed} of ${MAX} total guesses.`], showAnswer: false }]
    : FAIL_PAGES.map((p, i) => ({
        ...p,
        answerWord: i === 0 ? words[results.filter(r => r.solved).length] ?? words[level] : null,
        answerHint: i === 0 ? hints[results.filter(r => r.solved).length]  ?? hints[level]  : null,
      }))

  _endPageIdx = 0
  _renderEndPages()
  openModal('modal-end')
}

function _renderEndPages() {
  const container = document.getElementById('end-pages')
  container.innerHTML = _endPages.map((page, i) => {
    let html = `<div class="end-page${i === 0 ? ' end-page--active' : ''}">`
    if (page.title) html += `<p class="end-page__title">${page.title}</p>`
    if (page.achievement) {
      html += `<div class="achievement">
        <span class="achievement__label">ACHIEVEMENT UNLOCKED</span>
        <span class="achievement__name">${page.achievement}</span>
      </div>`
    }
    page.body.forEach(p => { html += `<p class="end-page__body">${p}</p>` })
    if (page.answerWord) {
      html += `<div class="answer-reveal">
        The lock you couldn't crack:<br>
        <span class="answer-reveal__word">${page.answerWord}</span>
        <span class="answer-reveal__hint">${page.answerHint}</span>
      </div>`
    }
    html += '</div>'
    return html
  }).join('')

  _renderEndNav()
}

function _renderEndNav() {
  document.getElementById('end-prev').disabled = _endPageIdx === 0
  document.getElementById('end-next').disabled = _endPageIdx === _endPages.length - 1

  const dots = document.getElementById('end-dots')
  dots.innerHTML = _endPages.map((_, i) =>
    `<span class="end-dot${i === _endPageIdx ? ' end-dot--active' : ''}"></span>`
  ).join('')
}

export function navigateEndPage(dir) {
  const pages = document.querySelectorAll('.end-page')
  pages[_endPageIdx].classList.remove('end-page--active')
  _endPageIdx = Math.max(0, Math.min(_endPages.length - 1, _endPageIdx + dir))
  pages[_endPageIdx].classList.add('end-page--active')
  _renderEndNav()
}
