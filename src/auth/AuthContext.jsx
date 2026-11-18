import { createContext, useContext, useMemo, useState } from 'react'
import {
  getLiveSession,
  loginLive,
  logoutLive,
  setLiveSession,
  usingMockApi,
} from '../api/client.js'
import { getSession, setSession } from '../data/store.js'
import { isAdmin, isAllowedEmail, TEST_PIN } from './authConfig.js'

const AuthContext = createContext(null)

function readInitialUser() {
  if (!usingMockApi) {
    const live = getLiveSession()
    if (live?.email && live?.token && live?.admin) {
      return {
        email: live.email,
        admin: true,
        token: live.token,
        live: true,
      }
    }
    return null
  }
  return getSession()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readInitialUser())

  const value = useMemo(() => {
    function loginAs(email) {
      if (!usingMockApi) {
        throw new Error(
          'Live-modus: log in met school-e-mail en toegangscode.',
        )
      }
      const normalized = String(email || '').trim().toLowerCase()
      if (!isAllowedEmail(normalized) || !isAdmin(normalized)) {
        throw new Error(
          'Dit Control Center is alleen voor hgj@isw.info. Andere accounts hebben geen toegang.',
        )
      }
      const next = { email: normalized, admin: true, live: false }
      setSession(next)
      setUser(next)
      return next
    }

    function loginWithPin(email, pin) {
      if (!usingMockApi) {
        throw new Error(
          'Live-modus: log in met school-e-mail en toegangscode.',
        )
      }
      if (String(pin) !== TEST_PIN) {
        throw new Error(
          'Verkeerde test-PIN. Gebruik 1234 (alleen voor lokale mock).',
        )
      }
      return loginAs(email)
    }

    async function loginWithCode(email, code) {
      if (usingMockApi) {
        throw new Error('Lokale mock: gebruik de test-PIN.')
      }
      const data = await loginLive({ email, code })
      const next = {
        email: data.email,
        admin: true,
        token: data.token,
        live: true,
      }
      setUser(next)
      return next
    }

    async function logout() {
      if (!usingMockApi) {
        await logoutLive()
      }
      setLiveSession(null)
      setSession(null)
      setUser(null)
    }

    return {
      user,
      isLoggedIn: Boolean(user),
      isAdmin: Boolean(user?.admin),
      isLive: Boolean(user?.live) || (!usingMockApi && Boolean(user?.token)),
      usingMockApi,
      loginAs,
      loginWithPin,
      loginWithCode,
      logout,
    }
  }, [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth buiten AuthProvider')
  return ctx
}
