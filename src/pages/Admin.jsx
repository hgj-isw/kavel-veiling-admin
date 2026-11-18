import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  API_URL,
  deleteAdminBid,
  fetchAdminBiedingen,
  fetchAdminExportJson,
  usingLiveBids,
  usingMockApi,
} from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import {
  decryptBackupEnvelope,
  encryptBackupEnvelope,
  stampFilename,
  triggerDownload,
} from '../crypto/backupEnvelope.js'
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

function buildMockExportSnapshot() {
  const kavels = listKavels()
  const biedingen = listBiedingen()
  return {
    exportedAt: new Date().toISOString(),
    service: 'kavel-veiling-admin-mock',
    counts: { kavels: kavels.length, biedingen: biedingen.length },
    kavels: kavels.map((k, i) => ({
      id: k.id,
      titel: k.titel,
      omschrijving: k.omschrijving,
      startBedrag: k.startBedrag,
      stapGrootte: k.stapGrootte,
      actief: k.actief ? 1 : 0,
      sortOrder: i,
    })),
    biedingen: biedingen.map((b) => ({
      id: b.id,
      kavelId: b.kavelId,
      kavelTitel: b.kavelTitel || '',
      bedrag: b.bedrag,
      email: b.email,
      tijdstip: b.tijdstip,
    })),
  }
}

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
  const { isLoggedIn, isAdmin, user, isLive } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TAB_IDS.has(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'kavels'
  const [form, setForm] = useState(emptyForm)
  const [fout, setFout] = useState('')
  const [ok, setOk] = useState('')
  const [version, setVersion] = useState(0)
  const [liveBiedingen, setLiveBiedingen] = useState([])
  const [bidsLoading, setBidsLoading] = useState(false)
  const [bidsFout, setBidsFout] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [exportKey, setExportKey] = useState('')
  const [exportKey2, setExportKey2] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [importKey, setImportKey] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const importFileRef = useRef(null)

  const liveBids = isLive && usingLiveBids()

  const kavels = useMemo(() => listKavels(), [version, ok])
  const mockBiedingen = useMemo(() => listBiedingen(), [version, ok])
  const biedingen = liveBids ? liveBiedingen : mockBiedingen

  async function refreshLiveBids() {
    setBidsLoading(true)
    setBidsFout('')
    try {
      const list = await fetchAdminBiedingen()
      setLiveBiedingen(list)
    } catch (err) {
      setBidsFout(err.message || 'Biedingen laden mislukt.')
      setLiveBiedingen([])
    } finally {
      setBidsLoading(false)
    }
  }

  useEffect(() => {
    setOk('')
    setFout('')
  }, [tab])

  useEffect(() => {
    if (!liveBids) {
      setLiveBiedingen([])
      setBidsFout('')
      return
    }
    refreshLiveBids()
  }, [liveBids, version])

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

  async function onDeleteBid(id, email, bedrag) {
    if (
      !window.confirm(
        `Bod van ${euro(bedrag)} door ${email} verwijderen? Dit kan niet ongedaan worden.`,
      )
    ) {
      return
    }

    if (liveBids) {
      setDeletingId(id)
      setFout('')
      try {
        await deleteAdminBid(id)
        setOk('Bod verwijderd uit de live veiling.')
        setVersion((v) => v + 1)
      } catch (err) {
        setFout(err.message || 'Verwijderen mislukt.')
        setOk('')
      } finally {
        setDeletingId(null)
      }
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

  async function onEncryptedExport(e) {
    e.preventDefault()
    setFout('')
    setOk('')
    if (exportKey !== exportKey2) {
      setFout('Sleutels komen niet overeen.')
      return
    }
    setExportBusy(true)
    try {
      const snapshot = liveBids
        ? await fetchAdminExportJson()
        : buildMockExportSnapshot()
      const envelope = await encryptBackupEnvelope(snapshot, exportKey)
      triggerDownload(stampFilename('veiling-backup'), JSON.stringify(envelope))
      setExportKey('')
      setExportKey2('')
      setOk(
        `Versleutelde backup (.json.enc) gedownload (${snapshot.counts?.biedingen ?? '?'} biedingen). Bewaar het wachtwoord offline.`,
      )
    } catch (err) {
      setFout(err.message || 'Versleutelde export mislukt.')
    } finally {
      setExportBusy(false)
    }
  }

  async function onEncryptedImport(e) {
    e.preventDefault()
    setFout('')
    setOk('')
    setImportPreview(null)
    const file = importFileRef.current?.files?.[0]
    if (!file) {
      setFout('Kies eerst een .json.enc-bestand.')
      return
    }
    setImportBusy(true)
    try {
      const text = await file.text()
      const snapshot = await decryptBackupEnvelope(text, importKey)
      setImportPreview(snapshot)
      setImportKey('')
      if (importFileRef.current) importFileRef.current.value = ''
      setOk(
        `Backup ontsleuteld (${snapshot.counts?.biedingen ?? snapshot.biedingen?.length ?? 0} biedingen). Preview only — geen automatische restore naar D1.`,
      )
    } catch (err) {
      setFout(err.message || 'Import/ontsleutelen mislukt.')
    } finally {
      setImportBusy(false)
    }
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
          {liveBids
            ? ' · live API'
            : usingMockApi
              ? ' · lokale mock'
              : ''}
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
            {!usingMockApi && (
              <p className="lede muted">
                Kavels hier zijn nog lokale mock-data. Live biedingen staan
                onder het tabblad Biedingen.
              </p>
            )}
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
              Verwijder onzinbiedingen hier — één voor één, na bevestiging. Op
              de leerling-stand blijven e-mailadressen verborgen.
              {liveBids ? (
                <>
                  {' '}
                  Bron: live API
                  {API_URL ? (
                    <>
                      {' '}
                      (<code>{API_URL}</code>)
                    </>
                  ) : null}
                  .
                </>
              ) : (
                <> Bron: lokale mock (localStorage).</>
              )}
            </p>
            {fout && (
              <p className="msg msg--error" role="alert">
                {fout}
              </p>
            )}
            {bidsFout && (
              <p className="msg msg--error" role="alert">
                {bidsFout}
              </p>
            )}
            {ok && (
              <p className="msg msg--ok" role="status">
                {ok}
              </p>
            )}
            {liveBids && (
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => refreshLiveBids()}
                  disabled={bidsLoading}
                >
                  {bidsLoading ? 'Laden…' : 'Lijst vernieuwen'}
                </button>
              </div>
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
                      <td>
                        {b.kavelTitel ||
                          kavelMap[b.kavelId]?.titel ||
                          b.kavelId}
                      </td>
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
                          disabled={deletingId === b.id}
                          onClick={() => onDeleteBid(b.id, b.email, b.bedrag)}
                        >
                          {deletingId === b.id
                            ? 'Bezig…'
                            : 'Onzinbieding verwijderen'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bidsLoading && biedingen.length === 0 && (
                <p className="empty">Biedingen laden…</p>
              )}
              {!bidsLoading && biedingen.length === 0 && !bidsFout && (
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
            <h2>Versleutelde backup</h2>
            <p className="lede">
              Download een AES-256-GCM-bestand (<code>.json.enc</code>) met
              kavels + biedingen. Geen raw CSV/JSON op schijf. Gebruik een
              apart backup-wachtwoord (≥12 tekens), niet de toegangscode.
              {liveBids ? (
                <>
                  {' '}
                  Live snapshot via{' '}
                  <code>GET /api/admin/export?format=json</code>
                  {API_URL ? (
                    <>
                      {' '}
                      (<code>{API_URL}</code>)
                    </>
                  ) : null}
                  .
                </>
              ) : (
                <> Bron nu: lokale mock (geen live Bearer-sessie).</>
              )}
            </p>
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
            <form className="form" onSubmit={onEncryptedExport}>
              <label>
                Backup-wachtwoord
                <input
                  type="password"
                  autoComplete="new-password"
                  value={exportKey}
                  onChange={(e) => setExportKey(e.target.value)}
                  minLength={12}
                  required
                />
              </label>
              <label>
                Bevestig wachtwoord
                <input
                  type="password"
                  autoComplete="new-password"
                  value={exportKey2}
                  onChange={(e) => setExportKey2(e.target.value)}
                  minLength={12}
                  required
                />
              </label>
              <div className="btn-row">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={exportBusy}
                >
                  {exportBusy
                    ? 'Versleutelen…'
                    : 'Versleutelde backup downloaden'}
                </button>
              </div>
            </form>
          </div>

          <div className="panel">
            <h2>Backup importeren</h2>
            <p className="lede">
              Ontsleutel een <code>.json.enc</code> met hetzelfde
              backup-wachtwoord. MVP: preview only — geen automatische
              D1-restore en geen wissen van testdata.
            </p>
            <form className="form" onSubmit={onEncryptedImport}>
              <label>
                Bestand
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json.enc,application/json,.enc"
                  required
                />
              </label>
              <label>
                Backup-wachtwoord
                <input
                  type="password"
                  autoComplete="off"
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  required
                />
              </label>
              <div className="btn-row">
                <button
                  type="submit"
                  className="btn btn--secondary"
                  disabled={importBusy}
                >
                  {importBusy ? 'Ontsleutelen…' : 'Backup importeren'}
                </button>
                {importPreview && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setImportPreview(null)}
                  >
                    Preview wissen
                  </button>
                )}
              </div>
            </form>
            {importPreview && (
              <div className="backup-preview">
                <p className="muted">
                  Snapshot {importPreview.exportedAt || '—'} ·{' '}
                  {importPreview.counts?.kavels ??
                    importPreview.kavels?.length ??
                    0}{' '}
                  kavels ·{' '}
                  {importPreview.counts?.biedingen ??
                    importPreview.biedingen?.length ??
                    0}{' '}
                  biedingen
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Kavel</th>
                        <th>Bod</th>
                        <th>E-mail</th>
                        <th>Tijd</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(importPreview.biedingen || []).slice(0, 25).map((b) => (
                        <tr key={b.id}>
                          <td>{b.kavelTitel || b.kavelId}</td>
                          <td>{euro(b.bedrag)}</td>
                          <td>{b.email}</td>
                          <td>
                            {b.tijdstip
                              ? new Date(b.tijdstip).toLocaleString('nl-NL', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(importPreview.biedingen || []).length > 25 && (
                    <p className="empty">
                      Eerste 25 van {(importPreview.biedingen || []).length}{' '}
                      biedingen getoond.
                    </p>
                  )}
                  {(importPreview.biedingen || []).length === 0 && (
                    <p className="empty">Geen biedingen in deze snapshot.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Testdata</h2>
            <p className="lede">
              Zet alle kavels en biedingen terug naar de start-nepdata. Handig
              na een oefenronde. Dit raakt alleen de admin-localStorage (
              <code>isw-kavel-veiling-admin-v1</code>), niet de live D1 of de
              leerling-site.
            </p>
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
                API:{' '}
                {API_URL ? (
                  <code>{API_URL}</code>
                ) : (
                  <>geen <code>VITE_API_URL</code> (lokale mock)</>
                )}
              </li>
              <li>
                Admin-login: alleen <code>hgj@isw.info</code>
              </li>
              <li>
                Backup: AES-256-GCM envelope v1 (
                <code>.json.enc</code>), geen raw CSV
              </li>
              <li>
                Onzinbiedingen: handmatig, één voor één, na expliciete
                bevestiging
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
