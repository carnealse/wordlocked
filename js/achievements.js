/**
 * achievements.js
 * Achievement definitions, one-time awarding, and trophy case data.
 * Pure logic plus localStorage. No DOM access.
 *
 * To add an achievement, append an object to ACHIEVEMENTS:
 *   id      unique and permanent (it is the storage key, never rename it)
 *   name    shown on the popup and the trophy case once earned
 *   hint    shown in the trophy case while locked
 *   body    popup paragraphs
 *   reward  popup reward line
 *   check   (ctx: CheckContext) => boolean
 *
 * An achievement is stored the first time its check passes, so it can
 * never pop twice. New definitions are evaluated against the player's
 * saved stats, so long-time players earn them on their next finished day.
 */

import { storage } from './storage.js'
import { LOCK_LENGTHS, MAX_GUESSES } from './config.js'

const KEY = 'achievements'

/**
 * @typedef {Object} CheckContext
 * @property {import('./stats.js').Stats & { losses: number }} stats  already includes today
 * @property {{ status: 'won' | 'lost', results: import('./state.js').LevelResult[], puzzleNumber: number,
 *              date: string }} today  date is the puzzle day, 'YYYY-MM-DD' in Eastern time
 */

/**
 * @typedef {Object} Achievement
 * @property {string}   id
 * @property {string}   name
 * @property {string}   hint
 * @property {string[]} body
 * @property {string}   reward
 * @property {(ctx: CheckContext) => boolean} check
 */

/** @typedef {{ id: string, name: string, hint: string, earnedOn: number | null }} Trophy */

const won    = ({ today }) => today.status === 'won'
const lost   = ({ today }) => today.status === 'lost'
const failed = length => ({ today }) => today.results[LOCK_LENGTHS.indexOf(length)]?.solved === false
/** Won on a given calendar day, any year. monthDay is 'MM-DD'. */
const wonOn  = monthDay => ctx => won(ctx) && ctx.today.date?.endsWith(`-${monthDay}`)

