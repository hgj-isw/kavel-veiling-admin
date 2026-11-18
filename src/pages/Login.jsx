import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { usingMockApi } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { TEST_ACCOUNTS, TEST_PIN } from '../auth/authConfig.js'

export default function Login() {
  const { isLoggedIn, loginAs, loginWithPin, loginWithCode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [email, setEmail] = useState('hgj@isw.info')
  const [secret, setSecret] = useState('')
  const [fout, setFout] = useState('')
  const [bezig, setBezig] = useState(false)

  if (isLoggedIn) return <Navigate to={from} replace />

  function go() {
    navigate(from, { replace: true })
  }

  function onQuickLogin(accountEmail) {
    setFout('')
    try {
      loginAs(accountEmail)
      go()
    } catch (err) {
      setFout(err.message)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setFout('')
    setBezig(true)
    try {
      if (usingMockApi) {
        loginWithPin(email, secret)
      } else {
        await loginWithCode(email, secret)
      }
      go()
    } catch (err) {
      setFout(err.message || 'Inloggen mislukt.')
    } finally {
      setBezig(false)
    }
  }

  return (
    <section className="panel login-panel">
      {usingMockApi ? (
        <p className="eyebrow">TEST-login · lokale mock</p>
      ) : (
        <p className="eyebrow">Live API · Control Center</p>
      )}
      <h1>Inloggen op het Control Center</h1>
      <p className="lede">
        Alleen <code>hgj@isw.info</code>
        {usingMockApi ? (
          <>
            . Geen echte schoolwachtwoorden. Gebruik PIN{' '}
            <code>{TEST_PIN}</code>.
          </>
        ) : (
          <>
            . School-e-mail en toegangscode (zelfde als de leerling-site).
          </>
        )}
      </p>

      {usingMockApi && (
        <div className="quick-login">
          {TEST_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              className="btn btn--primary quick-login__btn"
              onClick={() => onQuickLogin(acc.email)}
            >
              Inloggen als {acc.label}
              <span>
                {acc.email} · {acc.rol}
              </span>
            </button>
          ))}
        </div>
      )}

      <form className="form" onSubmit={onSubmit}>
        <h2>
          {usingMockApi
            ? 'Of met e-mail + test-PIN'
            : 'School-e-mail + toegangscode'}
        </h2>
        <label>
          School-e-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          {usingMockApi ? 'Test-PIN' : 'Toegangscode'}
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={usingMockApi ? TEST_PIN : ''}
            autoComplete="current-password"
            required
          />
        </label>
        {fout && (
          <p className="msg msg--error" role="alert">
            {fout}
          </p>
        )}
        <button
          type="submit"
          className="btn btn--secondary"
          disabled={bezig}
        >
          {bezig
            ? 'Bezig…'
            : usingMockApi
              ? 'Inloggen met PIN'
              : 'Inloggen'}
        </button>
      </form>
    </section>
  )
}
