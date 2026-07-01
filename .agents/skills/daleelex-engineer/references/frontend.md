# Frontend

React + Vite + TypeScript. The existing POC (a single HTML file) is the visual baseline — the real frontend should look like it, behave like it, but be properly structured.

## Folder layout

```
apps/web/
├── src/
│   ├── main.tsx                 entry
│   ├── App.tsx                  router + layout shell
│   ├── routes/                  one file per page
│   │   ├── Catalog.tsx
│   │   ├── ServiceDetail.tsx
│   │   ├── Teams.tsx
│   │   └── ...
│   ├── components/              reusable UI
│   │   ├── ServiceCard.tsx
│   │   ├── Ring.tsx
│   │   ├── TierBadge.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts               typed API client
│   │   ├── auth.ts              Clerk wrapper
│   │   └── query.ts             React Query setup
│   ├── styles/
│   │   ├── tokens.css           CSS variables (the palette from the POC)
│   │   └── globals.css
│   └── types/                   re-export shared types
├── index.html
├── vite.config.ts
└── package.json
```

Keep components dumb. Data-fetching lives in route files or in hooks; components render what they're given. This discipline is what keeps the component library reusable across pages.

## State and data fetching

- **Server state**: TanStack Query (React Query). It handles caching, refetching, stale-while-revalidate, and dedupe for free. Don't hand-roll this.
- **URL state**: `react-router`'s search params. Filters in the catalog view belong in the URL so users can share links. Don't sync them to useState.
- **Local UI state**: `useState` is fine. Reach for `useReducer` only when there's real state-machine complexity.
- **Global client state**: avoid it. If you find yourself wanting Redux or Zustand, first check whether the thing you want "global" is actually server state (put it in React Query) or URL state (put it in search params).

## Routing

`react-router` v6. File-per-route in `routes/`. The router config lives in `App.tsx` and is explicit — no file-system-based routing magic for this project. Explicit routes are easier to read and to reason about.

## Styling

CSS variables defined in `styles/tokens.css` — one file, all the colors, all the spacing, all the radii. Every component imports this file and uses variables, never hex codes inline. This is what makes dark mode and future theming tractable.

Component-scoped CSS via CSS modules (`.module.css`) for anything non-trivial. Inline styles only for dynamic values (computed colors, dimensions). Don't mix approaches within a component.

The palette comes from the POC: deep teal `#0A3743` → mid teal `#1B6B73` → bright teal `#2FA99B`, with blue `#1F5FA5` as a secondary accent and navy `#0B2A47` as ink. Light mode base is warm gray `#E8E6DF`; dark mode base is deep teal `#05141A`.

## Typography

Inter for body, Instrument Serif for display headings, JetBrains Mono for IDs and metadata. Load from Google Fonts with `preconnect`. Fallbacks (`Georgia`, `system-ui`, `monospace`) in every font stack.

## API client

`lib/api.ts` exports typed functions, one per endpoint. Shared types come from `packages/shared`. Example:

```typescript
import type { Service, ServiceFilter } from '@daleelex/shared';

export async function listServices(filter: ServiceFilter): Promise<Service[]> {
  const res = await fetch(`/api/v1/services?${qs(filter)}`, {
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}
```

No giant API object. No class wrapper. Flat functions are easier to tree-shake and easier to mock. If auth, error handling, or request IDs become repetitive, extract a `request()` helper — but only when the repetition is real, not anticipated.

## Auth

Clerk's React SDK. Wrap the app in `<ClerkProvider>`, use `<SignedIn>` and `<SignedOut>` guards in routes that need them, call `useAuth()` in components that need the token.

Admin routes check `user.publicMetadata.role === 'admin'` and redirect otherwise. Keep the source of truth for roles in Clerk; don't shadow it in the DB until we need to.

## Testing

- Unit tests for pure logic in `lib/` and non-trivial hooks. Vitest.
- Component tests with Testing Library for components with meaningful interaction (search input, filter chips, drawer). Don't write tests for static render — they rot and catch nothing.
- E2E with Playwright for the critical flows: sign in, find a service, open its details, see its scorecard. Five happy-path scenarios cover 80% of regressions.

Coverage targets are not useful goals. Test what you'd be afraid to ship without testing, and leave the rest alone.

## Performance

The catalog will have hundreds to low thousands of services. Render the full list; don't paginate the UI when you can virtualize. `react-virtual` if the list gets long enough to matter. But measure first — React at 1000 simple rows is usually fine.

Bundle size matters for internal tools too. Avoid depending on monster libraries for trivial needs (don't pull in moment.js for three date formats; `Intl.DateTimeFormat` exists). Check the bundle with `vite-bundle-visualizer` occasionally.

## Accessibility

Keyboard navigation works for every interactive element. Focus rings are visible. Color isn't the only signal (paired with icons, text, or position). Cards use semantic `<article>`, filters use semantic `<button>`, the search input has a `<label>` even if it's visually hidden. Run axe-core in the test suite.

This isn't optional. An internal tool that excludes colleagues is worse than no tool.

## What to push back on

- "Let's use CSS-in-JS" → the POC works with plain CSS + CSS modules. Don't add a runtime for styling unless there's a concrete reason.
- "Let's use Next.js" → it's an internal app. SSR, edge runtime, server actions, none of it earns its complexity here.
- "Let's add state management" → if you mean Redux/Zustand/Jotai, no. React Query + URL state handles 95% of cases.
- "Let's write a design system" → the POC is the design system. Components are small, patterns are consistent, tokens are centralized. That's a design system. Don't ceremonialize it.