/** @type {readonly Achievement[]} */
export const ACHIEVEMENTS = Object.freeze([
  {
    id: 'first-win',
    name: 'First Crack',
    hint: 'Win a daily puzzle for the first time.',
    body: ['Your first cracked vault. The Lock is pretending it was going easy on you.'],
    reward: 'One small victory dance. Redeemable anywhere.',
    check: won,
  },
  {
    id: 'first-fail',
    name: 'Linguistic Mistake Maker',
    hint: 'Fail a daily puzzle for the first time.',
    body: ['You stared at the lock, threw a dictionary at it, and missed every single word.'],
    reward: 'A single dose of unlocked regret. This reward cannot be shared or re-gifted.',
    check: lost,
  },
  {
    id: 'five-fails',
    name: 'Frequent Flyer',
    hint: 'Fail 5 daily puzzles in total.',
    body: ['Five fails. The lock has started saving you a seat on the bench.'],
    reward: "A loyalty punch card for the Lock's gift shop. Also, the gift shop is closed.",
    check: ctx => lost(ctx) && ctx.stats.losses >= 5,
  },
  {
    id: 'fail-4',
    name: 'Locked Out at the Door',
    hint: 'Fail the 4 letter lock.',
    body: ['The very first lock beat you. You never even made it inside the building.'],
    reward: 'A welcome mat that says GO AWAY.',
    check: failed(4),
  },
  {
    id: 'fail-6',
    name: 'One Tumbler Short',
    hint: 'Fail the 6 letter lock.',
    body: ['You cracked two locks, then the six letter one said no. Politely. With a smirk.'],
    reward: 'A commemorative key that opens absolutely nothing.',
    check: failed(6),
  },
  {
    id: 'back-to-back',
    name: 'Back to Back',
    hint: 'Win 2 days in a row.',
    body: ['Two days, two cracked vaults. The Lock is starting to take this personally.'],
    reward: 'A long, suspicious stare from the Lock.',
    check: ({ stats }) => stats.streak >= 2,
  },
  {
    id: 'week-streak',
    name: 'Week of Locks',
    hint: 'Win 7 days in a row.',
    body: ['Seven days in a row. You have officially become a problem for the vault locks.'],
    reward: 'Bragging rights that can only be lost by missing tomorrow.',
    check: ({ stats }) => stats.streak >= 7,
  },
  {
    id: 'dozen-streak',
    name: 'Dozen Glazed',
    hint: 'Win 12 days in a row.',
    body: ['Twelve straight wins. A full dozen, fresh out of the oven, and not a single one dropped on the floor.'],
    reward: 'A box of a dozen donuts. The Lock already ate the one with sprinkles.',
    check: ({ stats }) => stats.streak >= 12,
  },
  {
    id: 'flawless-vault',
    name: 'Flawless Vault',
    hint: 'Crack all three locks on the first guess.',
    body: ['All three locks, first guess each. Either you are a genius or you peeked.'],
    reward: 'The Lock demands a recount.',
    check: ctx => won(ctx) && ctx.today.results.every(r => r.tries === 1),
  },
  {
    id: 'sweating-bullets',
    name: 'Sweating Bullets',
    hint: 'Solve any lock on your last guess.',
    body: ['You solved a lock on your very last guess. Your heart rate would like a word.'],
    reward: 'A fresh towel and a glass of water.',
    check: ({ today }) => today.results.some(r => r.solved && r.tries === MAX_GUESSES),
  },
  {
    id: 'last-gasp-sweep',
    name: 'Living on the Edge',
    hint: 'Win all three locks, each on your last guess.',
    body: ['Three locks, three last guesses. You either love suspense or you hate yourself, and the Lock respects both.'],
    reward: 'A defibrillator. Gently used.',
    check: ctx => won(ctx) && ctx.today.results.every(r => r.tries === MAX_GUESSES),
  },
  {
    id: 'sixty-seven-wins',
    name: 'Six Seven',
    hint: 'Win 67 daily puzzles.',
    body: ['Sixty-seven wins. Somewhere a middle schooler just yelled "six seven" and nobody, including them, knows why.'],
    reward: 'The Lock refuses to explain the joke. Nobody can.',
    check: ({ stats }) => stats.wins >= 67,
  },
  {
    id: 'halloween-win',
    name: 'Trick or Lock',
    hint: 'Win the puzzle on Halloween.',
    body: ['You cracked the vault on Halloween. The Lock dressed up as a harder lock. It did not help.'],
    reward: 'One fun-size candy bar. The Lock ate the rest.',
    check: wonOn('10-31'),
  },
  {
    id: 'christmas-win',
    name: 'Unwrapped',
    hint: 'Win the puzzle on Christmas Day.',
    body: ['You spent Christmas breaking into a vault. Santa has questions, and so does the naughty list.'],
    reward: 'A lump of coal, gift wrapped. It is the thought that counts.',
    check: wonOn('12-25'),
  },
  {
    id: 'new-years-win',
    name: 'Resolution Kept',
    hint: "Win the puzzle on New Year's Day.",
    body: ['First puzzle of the year, cracked. That is one resolution kept, which already beats last year.'],
    reward: 'A gym membership you will never use.',
    check: wonOn('01-01'),
  },
])

/** @returns {Record<string, number>} achievement id -> puzzle number it was earned on */
function loadEarned() {
  const earned = storage.get(KEY)?.earned
  return earned?.constructor === Object ? earned : {}
}

/**
 * Evaluate every unearned achievement for a finished puzzle and persist any
 * that pass. Idempotent: calling again for the same day returns [].
 *
 * @param {{ stats: import('./stats.js').Stats, today: CheckContext['today'] }} ctx
 * @returns {Achievement[]} achievements unlocked by this call
 */
export function awardAchievements({ stats, today }) {
  const earned = loadEarned()
  const ctx = { stats: { ...stats, losses: stats.played - stats.wins }, today }
  const unlocked = ACHIEVEMENTS.filter(def => !Object.hasOwn(earned, def.id) && def.check(ctx))

  if (unlocked.length) {
    unlocked.forEach(def => { earned[def.id] = today.puzzleNumber })
    storage.set(KEY, { earned })
  }
  return unlocked
}

/** @returns {Trophy[]} every achievement, earned or not, in definition order */
export function trophyEntries() {
  const earned = loadEarned()
  return ACHIEVEMENTS.map(({ id, name, hint }) => ({ id, name, hint, earnedOn: earned[id] ?? null }))
}
