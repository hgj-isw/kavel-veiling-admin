/**
 * AES-256-GCM backup envelope v1 (client-side Web Crypto).
 * Contract: docs/biedingen-backup.md — no raw CSV/JSON on disk.
 */

export const BACKUP_VERSION = 1
export const BACKUP_ALG = 'AES-256-GCM'
export const BACKUP_KDF = 'PBKDF2-SHA-256'
export const BACKUP_ITERATIONS = 210_000
export const BACKUP_EXT = '.json.enc'
export const MIN_PASSWORD_LENGTH = 12

const te = new TextEncoder()
const td = new TextDecoder()

function toB64(bytes) {
  let s = ''
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  for (let i = 0; i < view.length; i += 1) s += String.fromCharCode(view[i])
  return btoa(s)
}

function fromB64(b64) {
  const bin = atob(String(b64 || ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(password, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    te.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * @param {object} plaintext — API export snapshot
 * @param {string} password — Jasper backup-wachtwoord (never stored)
 */
export async function encryptBackupEnvelope(plaintext, password) {
  const keyText = String(password || '')
  if (keyText.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Backup-wachtwoord moet minstens ${MIN_PASSWORD_LENGTH} tekens zijn.`,
    )
  }
  if (!plaintext || typeof plaintext !== 'object') {
    throw new Error('Geen export-data om te versleutelen.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(keyText, salt, BACKUP_ITERATIONS)
  const clear = te.encode(JSON.stringify(plaintext))
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    clear,
  )

  return {
    v: BACKUP_VERSION,
    alg: BACKUP_ALG,
    kdf: BACKUP_KDF,
    iter: BACKUP_ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(cipherBuf),
    exportedAt: plaintext.exportedAt || new Date().toISOString(),
  }
}

/**
 * @param {object|string} envelopeOrJson
 * @param {string} password
 */
export async function decryptBackupEnvelope(envelopeOrJson, password) {
  const keyText = String(password || '')
  if (!keyText) throw new Error('Vul het backup-wachtwoord in.')

  let envelope = envelopeOrJson
  if (typeof envelope === 'string') {
    try {
      envelope = JSON.parse(envelope)
    } catch {
      throw new Error('Bestand is geen geldige backup-envelope.')
    }
  }

  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Bestand is geen geldige backup-envelope.')
  }
  if (Number(envelope.v) !== BACKUP_VERSION) {
    throw new Error(`Onbekende backup-versie (${envelope.v}).`)
  }
  if (envelope.alg !== BACKUP_ALG || envelope.kdf !== BACKUP_KDF) {
    throw new Error('Onbekend versleutelingsalgoritme.')
  }
  if (Number(envelope.iter) !== BACKUP_ITERATIONS) {
    throw new Error(`Ongeldig iter-aantal (${envelope.iter}).`)
  }

  const salt = fromB64(envelope.salt)
  const iv = fromB64(envelope.iv)
  const ciphertext = fromB64(envelope.ciphertext)
  if (salt.length !== 16 || iv.length !== 12 || !ciphertext.length) {
    throw new Error('Backupbestand is incompleet of beschadigd.')
  }

  const key = await deriveKey(keyText, salt, BACKUP_ITERATIONS)
  let plainBuf
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    )
  } catch {
    throw new Error('Verkeerd wachtwoord of beschadigd bestand.')
  }

  let payload
  try {
    payload = JSON.parse(td.decode(plainBuf))
  } catch {
    throw new Error('Ontsleutelde data is geen geldige JSON-snapshot.')
  }

  if (!Array.isArray(payload?.biedingen) || !Array.isArray(payload?.kavels)) {
    throw new Error('Snapshot mist kavels- of biedingen-arrays.')
  }
  return payload
}

/** `veiling-backup-<YYYYMMDDTHHMMSSZ>.json.enc` */
export function stampFilename(prefix = 'veiling-backup') {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return `${prefix}-${stamp}${BACKUP_EXT}`
}

export function triggerDownload(filename, contents, mime = 'application/json') {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
