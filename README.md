# Improv Jam

Mobile-first PWA for rehearsal: game library, glossary, scene generators, and jam tools (bell, timer, who’s up, suggestion hat).

Catalog data lives in a Google Sheet. The app caches it in `localStorage` so it still works in a basement theater.

## Dev

```bash
npm install
npm run dev
```

## Google Sheet + Apps Script

The PWA fetches:

`https://script.google.com/macros/s/AKfycbwKLhHPMnf8it7vl5vgF7i98fueqh00fJCeNg-dbOoQ_Jbck1nO5oxw9AetxvAZWlyzRg/exec`

Until that URL is deployed as **Anyone** (anonymous), the app uses the bundled catalog from the two PDFs (436 games, 134 terms) and still works fully offline.

### One-time fill of every tab

1. Log clasp in as the Google account that **owns the sheet** (the account currently logged in here does not have access to script `15wQ59eXL8GaprQ4xL6rtAS4SIlLHklx0Cau-j9jrPfqXuLfw0oeblT4G`):

```bash
npm run clasp:login
```

2. Push the catalog + `populateCatalog()`:

```bash
npm run extract
cd apps-script && npx --yes @google/clasp@3.1.3 push --force
```

3. In the spreadsheet: **Improv Jam → Populate catalog (overwrite tabs)** for a first fill, or **Improv Jam → Update tabs** to add missing columns only.

4. Deploy / re-deploy the Web App: Execute as **Me**, Who has access: **Anyone**.

### Update tabs vs overwrite

- **Improv Jam → Update tabs** — creates missing live tabs and appends any columns missing from the current schema (`tags` on Audio, `image` on Games/Terms, `group` on Generator, plus the Icons and Banks tabs) without changing existing rows or header order. Sync Data does the same automatically when the app reads the catalog (`doGet`).
- **Improv Jam → Populate catalog (overwrite tabs)** — replaces Sources, Games, Terms, and Generator from the bundled catalog. Use for a first fill or a full reset. Does not wipe Audio, Icons, or Banks.

Tabs:

- `Sources` — citation URLs (`id`, `name`, `url`, `note`)
- `Games` — `id, name, category, tags, lifeSkills, description, sourceIds, source, image`
- `Terms` — `id, term, category, definition, sourceIds, image`
- `Generator` — prompt rows: `id, categories, text, extra, group`. `categories` can be comma- or pipe-separated so a row can live in more than one bank (example: `Locations, Scenes`). Leave `group` blank to use the Banks tab. Fill **Ask-for**, **Skill Building**, or **Both** on a row to override that category.
- `Banks` — one row per category (`id`, `label`, `group`, `icon`). `id` must match a Generator `categories` value (Activities, Lines, FUT, CORE, …). `group` is **Ask-for**, **Skill Building**, or **Both**. `icon` is a keyword from the Icons tab or any emoji. This is the main place to move a category between sections and pick its chip icon.
- `Icons` — reference list of every Lucide keyword the app understands (`id`, `name`, `kind`, `sample`). Copy an `id` into Banks.icon or Audio.icon. `kind` is `lucide` or `emoji`. Any emoji also works in an icon cell — you do not have to add it here first. Update tabs seeds this list once if the tab is empty and never overwrites your rows.
- `Audio` — SFX and tracks (`id, name, kind, url, icon, credit, creditUrl, notes, enabled, tags`). One `tags` column only (no genre): put Pop, 80s, Underscore, and any other labels in `tags`, comma- or pipe-separated. `icon` accepts the same Icons-tab keywords or an emoji.

Encyclopedia entries are used with attribution to [improvencyclopedia.org](https://improvencyclopedia.org/Download.html). Jam teaching notes come from `Improv- Terms.pdf`.

## Deploy

GitHub repo: [github.com/jessewcollett/improvjam](https://github.com/jessewcollett/improvjam)

```bash
# first time
gh repo create jessewcollett/improvjam --public --source=. --remote=origin
git push -u origin main
```

Vercel (Vite PWA, output `dist`):

```bash
npx vercel login
npx vercel --yes
npx vercel env add VITE_SHEETS_URL production
# paste: https://script.google.com/macros/s/AKfycbwKLhHPMnf8it7vl5vgF7i98fueqh00fJCeNg-dbOoQ_Jbck1nO5oxw9AetxvAZWlyzRg/exec
npx vercel --prod --yes
```

Or import `jessewcollett/improvjam` in the Vercel dashboard, set Framework to Vite, build `npm run build`, output `dist`, and add the same `VITE_SHEETS_URL` env var. Later pushes to `main` auto-deploy.
