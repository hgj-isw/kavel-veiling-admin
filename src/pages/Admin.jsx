import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import {
  deleteBid,
  deleteKavel,
  euro,
  hoogsteBodVoorKavel,
  listBiedingen,
  listKavels,
  resetToSeed,
  upsertKavel,
} from '../data/store.js'

const emptyForm = {
  id: '',
  titel: '',
  omschrijving: '',
  startBedrag: 5,
  stapGrootte: 1,
  actief: true,
}

const TAB_IDS = new Set(['kavels', 'biedingen', 'instellingen'])

export default function Admin() {
  const { isLoggedIn, isAdmin, user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TAB_IDS.has(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'kavels'
  const [form, setForm] = useState(emptyForm)
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState('')
  const [version, setVersion] = useState(0)

  const kavels = useMemo(() => listKavels(), [version, ok])
  const biedingen = useMemo(() => listBiedingen(), [version, ok])

  useEffect(() => {
    setOk('')
    setFout('')
  }, [tab])

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!isAdmin) {
    return (
      <section className="panel">
        <h1>Geen toegang</h1>
        <p className="lede">
          Het Control Center is alleen voor <code>hgj@isw.info</code>. Je bent
          ingelogd als {user.email}.
        </p>
      </section>
    )
  }

  function bump(msg) {
    setOk(msg)
    setFout('')
    setVersion((v) => v + 1)
  }

  function goToTab(next) {
    if (next === 'kavels') {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab: next }, { replace: true })
    }
  }

  function onEdit(kavel) {
    setForm({
      id: kavel.id,
      titel: kavel.titel,
      omschrijving: kavel.omschrijving,
      startBedrag: kavel.startBedrag,
      stapGrootte: kavel.stapGrootte,
      actief: kavel.actief,
    })
    setOk('')
    setFout('')
    goToTab('kavels')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onSubmit(e) {
    e.preventDefault()
    try {
      const saved = upsertKavel(form)
      setForm(emptyForm)
      bump(`Kavel “${saved.titel}” opgeslagen.`)
    } catch (err) {
      setFout(err.message)
      setOk('')
    }
  }

  function onDeleteKavel(id, titel) {
    if (!window.confirm(`Kavel “${titel}” en alle biedingen daarop verwijderen?`)) {
      return
    }
    deleteKavel(id)
    if (form.id === id) setForm(emptyForm)
    bump(`Kavel “${titel}” verwijderd.`)
  }

  function onDeleteBid(id, email, bedrag) {
    if (
      !window.confirm(
        `Bod van ${euro(bedrag)} door ${email} verwijderen?`,
      )
    ) {
      return
    }
    deleteBid(id)
    bump('Bod verwijderd.')
  }

  function onReset() {
    if (!window.confirm('Alle testdata terugzetten naar de start-nepdata?')) return
    resetToSeed()
    setForm(emptyForm)
    bump('Testdata gereset.')
  }

  const kavelMap = Object.fromEntries(kavels.map((k) => [k.id, k]))

  return (
    <section className="admin">
      <div className="panel admin__intro">
        <p className="eyebrow">Control Center</p>
        <h1>Beheer</h1>
        <p className="lede">
          Alleen zichtbaar voor admin ({user.email}). Hier zie je e-mailadressen
          bij biedingen — op de publieke stand niet.
        </p>
        <p className="admin__stats muted">
          {kavels.length} kavel{kavels.length === 1 ? '' : 's'} ·{' '}
          {biedingen.length} bieding{biedingen.length === 1 ? '' : 'en'}
        </p>
      </div>

      {tab === 'kavels' && (
        <div
          className="tabs__panel"
          role="tabpanel"
          id="panel-kavels"
          aria-labelledby="tab-kavels"
        >
          <div className="panel">
            <h2>{form.id ? 'Kavel bewerken' : 'Nieuwe kavel'}</h2>
            <form className="form" onSubmit={onSubmit}>
              <label>
                Naam
                <input
                  value={form.titel}
                  onChange={(e) => setForm({ ...form, titel: e.target.value })}
                  required
                />
              </label>
              <label>
                Omschrijving
                <textarea
                  rows={3}
                  value={form.omschrijving}
                  onChange={(e) =>
                    setForm({ ...form, omschrijving: e.target.value })
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  Startbedrag (€)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.startBedrag}
                    onChange={(e) =>
                      setForm({ ...form, startBedrag: e.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Stapgrootte / min. overbieding (€)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.stapGrootte}
                    onChange={(e) =>
                      setForm({ ...form, stapGrootte: e.target.value })
                    }
                    required
                  />
                </label>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.actief}
                  onChange={(e) =>
                    setForm({ ...form, actief: e.target.checked })
                  }
                />
                Actief (zichtbaar op stand & bieden)
              </label>
              {fout && (
                <p className="msg msg--error" role="alert">
                  {fout}
                </p>
              )}
              {ok && (
                <p className="msg msg--ok" role="status">
                  {ok}
                </p>
              )}
              <div className="btn-row">
                <button type="submit" className="btn btn--primary">
                  {form.id ? 'Wijzigingen opslaan' : 'Kavel toevoegen'}
                </button>
                {form.id && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setForm(emptyForm)}
                  >
                    Annuleren
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="panel">
            <h2>Alle kavels</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>Stap</th>
                    <th>Hoogste</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {kavels.map((k) => (
                    <tr key={k.id}>
                      <td>
                        <strong>{k.titel}</strong>
                        <div className="muted">{k.omschrijving}</div>
                      </td>
                      <td>{euro(k.stapGrootte)}</td>
                      <td>{euro(hoogsteBodVoorKavel(k.id))}</td>
                      <td>{k.actief ? 'Actief' : 'Uit'}</td>
                      <td className="table-actions">
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => onEdit(k)}
                        >
                          Bewerken
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger"
                          onClick={() => onDeleteKavel(k.id, k.titel)}
                        >
                          Verwijderen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {kavels.length === 0 && (
                <p className="empty">Nog geen kavels. Voeg er hierboven een toe.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'biedingen' && (
        <div
          className="tabs__panel"
          role="tabpanel"
          id="panel-biedingen"
          aria-labelledby="tab-biedingen"
        >
          <div className="panel">
            <h2>Alle biedingen (met e-mail)</h2>
            <p className="lede">
              Verwijder onzinbiedingen hier. Op de leerling-stand blijven
              e-mailadressen verborgen.
            </p>
            {ok && (
              <p className="msg msg--ok" role="status">
                {ok}
              </p>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kavel</th>
                    <th>Bod</th>
                    <th>E-mail</th>
                    <th>Tijd</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {biedingen.map((b) => (
                    <tr key={b.id}>
                      <td>{kavelMap[b.kavelId]?.titel || b.kavelId}</td>
                      <td>{euro(b.bedrag)}</td>
                      <td>{b.email}</td>
                      <td>
                        {new Date(b.tijdstip).toLocaleString('nl-NL', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--danger"
                          onClick={() => onDeleteBid(b.id, b.email, b.bedrag)}
                        >
                          Onzinbieding verwijderen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {biedingen.length === 0 && (
                <p className="empty">Nog geen biedingen.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'instellingen' && (
        <div
          className="tabs__panel"
          role="tabpanel"
          id="panel-instellingen"
          aria-labelledby="tab-instellingen"
        >
          <div className="panel">
            <h2>Testdata</h2>
            <p className="lede">
              Zet alle kavels en biedingen terug naar de start-nepdata. Handig
              na een oefenronde. Dit raakt alleen de admin-localStorage (
              <code>isw-kavel-veiling-admin-v1</code>), niet de leerling-site.
            </p>
            {ok && (
              <p className="msg msg--ok" role="status">
                {ok}
              </p>
            )}
            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={onReset}>
                Testdata resetten
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>Over deze site</h2>
            <ul className="settings-list">
              <li>
                Live Control Center:{' '}
                <a href="https://hgj-isw.github.io/kavel-veiling-admin/">
                  hgj-isw.github.io/kavel-veiling-admin
                </a>
              </li>
              <li>
                Leerling-site (stand + bieden):{' '}
                <a href="https://hgj-isw.github.io/kavel-veiling-test/">
                  hgj-isw.github.io/kavel-veiling-test
                </a>
              </li>
              <li>
                Admin-login: alleen <code>hgj@isw.info</code>
              </li>
              <li>Geen SharePoint-koppeling in deze testfase</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
