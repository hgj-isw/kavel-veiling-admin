import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { listBiedingen } from '../data/store.js'

const ADMIN_TABS = [
  { id: 'kavels', label: 'Kavels' },
  { id: 'biedingen', label: 'Biedingen' },
  { id: 'instellingen', label: 'Instellingen' },
]

export default function Layout() {
  const { user, isLoggedIn, isAdmin, logout } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [biedingenCount, setBiedingenCount] = useState(() => listBiedingen().length)
  const onAdminHome =
    isLoggedIn && isAdmin && (location.pathname === '/' || location.pathname === '')
  const activeTab = ADMIN_TABS.some((t) => t.id === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'kavels'

  useEffect(() => {
    function refresh() {
      setBiedingenCount(listBiedingen().length)
    }
    refresh()
    window.addEventListener('kavel-db-changed', refresh)
    return () => window.removeEventListener('kavel-db-changed', refresh)
  }, [])

  function selectTab(id) {
    if (id === 'kavels') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab: id }, { replace: true })
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">ISW</span>
            <span className="brand__text">
              <strong>Hoogeland</strong>
              <em>Control Center</em>
            </span>
          </Link>

          {onAdminHome ? (
            <nav className="tabs tabs--header" role="tablist" aria-label="Beheersecties">
              {ADMIN_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={activeTab === t.id}
                  aria-controls={`panel-${t.id}`}
                  className={`tabs__btn${activeTab === t.id ? ' is-active' : ''}`}
                  onClick={() => selectTab(t.id)}
                >
                  {t.label}
                  {t.id === 'biedingen' && biedingenCount > 0 && (
                    <span className="tabs__count">{biedingenCount}</span>
                  )}
                </button>
              ))}
            </nav>
          ) : (
            <nav className="nav" aria-label="Hoofdmenu">
              <NavLink to="/" end>
                Overzicht
              </NavLink>
            </nav>
          )}

          <div className="header-user">
            {user ? (
              <>
                <span className="header-user__email" title={user.email}>
                  {user.email} · admin
                </span>
                <button type="button" className="btn btn--ghost" onClick={logout}>
                  Uitloggen
                </button>
              </>
            ) : (
              <Link className="btn btn--ghost" to="/login">
                Inloggen (test)
              </Link>
            )}
          </div>
        </div>
        <div className="test-banner" role="status">
          ADMIN TEST — aparte localStorage · geen SharePoint · leerling-site is los
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>
          ISW Hoogeland · Control Center ·{' '}
          <a href="https://hgj-isw.github.io/kavel-veiling-test/">
            naar leerling-site
          </a>
        </p>
      </footer>
    </div>
  )
}
