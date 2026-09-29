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
  _toastTimer = setTimeout(() => el.classList.replace('toast--in', 'toast--out'), duration)
}

// ── MODALS ────────────────────────────────────────────────────────
export function openModal(id) {
  document.getElementById(id)?.removeAttribute('hidden')
}

export function closeModal(id) {
  document.getElementById(id)?.setAttribute('hidden', '')
}

// ── GUESS PIPS ────────────────────────────────────────────────────
export function renderPips() {
  const { guessesUsed } = getState()
  document.querySelectorAll('.pip').forEach((pip, i) => {
    pip.className = 'pip'
    if (i < guessesUsed) pip.classList.add('pip--used')
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
      chip.classList.add('stage-chip--done'); lock.textContent = '🔓'
    } else if (results[i] && !results[i].solved) {
      chip.classList.add('stage-chip--failed'); lock.textContent = '🔒'
    } else if (i === level && status === 'playing') {
      chip.classList.add('stage-chip--active'); lock.textContent = '🔒'
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
 * Renders tumbler-style dials.
 * Each dial shows 3 letters: prev (top), current (center), next (bottom).
 * Left/right arrow buttons live in the side columns (#arrows-left / #arrows-right).
 * The red indicator line is pure CSS — positioned over the center row.
 */
export function renderDials(onSpinLeft, onSpinRight, onSwipeStart, onSwipeMove, onSwipeEnd) {
  const { wheels, positions, correct } = getState()
  const btnsEl  = document.getElementById('lock-btns')
  const drumsEl = document.getElementById('dials-row')
  btnsEl.innerHTML  = ''
  drumsEl.innerHTML = ''

  wheels.forEach((wheel, i) => {
    const pos       = positions[i]
    const len       = wheel.length
    const prev      = wheel[(pos - 1 + len) % len]
    const cur       = wheel[pos]
    const next      = wheel[(pos + 1) % len]
    const isCorrect = correct[i]

    // Button pair — left column
    const pair = document.createElement('div')
    pair.className = 'btn-pair'

    const lBtn = document.createElement('button')
    lBtn.className = 'drum-btn'
    lBtn.setAttribute('aria-label', `Dial ${i + 1} previous`)
    lBtn.setAttribute('tabindex', '-1')
    lBtn.textContent = '‹'
    lBtn.addEventListener('pointerdown', e => { e.preventDefault(); onSpinLeft(i) })

    const rBtn = document.createElement('button')
    rBtn.className = 'drum-btn'
    rBtn.setAttribute('aria-label', `Dial ${i + 1} next`)
    rBtn.setAttribute('tabindex', '-1')
    rBtn.textContent = '›'
    rBtn.addEventListener('pointerdown', e => { e.preventDefault(); onSpinRight(i) })

    pair.appendChild(lBtn)
    pair.appendChild(rBtn)
    btnsEl.appendChild(pair)

    // Drum window — right column
    const drum = document.createElement('div')
    drum.className    = `drum${isCorrect ? ' drum--correct' : ''}`
    drum.id           = `dial-${i}`
    drum.dataset.dial = i
    drum.setAttribute('role', 'spinbutton')
    drum.setAttribute('aria-label', `Dial ${i + 1}: ${cur}`)
    drum.setAttribute('tabindex', '0')

    drum.innerHTML = `
      <span class="drum__ghost">${prev}</span>
      <span class="drum__active">${cur}</span>
      <span class="drum__ghost">${next}</span>
      <div class="drum__fade drum__fade--l"></div>
      <div class="drum__fade drum__fade--r"></div>`

    drum.addEventListener('pointerdown',   e => onSwipeStart(e, i))
    drum.addEventListener('pointermove',   e => onSwipeMove(e, i))
    drum.addEventListener('pointerup',     e => onSwipeEnd(e, i))
    drum.addEventListener('pointercancel', e => onSwipeEnd(e, i))

    drumsEl.appendChild(drum)
  })
}

/**
 * Incremental dial update after a spin.
 * Replaces the three visible letters and re-applies correct state.
 */
export function updateDialDisplay(dialIdx, dir) {
  const { wheels, positions, correct } = getState()
  const wheel = wheels[dialIdx]
  const pos   = positions[dialIdx]
  const len   = wheel.length
  const prev  = wheel[(pos - 1 + len) % len]
  const cur   = wheel[pos]
  const next  = wheel[(pos + 1) % len]

  const drum = document.getElementById(`dial-${dialIdx}`)
  if (!drum) return

  const dx = dir > 0 ? '-30%' : '30%'
  drum.style.transition = 'none'
  drum.style.transform  = `translateX(${dx})`
  drum.style.opacity    = '0.5'

  requestAnimationFrame(() => {
    drum.querySelector('.drum__ghost:first-child').textContent = prev
    drum.querySelector('.drum__active').textContent = cur
    drum.querySelector('.drum__ghost:last-child').textContent = next
    drum.setAttribute('aria-label', `Dial ${dialIdx + 1}: ${cur}`)
    requestAnimationFrame(() => {
      drum.style.transition = 'transform 0.1s ease, opacity 0.08s ease'
      drum.style.transform  = 'translateX(0)'
      drum.style.opacity    = '1'
    })
  })

  drum.classList.toggle('drum--correct', correct[dialIdx])
}

export function animateCrack() {
  document.querySelectorAll('.drum').forEach((drum, i) => {
    setTimeout(() => {
      drum.classList.add('drum--pop')
      drum.addEventListener('animationend', () =>
        drum.classList.remove('drum--pop'), { once: true })
    }, i * 60)
  })
}

export function animateShackleOpen() {
  return new Promise(resolve => {
    document.getElementById('lock-shackle').classList.add('lock-shackle--open')
    setTimeout(resolve, 600)
  })
}

export function resetShackle() {
  document.getElementById('lock-shackle').classList.remove('lock-shackle--open')
}

export function animateShake() {
  const body = document.getElementById('lock-body')
  body.classList.add('lock-body--shake')
  body.addEventListener('animationend', () =>
    body.classList.remove('lock-body--shake'), { once: true })
}

export function flashCorrectDials() {
  const { correct } = getState()
  correct.forEach((isCorrect, i) => {
    if (isCorrect) document.getElementById(`dial-${i}`)?.classList.add('drum--correct')
  })
}

// ── COUNTDOWN TIMER ───────────────────────────────────────────────
let _timerInterval = null

export function startCountdownTimer() {
  const el = document.getElementById('next-timer')
  if (!el) return
  const tick = () => {
    const now  = new Date()
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    const ms   = next - now
    const h = String(Math.floor(ms / 3_600_000)).padStart(2, '0')
    const m = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0')
    const s = String(Math.floor((ms % 60_000) / 1_000)).padStart(2, '0')
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
      "The Bad News: Today's password puzzle has thoroughly defeated you. The lock didn't even click. It just made a tiny, wet raspberry sound at you.",
      "The Good News: The Lock is merciful. Mostly because watching you brings it phenomenal entertainment value. The vault resets tomorrow — you get to wake up, stare at a brand new blank screen, and confidently type complete gibberish all over again.",
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
  const { words, hints, level, results, totalGuesses } = getState()

  _endPages = won
    ? [{
        title: 'VAULT OPEN',
        body: [
          WIN_LINES[totalGuesses % WIN_LINES.length],
          `You cracked all 3 locks using ${totalGuesses} total guesses.`,
        ],
      }]
    : FAIL_PAGES.map((p, i) => ({
        ...p,
        answerWord: i === 0 ? (words[results.filter(r => r.solved).length] ?? words[level]) : null,
        answerHint: i === 0 ? (hints[results.filter(r => r.solved).length] ?? hints[level]) : null,
      }))

  _endPageIdx = 0
  _renderEndPages()
  openModal('modal-end')
}

function _renderEndPages() {
  const container = document.getElementById('end-pages')
  container.innerHTML = _endPages.map((page, i) => {
    let html = `<div class="end-page${i === 0 ? ' end-page--active' : ''}">`
    if (page.title)       html += `<p class="end-page__title">${page.title}</p>`
    if (page.achievement) html += `<div class="achievement">
      <span class="achievement__label">ACHIEVEMENT UNLOCKED</span>
      <span class="achievement__name">${page.achievement}</span>
    </div>`
    page.body.forEach(p => { html += `<p class="end-page__body">${p}</p>` })
    if (page.answerWord)  html += `<div class="answer-reveal">
      The lock you couldn't crack:<br>
      <span class="answer-reveal__word">${page.answerWord}</span>
      <span class="answer-reveal__hint">${page.answerHint}</span>
    </div>`
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
