/**
 * ui.js
 * Renders DOM from state. Never holds state — reads only.
 * All animation is CSS-driven; JS only toggles classes.
 */

import { getState } from './state.js'
import { LOCK_LENGTHS, LOCK_COUNT, MAX_GUESSES } from './config.js'
import { pickFailMessage, pickConsolation, pickWinMessage } from './messages.js'

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

/** Shows the share button and countdown in the stats modal. */
export function revealStatsActions() {
  document.getElementById('stats-actions').removeAttribute('hidden')
}

// ── HUD: GUESS PIPS + STAGE CHIPS ─────────────────────────────────
/** @type {HTMLSpanElement[]} */
let _pips = []
/** @type {{ chip: HTMLDivElement, lock: HTMLSpanElement, length: number }[]} */
let _chips = []

function el(tag, className, text) {
  const node = document.createElement(tag)
  node.className = className
  if (text) node.textContent = text
  return node
}

function decorative(node) {
  node.setAttribute('aria-hidden', 'true')
  return node
}

/** Builds one pip per guess and one chip per lock from config. Call once, before any render. */
export function buildHud() {
  _pips = Array.from({ length: MAX_GUESSES }, () => el('span', 'pip'))
  document.getElementById('pips').replaceChildren(..._pips)

  _chips = LOCK_LENGTHS.map(length => {
    const chip = el('div', 'stage-chip')
    const lock = decorative(el('span', 'stage-lock', '🔒'))
    chip.append(lock, el('span', 'stage-chip__label', `${length} letters`))
    return { chip, lock, length }
  })
  document.getElementById('stage-bar').replaceChildren(
    ..._chips.flatMap(({ chip }, i) => i ? [decorative(el('span', 'stage-arrow', '→')), chip] : [chip])
  )
}

export function renderPips() {
  const { guessesUsed } = getState()
  _pips.forEach((pip, i) => pip.classList.toggle('pip--used', i < guessesUsed))
  document.getElementById('pips').setAttribute('aria-label', `${guessesUsed} of ${MAX_GUESSES} guesses used`)
  const rem = MAX_GUESSES - guessesUsed
  document.getElementById('guess-remaining').textContent =
    `${rem} ${rem === 1 ? 'guess' : 'guesses'} left`
}

const STAGE = {
  done:    { modifier: 'stage-chip--done',   icon: '🔓', label: 'cracked' },
  failed:  { modifier: 'stage-chip--failed', icon: '🔒', label: 'failed' },
  active:  { modifier: 'stage-chip--active', icon: '🔒', label: 'current lock' },
  pending: { modifier: null,                 icon: '🔒', label: 'locked' },
}

function stageOf(i, { level, results, status }) {
  if (results[i]) return results[i].solved ? STAGE.done : STAGE.failed
  return i === level && status === 'playing' ? STAGE.active : STAGE.pending
}

export function renderStages() {
  const state = getState()
  _chips.forEach(({ chip, lock, length }, i) => {
    const stage = stageOf(i, state)
    chip.className = stage.modifier ? `stage-chip ${stage.modifier}` : 'stage-chip'
    chip.setAttribute('aria-label', `${length} letters, ${stage.label}`)
    if (stage === STAGE.active) chip.setAttribute('aria-current', 'step')
    else chip.removeAttribute('aria-current')
    lock.textContent = stage.icon
  })
}

// ── HINT ──────────────────────────────────────────────────────────
export function renderHint() {
  const { hints, level } = getState()
  document.getElementById('hint-text').textContent = hints[level] ?? '—'
}

