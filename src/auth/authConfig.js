/** TEST-allowlist — geen echte geheimen. Later: school Microsoft-login. */

/** Alleen Jasper mag het Control Center gebruiken. */
export const ADMIN_EMAIL = 'hgj@isw.info'
export const ALLOWLIST = [ADMIN_EMAIL]

/** Simpele test-PIN (zichtbaar als TEST) — geen productie-geheim. */
export const TEST_PIN = '1234'

export function isAllowedEmail(email) {
  return ALLOWLIST.includes(String(email || '').trim().toLowerCase())
}

export function isAdmin(email) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL
}

export const TEST_ACCOUNTS = [
  {
    email: ADMIN_EMAIL,
    label: 'Jasper (admin)',
    rol: 'Control Center',
  },
]
