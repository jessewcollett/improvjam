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

3. In the spreadsheet: **Improv Jam → Populate catalog (overwrite tabs)**.

4. Deploy / re-deploy the Web App: Execute as **Me**, Who has access: **Anyone**.

Tabs written:

- `Sources` — citation URLs (`id`, `name`, `url`, `note`)
- `Games` — `id, name, category, tags, lifeSkills, description, sourceIds, source`
- `Terms` — `id, term, category, definition, sourceIds`
- `Generator` — one tab for every ask-for bank: `id, categories, text, extra`. `categories` can be comma- or pipe-separated so a row can live in more than one bank (example: `Locations, Scenes`). Banks include Activities, Adjectives, Animals, Characters, Companies, Emotions, Famous, Genres, Instructions, Jobs, Lines, Locations, Nouns, Objects, Objectives, PlayStyle, Relationships, Scenes, Shapes, Songs, Story Titles, Verbs, Words, and FUT.

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