// ── DIALS ─────────────────────────────────────────────────────────
/**
 * Renders tumbler-style dials.
 * Each dial shows 3 letters: prev | current | next in a horizontal drum window.
 * Paired < > buttons live in the left control column (#lock-btns).
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
    lBtn.textContent = '<'
    lBtn.addEventListener('pointerdown', e => {
      e.preventDefault()
      lBtn.classList.add('drum-btn--pressed')
      onSpinLeft(i)
    })
    lBtn.addEventListener('pointerup',     () => lBtn.classList.remove('drum-btn--pressed'))
    lBtn.addEventListener('pointerleave',  () => lBtn.classList.remove('drum-btn--pressed'))
    lBtn.addEventListener('pointercancel', () => lBtn.classList.remove('drum-btn--pressed'))

    const rBtn = document.createElement('button')
    rBtn.className = 'drum-btn'
    rBtn.setAttribute('aria-label', `Dial ${i + 1} next`)
    rBtn.setAttribute('tabindex', '-1')
    rBtn.textContent = '>'
    rBtn.addEventListener('pointerdown', e => {
      e.preventDefault()
      rBtn.classList.add('drum-btn--pressed')
      onSpinRight(i)
    })
    rBtn.addEventListener('pointerup',     () => rBtn.classList.remove('drum-btn--pressed'))
    rBtn.addEventListener('pointerleave',  () => rBtn.classList.remove('drum-btn--pressed'))
    rBtn.addEventListener('pointercancel', () => rBtn.classList.remove('drum-btn--pressed'))

    pair.appendChild(lBtn)
    pair.appendChild(rBtn)
    btnsEl.appendChild(pair)

    // Drum window — right column (fixed clipped frame; never translated)
    const drum = document.createElement('div')
    drum.className    = `drum${isCorrect ? ' drum--correct' : ''}`
    drum.id           = `dial-${i}`
    drum.dataset.dial = i
    drum.setAttribute('role', 'spinbutton')
    drum.setAttribute('aria-label', `Dial ${i + 1}: ${cur}`)
    drum.setAttribute('tabindex', '0')

    const prev2 = wheel[(pos - 2 + len) % len]
    const next2 = wheel[(pos + 2) % len]

    // 5-cell strip: viewport shows the middle three; strip slides inside .drum
    drum.innerHTML = `
      <div class="drum__strip" data-pos="-20">
        <span class="drum__cell drum__ghost" data-cell="prev2">${prev2}</span>
        <span class="drum__cell drum__ghost" data-cell="prev">${prev}</span>
        <span class="drum__cell drum__active" data-cell="cur">${cur}</span>
        <span class="drum__cell drum__ghost" data-cell="next">${next}</span>
        <span class="drum__cell drum__ghost" data-cell="next2">${next2}</span>
      </div>
      <div class="drum__fade drum__fade--l" aria-hidden="true"></div>
      <div class="drum__fade drum__fade--r" aria-hidden="true"></div>`

    drum.addEventListener('pointerdown',   e => onSwipeStart(e, i))
    drum.addEventListener('pointermove',   e => onSwipeMove(e, i))
    drum.addEventListener('pointerup',     e => onSwipeEnd(e, i))
    drum.addEventListener('pointercancel', e => onSwipeEnd(e, i))

    drumsEl.appendChild(drum)
  })
}

/** Write the five visible wheel letters into a drum strip (no motion). */
function _fillStrip(strip, wheel, pos) {
  const len = wheel.length
  strip.querySelector('[data-cell="prev2"]').textContent = wheel[(pos - 2 + len) % len]
  strip.querySelector('[data-cell="prev"]').textContent  = wheel[(pos - 1 + len) % len]
  strip.querySelector('[data-cell="cur"]').textContent   = wheel[pos]
  strip.querySelector('[data-cell="next"]').textContent  = wheel[(pos + 1) % len]
  strip.querySelector('[data-cell="next2"]').textContent = wheel[(pos + 2) % len]
}

/**
 * Incremental dial update after a spin.
 * Animates only `.drum__strip` inside the fixed, overflow-clipped `.drum` frame.
 * State is already advanced when this runs, so we seed the strip with the
 * previous letters, slide one cell, then settle on the new letters.
 */
