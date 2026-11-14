# ICU 360

Bedside critical care reference for Indian ICUs: 40 modules, clickable algorithms, 50 calculators, an ABG interpreter, a ventilator playground, a code timer, critical care news and a daily quiz. Installable as an app (PWA) and usable offline.

Built with Next.js 16 (App Router, static generation), React 19, Tailwind CSS 4 and Framer Motion. Personal data (progress, saved items, quiz streak, theme) stays in the browser's localStorage. There are no accounts.

> Educational reference for trained clinicians. It does not replace clinical judgement or local protocols.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (runs the prebuild step first) |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest: ABG interpreter, all 50 calculator examples, ventilator model |
| `npm run validate:content` | Validates every `module.json` and `calculators.json` (needs `pip install jsonschema`) |
| `npm run views:update` | Writes rounded view counts to `content/views.json` (run by the weekly Action) |

`scripts/prebuild.mjs` runs before `dev`, `build` and `typecheck`. It reads `content/` and generates `src/generated/` (catalogue, valid view keys), `public/search-index.json`, `public/precache.json` and `public/sw.js`. These files are git-ignored.

## Environment variables

Copy `.env.example` to `.env.local`. Everything is optional; the site builds and runs without any of them.

| Variable | Used by | Notes |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | `/api/view`, `/api/stats`, `/api/views-weekly` | From the Upstash console, "REST API" section |
| `UPSTASH_REDIS_REST_TOKEN` | same | Use the normal token, not the read-only one |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | same (fallback) | Added automatically by the Vercel Marketplace "Upstash for Redis" integration. Used when the `UPSTASH_*` names are not set |
| `STATS_PASSWORD` | `/stats` | Long random string. `/stats` is disabled if unset |
| `NEXT_PUBLIC_SITE_URL` | metadata, share links | Defaults to `https://icu360.in` |

## Content

All clinical content lives in `content/` as JSON. The app reads it at build time, so **any change goes live on the next deploy** (push to `main` and Vercel rebuilds).

```
content/
  modules/NN-<module-id>/module.json   40 modules: topics, bedside steps, dose cards, algorithms, quizzes, references
  shared/calculators.json              50 calculators (safe formula grammar, interpretation bands, worked examples)
  shared/modules-index.json            sections, phases and order
  shared/schema/                       JSON Schemas
  shared/CONTENT_FORMAT.md             field-by-field guide
  news/news.json                       news items for /news
  quiz/daily.json                      daily quiz sets for /quiz
  views.json                           public view counts (written by the weekly Action, do not edit)
```

### Editing a module

1. Edit `content/modules/<NN-id>/module.json` (see `content/shared/CONTENT_FORMAT.md`).
2. Run `npm run validate:content` and `npm test` (calculator examples are checked).
3. Update `lastReviewed`, commit and push.

Internal review fields (`reviewFlags`, `verify` notes) are never shown on the site.

### Adding news

Add an item to the top of `items` in `content/news/news.json`:

```json
{
  "id": "2026-11-20-ssc-update",
  "date": "2026-11-20",
  "tag": "Guideline",
  "source": "Intensive Care Medicine",
  "title": "Short headline",
  "summary": "Two sentences on what changed and why it matters at the bedside.",
  "url": "https://doi.org/...",
  "moduleId": "sepsis-septic-shock"
}
```

`tag` is one of `Guideline`, `Trial`, `India`, `Drug safety`, `Review`. `moduleId` is optional and links the item to a module. The page sorts newest first and shows a welcome card when the list is empty.

### Adding a daily quiz

Add a set to `sets` in `content/quiz/daily.json`. The quiz page shows the set whose `date` matches today in India time, or the latest earlier set if none matches. Only today's set counts towards the streak, which is stored on the user's device.

