# Memory

## Me
Elliott — building Backbone POS, a restaurant point-of-sale system with Kitchen Display System.

## This Repo
Restaurant POS system — React 19 + TypeScript + Firebase frontend, Express backend, Vite PWA. Features floor management, KDS, menu, orders, reporting.

→ Full details: memory/projects/Backbone-POS.md

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Tailwind v4 |
| State | Zustand |
| Backend | Express (server.ts) + Node.js |
| Build | Vite + PWA (vite-plugin-pwa) |
| Database | Firebase (Firestore, Auth) |
| AI | @google/genai (Gemini) |
| Charts | Recharts |
| PDF | jspdf + jspdf-autotable |
| Animation | motion (Framer Motion) |
| Icons | lucide-react |
| Dates | date-fns |
| Dev server | `npm run dev` → tsx server.ts |

## Key Feature Areas
| Feature | Path |
|---------|------|
| Floor plan management | `src/features/floor/` |
| Kitchen Display System | `src/features/kds/` |
| Menu management | `src/features/menu/` |
| Order management | `src/features/orders/` |
| Performance metrics | `src/features/performance/` |
| Reporting | `src/features/reporting/` |
| Auth | `src/features/auth/` |
| Settings | `src/features/settings/` |

## Key Files
| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component |
| `src/main.tsx` | Entry point |
| `server.ts` | Express server (dev + prod) |
| `firestore.rules` | Security rules |
| `src/services/` | Firebase + business logic |
| `src/domain/` | Domain types/models |
| `src/lib/` | Shared utilities |

## Preferences
- Direct, practical answers
- Complete code when making changes
- Point out risks before acting
- Small business → scalable thinking
