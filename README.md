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

## Opslag (testfase)

- localStorage-key admin: `isw-kavel-veiling-admin-v1`
- Leerling-site: `isw-kavel-veiling-v1` (bewust **niet** gedeeld)
- Twee losse stores tot echte data via SharePoint komt

## Lokaal

```bash
npm install
npm run dev
```

## GitHub Pages

```bash
npm run build:pages
# deploy dist/ → branch gh-pages, pad /
```

Live-doel: https://hgj-isw.github.io/kavel-veiling-admin/

Als Pages niet automatisch aanstaat:  
**Settings → Pages → Deploy from a branch → `gh-pages` → `/` (root) → Save**
