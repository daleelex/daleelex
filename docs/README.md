# Handoff: DaleelEx Portal Enhancement

## Overview
This package upgrades the DaleelEx developer portal with: a **new Home / overview dashboard**, an **enhanced Catalog**, a **richer Health & SLO page** (readiness ring, sparklines, status table), an **upgraded Service drawer** (scorecard ring + a real upstream/downstream **dependency graph**), and a **working light/dark theme toggle**. The visual direction evolves the *existing* brand — same teal/navy palette, Instrument Serif display, Inter body, JetBrains Mono labels — just more polished and easier to navigate.

## About the Design Files
The file `DaleelEx.prototype.dc.html` in this bundle is a **design reference**, not production code. It runs on a design-prototype runtime, so you cannot drop it into the Vite app. **Your task is to recreate this design inside the existing `apps/web` codebase** (React + Vite + TypeScript, plain CSS with CSS variables, one component per file), following the patterns already in the repo. Every token, font, and data shape below already matches the repo, so this is an *enhancement of existing components* plus a few new files — not a rewrite.

Open the prototype in a browser to see exact look + behavior. The `screens/` folder has reference PNGs (home light, home dark, catalog, health).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate pixel-faithfully using the repo's existing CSS-variable system and component conventions.

## Target codebase (already exists)
```
apps/web/src/
  styles.css                      ← EDIT: refine tokens + dark theme
  components/
    Layout.tsx / Layout.css       ← EDIT: add Home nav item + working theme toggle
    ServiceCard.tsx / .css        ← KEEP (minor polish optional)
    ServiceDrawer.tsx / .css      ← EDIT: add dependency graph + scorecard ring + sparkline
    TeamDrawer.tsx / .css         ← KEEP
  pages/
    HomePage.tsx / .css           ← NEW: overview dashboard
    ServicesPage.tsx / .css       ← KEEP (already strong; reuse KPI styles)
    HealthPage.tsx / .css         ← EDIT: readiness ring + 14-day sparkline bars
    TeamsPage / TechDocsPage / SettingsPage  ← KEEP
  main.tsx                        ← EDIT: add `/` → HomePage route, redirect index to Home
```
Data still comes from the API (`src/api.ts`, `api.services()` → `Service[]`). The prototype hardcodes the seed data only because it has no backend; **in the app, keep using `useQuery(['services'], api.services)`.** All derived numbers below are computed from `Service[]`, not stored.

---

## Design Tokens

Add a `[data-theme="dark"]` block and refine the existing `:root`/`[data-theme="light"]` in `styles.css`. The toggle sets `document.documentElement.setAttribute('data-theme', …)` (the repo already has the toggle handler in `Layout.tsx` — it just never defined the dark tokens, so wire them up).

### Brand statics (theme-independent)
```
--brand-deep: #0A3743;   --brand-navy: #0B2A47;   --brand-teal: #2FA99B;   --brand-blue: #1F5FA5;
--font-display: "Instrument Serif", Georgia, serif;
--font-body:    "Inter", -apple-system, sans-serif;
--font-mono:    "JetBrains Mono", monospace;
--radius-sm: 8px;  --radius: 12px;  --radius-lg: 16px;
```

### Light theme
```
--bg: #E8E6DF;
--bg-mesh: radial-gradient(1100px 560px at 0% -10%, rgba(47,169,155,0.13), transparent 60%),
           radial-gradient(760px 480px at 100% 0%, rgba(31,95,165,0.09), transparent 60%);
--panel: #FFFFFF;  --panel-2: #F4F2EB;  --panel-3: #E9E6DD;
--line: #DCD8CC;   --line-strong: #C3BDAC;
--ink: #0B2A47;    --ink-2: #3F5465;    --muted: #828D97;
--accent: #2FA99B; --accent-fg: #FFFFFF; --accent-soft: rgba(47,169,155,0.13);
--accent-2: #1F5FA5; --accent-2-soft: rgba(31,95,165,0.12);
--ok: #1FA971; --warn: #C98708; --danger: #D94A3D;
--shadow-sm: 0 1px 2px rgba(11,42,71,0.06), 0 1px 3px rgba(11,42,71,0.04);
--shadow:    0 4px 14px rgba(11,42,71,0.08), 0 2px 4px rgba(11,42,71,0.04);
--shadow-lg: 0 24px 48px rgba(11,42,71,0.16), 0 8px 18px rgba(11,42,71,0.09);
```