```json
{
  "date": "2026-11-16",
  "title": "Optional theme",
  "questions": [
    {
      "id": "2026-11-16-1",
      "stem": "Question?",
      "options": ["A", "B", "C", "D"],
      "answerIndex": 2,
      "explanation": "Why C is right.",
      "reference": { "label": "Citation", "url": "https://doi.org/..." },
      "moduleId": "fluids-electrolytes",
      "topicId": "hyperkalaemia"
    }
  ]
}
```

## View counts

- Each topic, module and tool page sends one beacon per browser session to `POST /api/view`. Only keys that exist in the content are accepted. Counts go to two Redis sorted sets: `views:all` and `views:week:<YYYY-Www>` (ISO weeks in India time, kept 90 days). No IP addresses or user data are stored.
- Every Monday at 00:30 IST, `.github/workflows/weekly-views.yml` runs `scripts/update-views.mjs`. It writes `content/views.json` with counts rounded **down** to the nearest 1,000, and the most-read topic of the week that just ended (`topTopic`). It commits only when something visible changed, which triggers a redeploy.
- The site shows an eye icon with `New` (under 1,000), `1K`, `12K`, or `1.2M`. Home shows "Top topic of the week" (or an editor's pick until there is data).
- `/stats` shows exact counts for this week, last week and all time, behind `STATS_PASSWORD`.

The Action needs **no secrets** by default: it reads the already-rounded numbers from the live site's public `GET /api/views-weekly` (exact counts never leave the server). It uses `https://icu360.vercel.app` until you set a repository **variable** `SITE_URL` (Settings → Secrets and variables → Actions → Variables), e.g. `https://icu360.in`. If you prefer the Action to read Redis directly, add repository secrets `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` + `KV_REST_API_TOKEN`); they take priority. You can also run it by hand from the Actions tab ("Run workflow").

## Deploying on Vercel

1. In Vercel, **Add New → Project** and import `XzeBitOP/icu360`. The framework preset is detected as Next.js; keep the default build command (`npm run build`) and output.
2. Create a free Redis database at [upstash.com](https://upstash.com) (region: Mumbai `ap-south-1` is closest). Copy the REST URL and token. Or use Vercel's Marketplace → Upstash integration, which adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` for you (the code accepts those names, so step 3's Upstash variables can be skipped).
3. In the Vercel project, **Settings → Environment Variables**, add for Production (and Preview if you like):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `STATS_PASSWORD`
   - `NEXT_PUBLIC_SITE_URL` = `https://icu360.in`
4. Deploy. Then **Settings → Domains**, add `icu360.in` (and `www.icu360.in` redirecting to it) and set the DNS records Vercel shows at your registrar.
5. Optional: in GitHub, set the repository variable `SITE_URL` to your live URL for the weekly Action (no secrets needed; see "View counts").

## PWA and offline

- `public/sw.js` is generated from `scripts/sw-template.js` with a new version on every build, so users get updates on their next visit.
- Pages are cached as they are visited (network first, cache fallback). Static assets are cache-first. `/api` and `/stats` are never cached.
- **Progress → Download for offline use** saves every module, topic, quiz and calculator page on the device.
- The service worker only registers in production builds.

## Design

Liquid-glass UI with light and dark themes that follow the device, plus a manual toggle (stored as `icu360:theme`). Heavy blur is limited to a few surfaces and switched off on low-memory Android phones, with `prefers-reduced-transparency`, and where `backdrop-filter` is unsupported.

Icons and favicons are generated from `assets/brand/` with `python3 scripts/make-icons.py` (needs Pillow).

## Project layout

```
src/app/            routes (home, browse, section, module, topic, quiz, tools, news, saved, progress, search, stats, api)
src/components/     server components; client/ holds interactive pieces (algorithm stepper, calculators, ABG, ventilator, code timer, quiz)
src/lib/            content loaders, safe formula evaluator, ABG interpreter, ventilator model, local store, badges
scripts/            prebuild, service worker template, weekly views, icon generator
tests/              Vitest suites
content/            clinical content (JSON)
```

## Licence

Code and content © ICU 360. All rights reserved unless stated otherwise.
