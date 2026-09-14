# Improv Jam

Mobile-first PWA (React + Vite + Zustand) for rehearsal: Generator, Library, Tools, Sets, Settings, Stage, and audience Ideas. Production: https://improv-jam.vercel.app. GitHub: https://github.com/jessewcollett/improvjam

## Cursor Cloud specific instructions

Cloud Agents clone **this GitHub repo**, not “whatever GitHub is attached to the Cursor Gmail.”

- Repo Cloud Agents must reach: `jessewcollett/improvjam` (read-write).
- Cursor login email is independent of GitHub. If Integrations is connected to a **different** GitHub user than `jessewcollett`, this repo will not appear and agents cannot push.
- Fix (pick one):
  1. [Integrations](https://cursor.com/dashboard?tab=integrations) → GitHub → **Manage Connections** / Connect, and authorize the GitHub user that owns or can write `jessewcollett/improvjam`.
  2. Keep the other GitHub connected, and on GitHub invite **that** user as a collaborator with **Write** on `jessewcollett/improvjam`, then install/authorize the Cursor GitHub app on this repo.
- Do not add a second git remote (`origin.cursor.com`). Origin stays GitHub.
- If `.env` is missing, copy `.env.example` to `.env`. Do not print `.env` or tokens. `VITE_SHEETS_URL` may also come from Cloud Agent secrets.
- Dev server: `npm run dev -- --host 127.0.0.1 --port 5176`. Stage board is `/stage?s=CODE`. Ideas form is `/ideas?s=CODE`.
- Verify UI in the cloud browser after changing Stage, Ideas, nav, or layout. One Vite process is enough.

## Working rules

- Work **one slice at a time**. Do not launch parallel agents.
- Do **not** commit unless the user asks. Do not push unless they ask.
- Never run **Improv Jam → Populate catalog**. Do not change spreadsheet sharing.
- Apps Script: only if the task needs it, from `apps-script/`: `npx --yes @google/clasp@3.1.3 push --force`. Skip clasp on Cloud Agents unless Google login exists.
- After a clasp push, redeploy web app `AKfycbwKLhHPMnf8it7vl5vgF7i98fueqh00fJCeNg-dbOoQ_Jbck1nO5oxw9AetxvAZWlyzRg`.
- Catalog URL is `VITE_SHEETS_URL` → `/api/catalog`. Stage API is `/api/stage` (in-memory + optional KV; Apps Script is a backup).

## Local

```bash
npm install
npm run dev
```