### Dark theme  (`[data-theme="dark"]`)
```
--bg: #05141A;
--bg-mesh: radial-gradient(1100px 560px at 0% -10%, rgba(47,169,155,0.20), transparent 60%),
           radial-gradient(760px 480px at 100% 0%, rgba(31,95,165,0.16), transparent 60%);
--panel: #0C1F27;  --panel-2: #122D36;  --panel-3: #1A3D48;
--line: #1F3F4A;   --line-strong: #315A66;
--ink: #E8EEF2;    --ink-2: #B5C5CE;    --muted: #7A8F9A;
--accent: #3EC9B8; --accent-fg: #05141A; --accent-soft: rgba(62,201,184,0.15);
--accent-2: #5C9CE6; --accent-2-soft: rgba(92,156,230,0.16);
--ok: #3DCB8F; --warn: #F2BC4C; --danger: #FF8676;
--shadow-sm: 0 1px 2px rgba(0,0,0,0.35);
--shadow:    0 4px 14px rgba(0,0,0,0.45);
--shadow-lg: 0 24px 48px rgba(0,0,0,0.55), 0 8px 18px rgba(0,0,0,0.4);
```
Body uses `background: var(--bg); background-image: var(--bg-mesh);` and transitions `background-color 240ms, color 240ms`. **Persist the choice** in `localStorage` and read it on load (the current toggle resets to light each refresh — fix that).

