# ISW Hoogeland — Kavelveiling Control Center (admin)

Nederlandse **admin**-site voor de goede-doelen kavelveiling (test).
Alleen `hgj@isw.info` mag inloggen.

Leerling-site (stand + bieden):  
https://hgj-isw.github.io/kavel-veiling-test/

## Functies

Beheer in tabbladen: **Kavels** | **Biedingen** | **Instellingen**

- Kavels toevoegen / bewerken / verwijderen
- Stapgrootte en startbedrag per kavel
- Alle biedingen met e-mailadres
- Onzinbiedingen verwijderen
- Testdata resetten
- Geen Control Center op de leerling-site (aparte repo)

## Opslag

- **Live** (Pages-build met `VITE_API_URL`): biedingen-lijst + delete via Cloudflare (`GET`/`DELETE /api/admin/biedingen`). Login met school-e-mail + toegangscode; alleen admin.
- **Mock** (lokaal zonder `VITE_API_URL`): localStorage `isw-kavel-veiling-admin-v1` + test-PIN. Mock wordt niet gewist.
- Onzinbiedingen: alleen handmatig, na expliciete bevestiging (geen bulk/auto).

## Lokaal

```bash
npm install
npm run dev
# optioneel live API:
# VITE_API_URL=https://kavel-veiling-api.hgj-isw.workers.dev npm run dev
```

## GitHub Pages

```bash
VITE_API_URL=https://kavel-veiling-api.hgj-isw.workers.dev npm run build:pages
# dist/ bevat index.html + 404.html (SPA-fallback) + .nojekyll
# deploy dist/ → branch gh-pages, pad /
```

Live-doel: https://hgj-isw.github.io/kavel-veiling-admin/

`build:pages` kopieert `index.html` → `404.html`, zodat deep-links
(`/login`) de SPA laden. GitHub Pages geeft dan nog steeds status 404,
maar de app mount wel.

Als Pages niet automatisch aanstaat:  
**Settings → Pages → Deploy from a branch → `gh-pages` → `/` (root) → Save**