export function updateDialDisplay(dialIdx, dir) {
  const { wheels, positions, correct } = getState()
  const wheel = wheels[dialIdx]
  const pos   = positions[dialIdx]
  const len   = wheel.length
  const fromPos = ((pos - dir) % len + len) % len

  const drum = document.getElementById(`dial-${dialIdx}`)
  if (!drum) return
  const strip = drum.querySelector('.drum__strip')
  if (!strip) return

  drum.setAttribute('aria-label', `Dial ${dialIdx + 1}: ${wheel[pos]}`)
  drum.classList.toggle('drum--correct', correct[dialIdx])

  // Cancel in-flight slide
  clearTimeout(strip._slideTimer)
  if (strip._onSlideEnd) {
    strip.removeEventListener('transitionend', strip._onSlideEnd)
    strip._onSlideEnd = null
  }

  // Seed previous letters at rest (no anim), then slide one cell
  strip.classList.add('drum__strip--no-anim')
  strip.classList.remove('drum__strip--slide-next', 'drum__strip--slide-prev')
  _fillStrip(strip, wheel, fromPos)
  strip.classList.add('drum__strip--rest')
  void strip.offsetWidth

  const slideClass = dir > 0 ? 'drum__strip--slide-next' : 'drum__strip--slide-prev'

  const finish = (e) => {
    if (e && e.target !== strip) return
    if (strip._onSlideEnd) {
      strip.removeEventListener('transitionend', strip._onSlideEnd)
      strip._onSlideEnd = null
    }
    clearTimeout(strip._slideTimer)
    strip.classList.add('drum__strip--no-anim')
    strip.classList.remove(slideClass)
    _fillStrip(strip, wheel, pos)
    strip.classList.add('drum__strip--rest')
    void strip.offsetWidth
    strip.classList.remove('drum__strip--no-anim')
  }

  strip._onSlideEnd = finish
  strip.addEventListener('transitionend', finish)
  strip.classList.remove('drum__strip--no-anim')
  strip.classList.add(slideClass)
  strip._slideTimer = setTimeout(() => finish(), 200)
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
let _endPageIdx = 0
let _endPages   = []

/**
 * Builds the end-of-day pages from plain data and opens the modal.
 *
 * Page order:
 *   won:  win message, newly unlocked achievements, trophy case
 *   lost: fail message (with answer), newly unlocked achievements,
 *         consolation prize, trophy case
 *
 * @param {boolean} won
 * @param {{ achievements?: import('./achievements.js').Achievement[],
 *           trophies?: import('./achievements.js').Trophy[] }} [extras]
 */
export function buildAndShowEndModal(won, { achievements = [], trophies = [] } = {}) {
  const { words, hints, level, totalGuesses, puzzleNumber } = getState()
  const pages = []

  if (won) {
    const msg = pickWinMessage(puzzleNumber)
    pages.push({
      title: msg.title,
      body: [...msg.body, `You cracked all ${LOCK_COUNT} locks using ${totalGuesses} total guesses.`],
    })
  } else {
    // A loss ends the day on the failed lock, so `level` still points at it.
    const msg = pickFailMessage(puzzleNumber)
    pages.push({
      title: msg.title,
      body: msg.body,
      answerWord: words[level],
      answerHint: hints[level],
    })
  }

  achievements.forEach(a => pages.push({
    achievement: a.name,
    body: a.body,
    reward: a.reward,
  }))

  if (!won) {
    const c = pickConsolation(puzzleNumber)
    pages.push({ title: c.title, body: c.body })
  }

  pages.push({ title: 'TROPHY CASE', trophies })

  _endPages   = pages
  _endPageIdx = 0
  _renderEndPages()
  openModal('modal-end')
}

function _trophyListHTML(trophies) {
  const earned = trophies.filter(t => t.earnedOn !== null).length
  const items = trophies.map(t => t.earnedOn !== null
    ? `<li class="trophy trophy--earned">
         <span class="trophy__name">${t.name}</span>
         <span class="trophy__meta">Puzzle #${t.earnedOn}</span>
       </li>`
    : `<li class="trophy trophy--locked">
         <span class="trophy__name">???</span>
         <span class="trophy__meta">${t.hint}</span>
       </li>`
  ).join('')
  return `<p class="trophy-count">${earned} / ${trophies.length} unlocked</p>
          <ul class="trophy-list">${items}</ul>`
}

/** Opens the standalone trophy case modal. */
export function openTrophyCase(trophies) {
  document.getElementById('trophy-list').innerHTML = _trophyListHTML(trophies)
  openModal('modal-trophies')
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
    ;(page.body ?? []).forEach(p => { html += `<p class="end-page__body">${p}</p>` })
    if (page.reward)      html += `<p class="end-page__body end-page__reward">Reward: ${page.reward}</p>`
    if (page.answerWord)  html += `<div class="answer-reveal">
      The lock you couldn't crack:<br>
      <span class="answer-reveal__word">${page.answerWord}</span>
      <span class="answer-reveal__hint">${page.answerHint}</span>
    </div>`
    if (page.trophies)    html += _trophyListHTML(page.trophies)
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