### Service-type colors (for icon chip + type label)
```
api:  #2FA99B on rgba(47,169,155,0.16)
db:   #3F7FC4 on rgba(63,127,196,0.16)
web:  #4E94A6 on rgba(78,148,166,0.16)
ml:   #8A6FCB on rgba(138,111,203,0.16)
tool: #D89510 on rgba(216,149,16,0.16)
```
(Note: `web` is intentionally lighter than the repo's old `#0A3743` so it stays visible in dark mode.)

### Status / lifecycle colors
```
healthy → var(--ok),   bg color-mix(in srgb, var(--ok) 14%, transparent)
watch   → var(--warn),  bg color-mix(in srgb, var(--warn) 16%, transparent)
at risk → var(--danger),bg color-mix(in srgb, var(--danger) 15%, transparent)
lifecycle dot: production=var(--ok), beta=var(--warn), deprecated=var(--muted)
```

---

## Derived metrics (compute from `Service[]`)

These power the KPIs, Health page, scorecard, and the "needs attention" lists. Keep them in a small `health.ts` helper so Home and Health share them.

**Service readiness score (0–100):**
```
score(s) = (s.sloTarget ? 30 : 0)
         + (s.ownerTeamId ? 25 : 0)
         + (hasRunbook(s) ? 20 : 0)       // s.links.some(l => l.type === 'runbook')
         + (hasDashboard(s) ? 15 : 0)     // s.links.some(l => l.type === 'dashboard')
         + (s.lifecycle === 'production' ? 10 : 0)
state(score) = score >= 85 ? 'healthy' : score >= 60 ? 'watch' : 'risk'
```
**Catalog readiness** = round(mean(score(s))). On the current seed this is **72**.
**Coverage %** = round(count(predicate)/total × 100): SLO 100%, Owners 100%, Production 92%, Runbooks 33%, Dashboards 8%.
**KPI tiles**: Total services (12), Tier-1 critical (`tier===1` count = 6), In production (count = 11, "92% of catalog"), Readiness (72) — the **4th tile is the accent tile** (navy gradient, see below).

**Per-service operational metrics** (Availability, p95, deploys, incidents, 14-day sparkline): the prototype generates these deterministically because there's no metrics backend. **In the app, source them from your real metrics provider** (Prometheus/Grafana) if available; otherwise keep them out or stub behind a clearly-named `mockMetrics(serviceId)` so it's obvious they're placeholder. Do **not** present fabricated numbers as real in production.

---

## Screens / Views

### 1. Home / Overview dashboard  (NEW — `HomePage.tsx`, route `/`)
Purpose: the landing page — orient the engineer fast and route them anywhere in one click.

Layout (max content width ~ full main column, `padding: 30px 30px 40px`):
1. **Hero banner** — full-width rounded card (`border-radius:18px; padding:34px`), background `linear-gradient(135deg,#0A3743 0%,#0B2A47 100%)`, white text, a soft teal radial glow top-right (`radial-gradient(circle, rgba(47,169,155,0.34), transparent 70%)` at `right:-40px; top:-60px; 320×320`).
   - Kicker: mono 11px uppercase `#7FE7D7` with a 26px rule before it — "DEVELOPER PORTAL".
   - Title: Instrument Serif 42px, `letter-spacing:-0.025em`, e.g. "Good {morning|afternoon|evening}, {user}." + italic teal `#7FE7D7` "Here's your platform." (greeting by `new Date().getHours()`: <12 morning, <18 afternoon, else evening).
   - Sub: 15px `rgba(255,255,255,0.78)`, max 560px.
   - Two buttons: primary teal `#2FA99B` "Browse the catalog" (→ `/services`) with arrow icon + boxshadow `0 6px 16px rgba(47,169,155,0.4)`; ghost "Health board" (→ `/health`), `rgba(255,255,255,0.1)` bg, `1px solid rgba(255,255,255,0.22)`.
2. **KPI row** — `grid-template-columns:repeat(4,1fr); gap:14px`. Tiles described under "Shared components → KPI tile". 4th tile = accent.
3. **Two-column grid** `grid-template-columns:1.55fr 1fr; gap:18px; align-items:start`:
   - **Left column** (`flex column gap:18px`):
     - **Catalog coverage** panel (white `--panel`, `1px solid --line`, `radius:14px; padding:22px 24px`). Title "Catalog coverage" (Instrument Serif 24px) + mono "readiness 72/100" right. Then 5 labeled progress bars: label + `%` row, then an 8px track `--panel-2` `radius:999px` with a fill bar (`width:{pct}%`, colored, `transition:width 600ms cubic-bezier(.2,.7,.2,1)`). Bars: SLO coverage 100% (ok), Owners assigned 100% (ok), In production 92% (accent), Runbooks linked 33% (warn), Dashboards linked 8% (danger).
     - **Recent activity** panel (same shell). Title 24px. Feed rows (`padding:12px 0; border-bottom:1px solid --line`): a 30×30 rounded glyph chip (colored by kind), a title line (`13.5px --ink 500` + a trailing mono detail in `--muted`), a `--muted` team line, and a right-aligned mono timestamp. Kinds + colors: deploy=`--accent` "⤴", score=`--ok` "✓", incident=`--danger` "!", docs=`--accent-2` "❏", lifecycle=`--warn` "◐"; chip bg = `color-mix(in srgb, {color} 16%, transparent)`. In the app, source this from a real activity/audit feed; otherwise label as sample.
   - **Right column** (`flex column gap:18px`), three panels:
     - **Your services** — for the signed-in user's team (prototype uses Product Core). Rows: status dot (state color) + name + mono SLO; whole row is a button → opens that service's drawer; hover `background:var(--panel-2)`.
     - **Needs attention** — services where `state !== 'healthy'`, sorted ascending by score, top 4. Each: name (`13px 600`), `Tier N · {first gap}` sub, and a right state badge (Healthy/Watch/At risk pill). Gaps in priority: "No runbook", "No dashboard", "Pre-production". Click → drawer.
     - **Quick links** — 2×2 grid of tile-buttons (icon chip `--accent-soft`/`--accent`, label `12.5px 600`, mono sub): Register a service (→ catalog), Browse catalog, Health & SLO board, TechDocs. Hover `background:var(--panel-2); border-color:var(--line-strong)`.

### 2. Catalog  (`ServicesPage` — already exists, light polish)
Keep the existing hero, KPI stats, filter row (tier chips + owner select + clear), and `ServiceCard` grid (`repeat(auto-fill,minmax(330px,1fr)); gap:14px`). The prototype matches your current component almost exactly — the only deltas are the refined tokens above and `border-radius:12px` cards. Search/tier/owner filtering logic is unchanged from your `ServicesPage.tsx`. **No structural change required.**

### 3. Health & SLO  (`HealthPage` — enhance)
Layout (`padding:30px 30px 40px`):
1. Kicker "OPERATIONS" + Instrument Serif 42px "Health & SLO".
2. **Hero row** `grid-template-columns:1.3fr 1fr; gap:18px`:
   - **Readiness card** — navy gradient (same as hero), white. Left: a **donut ring**, right: copy. Ring = SVG 128×128, `transform:rotate(-90deg)`, track circle `r=52 stroke=rgba(255,255,255,0.16) stroke-width=11`, value circle same geometry `stroke=#3EC9B8 stroke-width=11 stroke-linecap=round`, `stroke-dasharray="{dash} 999"` where `dash = (readiness/100) × 2π × 52`. Centered number (Instrument Serif 40px) overlaid. Copy: mono kicker "CATALOG READINESS", Instrument Serif 26px "{healthy} of {total} services healthy", muted explainer.
   - **Stat grid** 2×2 of KPI tiles: SLO coverage 100%, Tier-1 ready `{healthyTier1}/{tier1}` (= 4/6), Runbooks 33%, Healthy `{healthy}/{total}` (accent tile).
3. **Service health table** — panel card, `overflow:hidden`. Header row + body rows on a 6-col grid: `1.6fr 0.8fr 1fr 1.2fr 1.4fr 0.7fr` = Service / Status / SLO / Owner / 14-day trend / Ops. Sort by score ascending (worst first). Each row is clickable → drawer; hover `background:var(--panel-2)`.
   - **Service** cell: name `13.5px 600` + mono `{id} · Tier N`.
   - **Status**: state pill.
   - **SLO**: mono target + muted window.
   - **Owner**: team name.
   - **14-day trend** = inline **sparkline bars**: a `display:flex; align-items:flex-end; gap:2px; height:30px` row of 14 thin bars (`flex:1; border-radius:1.5px; align-self:flex-end`). Bar height % = normalize each day's uptime into `[avail-2.5 … 100]`; color `--warn` if below `avail-0.6`, else `--accent`. (Replace with real daily-uptime data in app.)
   - **Ops**: two mono tags "RB" (runbook) and "DB" (dashboard), full opacity + `--ok` if present, else 0.45 opacity + `--muted`.

### 4. Service drawer  (`ServiceDrawer` — enhance)
Right-side overlay: backdrop `rgba(11,42,71,0.34)` + `backdrop-filter:blur(2px)`; panel `position:fixed; right:0; width:540px; max-width:94vw; height:100vh; background:var(--panel); border-left:1px solid var(--line); box-shadow:var(--shadow-lg)`; enter animation `@keyframes drawerIn { from{transform:translateX(24px);opacity:0} to{transform:translateX(0);opacity:1} } 260ms cubic-bezier(.2,.7,.2,1)`. Esc + backdrop click close (already in your component).

Header: close button (34×34 `--panel-2` chip), mono service id, right "Watch" ghost button. Then a type icon chip (42×42, type colors) + type label + tier badge + **state badge**, the Instrument Serif 32px name, description, and the **4 tabs** (overview / scorecard / dependencies / docs) as an underline tab bar (active = `--ink` text + 2px `--accent` bottom border).

- **Overview tab**: a 2-col **key/value grid** (Owner team, Language, SLO target `{target} / {window}`, Tier, Lifecycle, Repository) built as 1px-gap cells over a `--line` background (hairline grid). Then "Health signals · 30 days": 4 small stat cells (`--panel-2`, radius 10) — Availability, Incidents (30d), Deploys (30d), p95 latency, each value colored (ok/warn/accent). Then a **16-bar sparkline** strip (`height:54px; --panel-2; radius:10`), same normalization as the health table. Then Tags as mono pills. *(Metrics = real provider or clearly-labeled mock.)*
- **Scorecard tab**: navy gradient hero with a **ring** (108×108, `r=46 stroke-width=9`, `dash=(score/100)×2π×46`), centered `{score}%`, copy "{passed} / {total} checks passing · Policy standard-v3". Then a checklist (`border-bottom:1px solid --line` rows): green check icon (`stroke=var(--ok)`) when passing, otherwise an empty/alert state, + label. Checks (in order): README present (✓), Owner assigned (`!!ownerTeamId`), SLO defined (`!!sloTarget`), Runbook linked (`hasRunbook`), Dashboard linked (`hasDashboard`), Vulnerability scan clean 7d (✓), Tracing instrumented (`tier===1`), Chaos test passed 30d (✗). `score = round(passed/total×100)`.
- **Dependencies tab** — **this replaces the "coming soon" placeholder.** Build a small **node-link graph** of upstream + downstream services:
  - `upstream = service.dependencies` (the `deps` ids on the service), `downstream = services that list this id in their dependencies` (reverse index). Cap each side at 4.
  - If both empty → empty state (dependency icon + "No dependencies declared.").
  - Else: container `position:relative; width:100%; height:{H}px; background:var(--panel-2); border:1px solid var(--line); radius:14px`. Compute on a 420-wide virtual canvas: center node at `x=210, y=H/2`; upstream nodes at `x=70`, downstream at `x=350`, each column spread vertically with `padTop=34`, `rowGap=(H-2·padTop)/(n-1)`, `H=max(220, maxRows×64+padTop×2-24)`.
  - Draw edges first in an absolutely-positioned SVG (`viewBox="0 0 420 {H}" preserveAspectRatio=none`): `<line>` from each upstream node → center, and center → each downstream node, `stroke=var(--line-strong) stroke-width=1.5`.
  - Draw node cards as absolutely-positioned divs (`left/top` from the coords, width 124 / center 140): a small type-color dot + mono type label, then the service name (truncated). Center node uses `background:var(--accent-soft); border:1px solid var(--accent)`; others `--panel` / `--line`. Make nodes clickable to navigate to that service.
  - Dependency edges (from the seed `catalog-info.yaml` data): auth-001→[pg-main-006]; gw-002→[auth-001]; users-003→[pg-main-006, auth-001]; notify-004→[pg-main-006, users-003]; billing-007→[pg-main-006, users-003]; analytics-008→[pg-main-006]; web-009→[gw-002, auth-001]; recs-010→[search-005]; admin-011→[gw-002, users-003]. (search-005, pg-main-006, feature-flags-012 have none upstream.) In the app these come from the `dependencies` field of `catalog-info.yaml` per ARCHITECTURE.md.
- **Docs tab**: list of doc pages (title + mono path) and external links; clicking a doc opens an inline reader that renders the markdown (you already use `react-markdown` — keep it). Back button returns to the list.

### Sidebar (`Layout.tsx` — enhance)
Add a **Home** item at the top of the "Workspace" group (house icon, route `/`). Keep Catalog/Teams/TechDocs and the Operations group (Health & SLO, Settings). Footer keeps the "All systems operational" pulse pill and the theme toggle — **make the toggle actually flip `data-theme` and persist to localStorage** (sun "☀" / moon "☾" glyph + "Light mode/Dark mode" label). Active nav item = `background:var(--accent-soft); color:var(--accent); font-weight:600`.

---

## Shared components

**KPI tile** — `background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:18px 20px`. Label: mono 10.5px uppercase `letter-spacing:0.12em` `--muted`. Value: **Instrument Serif 42px**, `letter-spacing:-0.03em`, `line-height:1`, `--ink`. Sub: 11.5px `--muted`. **Accent variant**: `background:linear-gradient(135deg,#0A3743 0%,#0B2A47 100%)`, white value, `rgba(255,255,255,0.72)` label, `rgba(255,255,255,0.6)` sub, plus an optional teal radial glow bottom-right. Hover (non-accent): `transform:translateY(-1px); box-shadow:var(--shadow); border-color:var(--line-strong)`.

**State pill** — `font:600 10px JetBrains Mono; text-transform:uppercase; letter-spacing:0.05em; padding:3px 8px; border-radius:5px; color:{state color}; background:{state bg}`.

**Service card hover** — `transform:translateY(-2px); box-shadow:var(--shadow-lg); border-color:var(--accent)` (180ms ease).

**Topbar** — sticky, `padding:15px 30px`, `border-bottom:1px solid --line`, translucent panel bg + `backdrop-filter:blur(12px)`. Breadcrumb (mono "DaleelEx › {Page}"), a 320px search box (`⌘K` kbd), a bell button, and a 38×38 gradient avatar (`linear-gradient(135deg,#2FA99B,#1F5FA5)`). Search filters the catalog; focusing it from another page navigates to the catalog.

---

## Interactions & Behavior
- **Navigation**: sidebar items use `NavLink` (already in repo); add the `/` Home route in `main.tsx` and make it the index.
- **Theme toggle**: `setAttribute('data-theme', next)` on `<html>` + `localStorage.setItem('daleelex-theme', next)`; read it on app init (default light). Body transitions colors 240ms.
- **Drawer**: open on card/row click (sets selected service), Esc/backdrop closes, tabs are local state, reset to "overview" when the service changes. `drawerIn` animation on open.
- **Progress/ring/sparkline**: progress bars animate width 600ms on mount; rings are static SVG dash; sparkline bars are static heights.
- **Hover states** as specified per component above.
- **Responsive**: at ≤900px the sidebar collapses to top (repo already has this breakpoint); KPI grids go 2-col then 1-col; drawer is `max-width:94vw`.

## State Management
- `theme: 'light' | 'dark'` (persisted to localStorage).
- Router location for current page (React Router, already in repo).
- `selectedService` + `drawerTab` for the drawer; `selectedDoc` for the docs reader.
- Catalog: `q` / `tier` / `owner` (already URL-synced via `useSearchParams` in `ServicesPage`).
- Data: `useQuery(['services'], api.services)` everywhere; derive readiness/coverage/health client-side via the `health.ts` helper.

## Assets
No image assets — all icons are inline SVG (Feather-style, `stroke=currentColor`, `stroke-width≈1.75`), already the repo's convention. Fonts load from Google Fonts (Instrument Serif, Inter, JetBrains Mono), already imported in `styles.css`.

## Files in this bundle
- `DaleelEx.prototype.dc.html` — the full interactive prototype (open in a browser; it's the source of truth for exact look + behavior).
- `screens/home.png`, `screens/home-dark.png`, `screens/catalog-light.png`, `screens/health-light.png` — reference screenshots.

## Implementation order (suggested)
1. `styles.css` tokens + dark theme, and wire the `Layout.tsx` toggle to persist `data-theme`.
2. `health.ts` helper (score/state/coverage) — shared by Home + Health.
3. `HomePage.tsx` + route.
4. `HealthPage` ring + sparkline table.
5. `ServiceDrawer` scorecard ring + **dependency graph** + overview signals.
6. Polish pass on `ServicesPage`/`ServiceCard` tokens.

Keep each commit a vertical slice (per CONTRIBUTING in the repo README), run `pnpm lint` + `pnpm test` before a PR, and don't ship fabricated metrics as real — gate any placeholder numbers behind a clearly-named mock.
