# Dear Me, 0.2

Self-trust PWA by Innova Space: make small promises to yourself; every promise you keep becomes a glowing orb in a jar. 12 orbs fill a jar; sealed jars live on the Shelf exactly as they were. Standalone self-care app: **no links or shared data with Nudge!, Noggin? or Drift** (only the Innova Space passkey for sign-in, Phase 9).

## Sources of truth
- **Dear Me, Bible v1.0** (Claude Docs, https://claude.ai/artifact/HyUE2CBhrLbwoPS5581TJG): all logic, rules and build plan. Follow it; ask before changing a decision.
- **Dear Me mockups** (Design canvas, https://claude.ai/artifact/NUwxtUTJWxnp5BRzpoERkh): page "Mockups v1" = every screen (main flow, Settings + Insights, onboarding, Level 4 themes flow); other pages = jars, orb themes, icons, colours.
- **Jar test** (https://claude.ai/artifact/PXfcjuTM6ZPFvok3ZtqRFG): reference for the canvas jar engine (physics, 6 jars, 6 insides, sealing, shelf). Port it in Phase 2.
- Noggin? repo (chnlprz/noggin): shared stack patterns (service worker, Worker, passkeys).

## Stack
Vite + TypeScript (no framework), Dexie over IndexedDB (`src/db`), vite-plugin-pwa, Cloudflare Worker (`worker/index.ts`, `/api/*`) + static assets from `dist/` (`wrangler.jsonc`), custom domain dearme.innovaspace.app. Fonts self-hosted in `public/fonts` (Bodoni Moda for the wordmark, Fraunces italic 500, Inter).

## Rules
- Colours, sizes, radii only from `src/styles/tokens.css` (Plum Midnight). Gold #efb94f = main actions, jar outline, the comma, brand.
- Wordmark: Bodoni Moda 500, `opsz 11` (never thin), "Dear Me" + gold comma. Headings and promise text: Fraunces italic 500. UI: Inter.
- No guilt: no streaks, no "overdue", never show how long a promise sat untouched. Released promises are never counted as failures. Never use "Delete" for promises.
- No categories: orb colour comes from the theme palette, never meaning.
- Every orb keeps its look (inside, colour) from the moment it drops in; sealed jars are frozen (style, orbs, positions). Theme changes affect only new orbs / the current jar's glass.
- Bottom bar: Jar · Shelf · Settings (three-line icon). Header: date, then "Dear Me," (or "Dear <name>," when Use my name is on).
- Floating glowing particles behind Home, Shelf and Welcome; everything respects reduced motion.
- Offline first: no account needed for the jar, promises, shelf and the safety check. First sign-in merges local data, never replaces it.
- Phone first, 320–440 px. Respect safe areas. Touch targets ≥ 44 px.
- Copy: gentle, short, Taglish allowed where the Bible uses it.

## Build phases (Bible › Tech)
1. Foundation ✅ · 2. Jar engine + particles (+ Beta sandbox and unlock-all) ✅ · 3. Promises: tap options, hold to keep, Edit, Refine, Release · 4. Seal, Shelf, rename, jar detail, tap an orb · 5. Levels (3/8/15/24/36) + Jar and what's inside + level-up · 6. Onboarding · 7. Settings, Insights, reminders, full Beta test mode · 8. Offline safety check + hotlines (PH: NCMH 1553) · 9. Passkey, sync, merge · 10. Gentle Help (Claude API, secret ANTHROPIC_API_KEY)

## Beta test mode
Settings › About › tap the version 7 times. Sandbox jar (`sandbox: true` rows never mix with real ones), unlock all, animation replays. Remove or hide before public launch.

## Jar engine (`src/jar/engine.js` + `engine.d.ts`)
Plain JS port of the jar test (canvas 2D + physics). API: mountJar / unmountJar, dropOrb (cork lifts, orb drops, `done` when landed), shakeJar, setJarStyle, setJarLabel, highlightOrb, snapshot (freeze positions when sealing), orbScreenPos, drawStillJar (shelf, pickers), drawOrbPreview. `src/logic/jar.ts` = current jar + orb records (each orb stores its inside and colour).
