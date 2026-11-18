/**
 * API-client voor Cloudflare Worker (live) of lokale mock (geen VITE_API_URL).
 * Admin list/delete gebruiken live als base-URL + Bearer-token aanwezig zijn.
 */

const API_BASE = String(import.meta.env.VITE_API_URL || '')
  .trim()
  .replace(/\/+$/, '')

export const usingMockApi = !API_BASE

export const API_URL = API_BASE || null

const TOKEN_KEY = 'isw-kavel-admin-api-token-v1'
const LIVE_SESSION_KEY = 'isw-kavel-admin-live-session-v1'

export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredToken(token) {
  try {
    if (!token) sessionStorage.removeItem(TOKEN_KEY)
    else sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function getLiveSession() {
  try {
    const raw = sessionStorage.getItem(LIVE_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setLiveSession(session) {
  try {
    if (!session) {
      sessionStorage.removeItem(LIVE_SESSION_KEY)
      setStoredToken(null)
      return
    }
    sessionStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(session))
    setStoredToken(session.token || null)
  } catch {
    /* ignore */
  }
}

/** Live pad: VITE_API_URL gezet én Bearer-token aanwezig. */
export function usingLiveBids() {
  return Boolean(API_BASE && getStoredToken())
}

async function api(method, path, { body, auth = false } = {}) {
  if (!API_BASE) {
    const err = new Error('Geen live API geconfigureerd (VITE_API_URL ontbreekt).')
    err.status = 0
    throw err
  }

  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getStoredToken()
    if (!token) {
      const err = new Error('Niet ingelogd.')
      err.status = 401
      throw err
    }
    headers.Authorization = `Bearer ${token}`
  }

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkErr) {
    const err = new Error(
      'Geen verbinding met de veiling-API. Probeer de pagina te vernieuwen.',
    )
    err.status = 0
    err.cause = networkErr
    throw err
  }

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text }
    }
  }

  if (!res.ok) {
    const err = new Error(
      data?.error || 'Er ging iets mis. Probeer het opnieuw.',
    )
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

export async function loginLive({ email, code }) {
  const data = await api('POST', '/api/auth/login', {
    body: { email, code },
  })
  if (!data?.admin) {
    setLiveSession(null)
    const err = new Error(
      'Dit Control Center is alleen voor admin-accounts (hgj@isw.info).',
    )
    err.status = 403
    throw err
  }
  const session = {
    token: data.token,
    email: data.email,
    admin: true,
    expiresAt: data.expiresAt,
  }
  setLiveSession(session)
  return session
}

export async function logoutLive() {
  try {
    await api('POST', '/api/auth/logout', { auth: true })
  } catch {
    /* sessie al weg */
  }
  setLiveSession(null)
}

export async function fetchAdminBiedingen() {
  const data = await api('GET', '/api/admin/biedingen', { auth: true })
  const biedingen = Array.isArray(data?.biedingen) ? data.biedingen : []
  notifyLiveBiedingenCount(biedingen.length)
  return biedingen
}

/**
 * Hard-delete één bod. Geen body. Caller moet eerst window.confirm tonen.
 */
export async function deleteAdminBid(id) {
  const bidId = encodeURIComponent(String(id || '').trim())
  if (!bidId) {
    const err = new Error('Bod-id ontbreekt.')
    err.status = 400
    throw err
  }
  return api('DELETE', `/api/admin/biedingen/${bidId}`, { auth: true })
}

export function notifyLiveBiedingenCount(count) {
  window.dispatchEvent(
    new CustomEvent('kavel-live-biedingen-changed', {
      detail: { count: Number(count) || 0 },
    }),
  )
}
