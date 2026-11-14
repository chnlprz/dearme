# Dear Me, 0.7

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
1. Foundation ✅ · 2. Jar engine + particles (+ Beta sandbox and unlock-all) ✅ · 3. Promises: tap options, hold to keep, Edit, Refine, Release ✅ · 4. Seal, Shelf, rename, jar detail, tap an orb ✅ · 5. Levels (3/8/15/24/36) + Jar and what's inside + level-up ✅ · 6. Onboarding ✅ · 7. Settings, Insights, reminders (setting; delivery via push in 9), full Beta test mode ✅ · 8. Offline safety check + hotlines (PH: NCMH 1553) · 9. Passkey, sync, merge · 10. Gentle Help (Claude API, secret ANTHROPIC_API_KEY)

## Beta test mode
Settings › About › tap the version 7 times. Sandbox jar (`sandbox: true` rows never mix with real ones), unlock all, animation replays. Remove or hide before public launch.

## Jar engine (`src/jar/engine.js` + `engine.d.ts`)
Plain JS port of the jar test (canvas 2D + physics). API: mountJar / unmountJar, dropOrb (cork lifts, orb drops, `done` when landed), shakeJar, setJarStyle, setJarLabel, highlightOrb, snapshot (freeze positions when sealing), orbScreenPos, drawStillJar (shelf, pickers), drawOrbPreview. `src/logic/jar.ts` = current jar + orb records (each orb stores its inside and colour).

## Promises (`src/logic/promises.ts`, `src/ui/home.ts`)
Tap a card = options sheet (Mark as kept · Edit · Refine · Release). Hold 1.1 s = gold fill + twinkles, then keep (vibrate, cork lifts, orb drops). Refine keeps `refinedFrom` (first wording); story steps made › edited/refined › kept/released (+ optional release note). Slots from `src/logic/levels.ts` (Level 2 = 2 slots, Level 4 = 3; unlockAll = 3). A full jar (12) blocks keeping until sealing (Phase 4).
Jar outlines: Classic, Rosewater, Pearl = one spline (straight neck flowing into the shoulders); Moonlight = a true globe; Stardust, Frost = faceted.

## Sealing and the Shelf (`src/logic/seal.ts`, `src/ui/shelf.ts`)
Full jar (12) → "Seal this jar" sheet: a look back (count, dates, how many were made smaller, first and last) + name (max 24) → `sealJar` saves each orb's resting x/y/a from the live jar, sets `sealedAt`, and starts "chapter n+1". Shelf = two jars per wooden plank, newest first, drawn with `drawStillJar` from saved positions (never re-settled). Jar detail: rename (pencil), date range, every promise with the day it was kept and "Made smaller from". Home: tap the tag to rename the current jar; tap an orb for its promise and date (gold ring + card).

## Levels and looks (`src/logic/unlocks.ts`, `src/ui/customize.ts`, `src/ui/levelup.ts`)
Level from real kept promises (sandbox never levels up). Each level 2–6 opens one jar and one inside (+ slots at 2 and 4). Level-up card after the orb lands (Try a new look → Customize). Settings: profile with level, progress and what opens next; "Jar and what's inside" with NEW badges (`seenUnlocks`). Jar pick = glass changes now; inside pick = confirm sheet when the jar has orbs ("<Inside> from your next promise", before → after), then a one-time Home toast (`homeToast`). Locked cards show "Level N · X kept". Entering orbs are drawn after the rim (no rim line across them).

## Onboarding (`src/ui/onboarding.ts`)
Welcome (empty jar, wordmark, tagline) → How it works → What's hard (chips, saved to `settings.hard`) → What gets in the way (saved to `settings.blocks`) → Gentle Help (Allow / Not now → `settings.gentleHelp`) → Your first promise (ideas from the hard picks) → Home. Skip on steps 1–3 goes straight to Home. Beta: Replay onboarding. The Welcome "Sign in" link comes with Phase 9.

## Settings, Insights, check-ins (`src/ui/shell.ts`, `src/ui/insights.ts`, `src/logic/checkins.ts`, `src/logic/backup.ts`)
Settings: profile · Your jar (Jar and what's inside, Insights) · Greeting · Gentle Help (suggestions switch, gentle check-ins) · Reminders (evening time; notifications are delivered by Web Push from Phase 9) · Account (passkey later, Export my jars = JSON) · About (feedback@innovaspace.app, version). Insights: Kept / Made smaller / Released totals and lists (released = choices, never failures), jar summaries. Gentle check-in: an active promise with no change for ~3 days shows one soft card ("Parang mabigat 'to ngayon."), "Ano'ng humaharang?" chips → help that fits (Make it smaller / Change the words / Release); Not now = quiet ~7 days (`checkinAt`). Days are never shown. Jar neck: one clean outline only, stroked without its top edge (no line across the mouth); the cork sits snug over the neck. The live canvas has 40 units of extra room on top (`LT`) so the lifted lid is never cut. Tag tilts down to always fit the canvas; long labels shrink the font.
Feel: soft glass clinks made with Web Audio (orb–orb, orb–glass, chime on landing; silent while settling; `settings.sound`). Move with my phone (`settings.motion`): tilt = gravity follows `devicemotion` accelerationIncludingGravity (sign: iPhone guess by user agent, then self-calibrated from the long-run y; angle = atan2(x, max(|y|,5)) so it works upright and held flat; ±1.2 rad, ±0.45 while the lid is up). Listeners stay bound across jar remounts once allowed. Beta shows a live motion readout under the jar, shake = `acceleration` jolts; iOS asks permission on the first tap. No drag-to-tilt; touch is only for tapping orbs and the tag. Both off under reduced motion (motion).
Beta extras: show a check-in now, clear the sandbox, replay onboarding, show a level-up card.
