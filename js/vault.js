/**
 * vault.js
 * Tamper-evident storage for progress that earns rewards: stats, achievements and
 * today's game. Values are scrambled and signed with the key they were saved under,
 * so anything edited by hand, copied to another key, or written without the signer
 * reads back as missing and is erased.
 *
 * Reading is open to every module. Writing needs the writer, which main.js claims
 * once at startup and hands to the code that records progress, so it cannot be
 * obtained from the browser console afterwards.
 *
 * Everything here ships to the browser, so this stops casual cheating, not someone
 * willing to study and rewrite the game's code. Only server-side checks can do that.
 */

const PREFIX = 'wordlocked_'
const FORMAT = 'v1'
const SECRET = 'wl/7f3c9a1e/crack-the-lock/2c51d8b4'

/** cyrb53: fast 53-bit string hash. Not cryptographic; it only has to make forging tedious. */
function hash53(str, seed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const sign = (key, body) =>
  hash53(`${SECRET}|${key}|${body}`, 0x9e3779b9) + hash53(`${body}|${key}|${SECRET}`, 0x85ebca6b)

/** XOR the bytes with a keystream derived from the secret and the key. Symmetric. */
function xorBytes(bytes, key) {
  let s = parseInt(hash53(`${SECRET}#${key}`, 7).slice(0, 8), 36) >>> 0
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    out[i] = bytes[i] ^ ((t ^ (t >>> 14)) & 0xff)
  }
  return out
}

function seal(key, value) {
  const bytes = xorBytes(new TextEncoder().encode(JSON.stringify(value)), key)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  const body = btoa(binary)
  return `${FORMAT}.${body}.${sign(key, body)}`
}

function unseal(key, raw) {
  const [format, body, sig, extra] = raw.split('.')
  if (format !== FORMAT || !body || extra !== undefined || sig !== sign(key, body)) return undefined
  const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(xorBytes(bytes, key)))
}

/**
 * Read a sealed value. Missing, edited or unsigned values return the fallback,
 * and a value that fails the check is erased.
 */
export function readSealed(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const value = unseal(key, raw)
    if (value !== undefined) return value
    localStorage.removeItem(PREFIX + key)
  } catch {}
  return fallback
}

/**
 * @typedef {{ write(key: string, value: unknown): boolean, remove(key: string): void }} VaultWriter
 */

let claimed = false

/**
 * Only the copy of this module loaded by the page's own script may hand out a writer.
 * Importing it again from the console under another URL (e.g. with ?x) gives a fresh
 * copy, which this check refuses.
 */
function isPageCopy() {
  const entry = document.querySelector('script[type="module"][src$="main.js"]')
  return !!entry && import.meta.url === new URL('vault.js', entry.src).href
}

/**
 * Hand out the writer. Works once per page load, for main.js at startup.
 * @returns {VaultWriter}
 */
export function claimWriter() {
  if (claimed || !isPageCopy()) throw new Error('Vault writer is not available')
  claimed = true
  return Object.freeze({
    write(key, value) {
      try {
        localStorage.setItem(PREFIX + key, seal(key, value))
        return true
      } catch {
        return false
      }
    },
    remove(key) {
      try { localStorage.removeItem(PREFIX + key) } catch {}
    },
  })
}
