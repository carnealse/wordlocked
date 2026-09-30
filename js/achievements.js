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
 *   check   ({ stats, today }) => boolean
 *
 * check() runs once per finished puzzle, and only for achievements not yet
 * earned, so an achievement can never pop twice.
 *
 * stats  : saved stats, plus derived `losses`
 *          (played, wins, losses, streak, lossStreak, maxStreak)
 * today  : { status: 'won' | 'lost', results: [{ solved, tries }], puzzleNumber }
 *          stats already include today's game.
 */

import { storage } from './storage.js'

const KEY = 'achievements'

const wonToday  = t => t.status === 'won'
const lostToday = t => t.status === 'lost'

export const ACHIEVEMENTS = [
  {
    id: 'first-win',
    name: 'First Crack',
    hint: 'Win a daily puzzle for the first time.',
    body: ['Your first cracked vault. The Lock is pretending it was going easy on you.'],
    reward: 'One small victory dance. Redeemable anywhere.',
    check: ({ stats, today }) => wonToday(today) && stats.wins >= 1,
  },
  {
    id: 'first-fail',
    name: 'Linguistic Mistake Maker',
    hint: 'Fail a daily puzzle for the first time.',
    body: ['You stared at the lock, threw a dictionary at it, and missed every single word.'],
    reward: 'A single dose of unlocked regret. This reward cannot be shared or re-gifted.',
    check: ({ stats, today }) => lostToday(today) && stats.losses >= 1,
  },
  {
    id: 'five-fails',
    name: 'Frequent Flyer',
    hint: 'Fail 5 daily puzzles in total.',
    body: ['Five fails. The lock has started saving you a seat.'],
    reward: "A loyalty punch card for the Lock's gift shop. The gift shop is closed.",
    check: ({ stats, today }) => lostToday(today) && stats.losses >= 5,
  },
  {
    id: 'fail-4',
    name: 'Locked Out at the Door',
    hint: 'Fail the 4 letter lock.',
    body: ['The very first lock beat you. You never even made it inside the building.'],
    reward: 'A welcome mat that says GO AWAY.',
    check: ({ today }) => today.results[0] != null && !today.results[0].solved,
  },
  {
    id: 'fail-6',
    name: 'One Tumbler Short',
    hint: 'Fail the 6 letter lock.',
    body: ['You cracked two locks, then the six letter one said no. Politely. With a smirk.'],
    reward: 'A commemorative key that opens absolutely nothing.',
    check: ({ today }) => today.results[2] != null && !today.results[2].solved,
  },
  {
    id: 'back-to-back',
    name: 'Back to Back',
    hint: 'Win 2 days in a row.',
    body: ['Two days, two cracked vaults. The Lock is starting to take this personally.'],
    reward: 'A long, suspicious stare from the Lock.',
    check: ({ stats, today }) => wonToday(today) && stats.streak >= 2,
  },
  {
    id: 'week-streak',
    name: 'Week of Locks',
    hint: 'Win 7 days in a row.',
    body: ['Seven days in a row. You have officially become a problem for the vault.'],
    reward: 'Bragging rights that can only be lost by missing tomorrow.',
    check: ({ stats, today }) => wonToday(today) && stats.streak >= 7,
  },
  {
    id: 'flawless-vault',
    name: 'Flawless Vault',
    hint: 'Crack all three locks on the first guess.',
    body: ['All three locks, first guess each. Either you are a genius or you peeked.'],
    reward: 'The Lock demands a recount.',
    check: ({ today }) =>
      wonToday(today) && today.results.length === 3 && today.results.every(r => r.solved && r.tries === 1),
  },
  {
    id: 'sweating-bullets',
    name: 'Sweating Bullets',
    hint: 'Solve any lock on your last guess.',
    body: ['You solved a lock on your very last guess. Your heart rate would like a word.'],
    reward: 'A fresh towel and a glass of water.',
    check: ({ today }) => today.results.some(r => r.solved && r.tries === 5),
  },
]

/** @returns {{ earned: Record<string, number>, lastChecked: number }} */
function load() {
  const saved = storage.get(KEY, {})
  return {
    earned: saved.earned && typeof saved.earned === 'object' ? saved.earned : {},
    lastChecked: Number.isInteger(saved.lastChecked) ? saved.lastChecked : 0,
  }
}

/**
 * Evaluate achievements for a finished puzzle and return everything earned
 * on that puzzle. Safe to call repeatedly: the check runs at most once per
 * puzzle number, and later calls return the same list without re-awarding.
 *
 * @param {{ stats: Object, today: { status: string, results: Array, puzzleNumber: number } }} ctx
 * @returns {Array} achievement definitions earned on today.puzzleNumber
 */
export function awardAchievements({ stats, today }) {
  const store = load()

  if (store.lastChecked !== today.puzzleNumber) {
    const ctx = {
      stats: { ...stats, losses: stats.played - stats.wins },
      today,
    }
    for (const def of ACHIEVEMENTS) {
      if (store.earned[def.id] == null && def.check(ctx)) {
        store.earned[def.id] = today.puzzleNumber
      }
    }
    store.lastChecked = today.puzzleNumber
    storage.set(KEY, store)
  }

  return ACHIEVEMENTS.filter(def => store.earned[def.id] === today.puzzleNumber)
}

/**
 * Everything for the trophy case, earned or not.
 * @returns {{ id: string, name: string, hint: string, earnedOn: number | null }[]}
 */
export function trophyEntries() {
  const { earned } = load()
  return ACHIEVEMENTS.map(({ id, name, hint }) => ({
    id, name, hint,
    earnedOn: earned[id] ?? null,
  }))
}
