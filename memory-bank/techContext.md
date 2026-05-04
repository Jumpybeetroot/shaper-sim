# Tech Context

## Languages & Frameworks

- **TypeScript 6** — primary language
- **React 19** — UI framework
- **Vite 8** — build tool and dev server
- **Chart.js 4 + react-chartjs-2** — all graph rendering
- **@phosphor-icons/react 2.1.10** — icon library (use `*Icon` suffix forms)

## Runtime Environment

- **Browser-only** — no server-side component
- **Web Worker** — heavy computation off main thread
- **Client-side state** — no persistence, no backend

## Key Dependencies

```json
{
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "chart.js": "^4.5.1",
  "react-chartjs-2": "^5.3.1",
  "@phosphor-icons/react": "^2.1.10"
}
```

## Build & Dev Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server at http://localhost:5173/ |
| `npm run build` | TypeScript check + Vite production build |
| `npm run test` | Run tests with Node.js native test runner |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build locally |

## Testing

- **Runner:** Node.js native test runner with `--experimental-strip-types`
- **Location:** `shaper-sim-react/tests/`
- **Files:** `appHelpers.test.ts`, `shaperLogic.test.ts`

## Deployment

- **Platform:** GitHub Pages
- **Trigger:** Push to `main` branch
- **Workflow:** `.github/workflows/deploy.yml`
- **Output:** `shaper-sim-react/dist/`
- **URL:** https://jumpybeetroot.github.io/shaper-sim/

## Git Workflow

- **Main branch:** `main` (auto-deploys)
- **WIP branch:** `wip-local-testing`
- **Auto-commit:** After every change, commit and push to wip-local-testing

## Platform Constraints

- Browser must support Web Workers
- Browser must support ES modules
- Float64Array required for physics computations
- No Tailwind, no CSS-in-JS — vanilla CSS only
