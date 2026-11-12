# Backbone POS

**Repo:** saga00-design/Backbone-POS
**Inspected:** 2026-11-12
**Status:** Active (last pushed 2026-08-29)

## What It Is
A full restaurant Point of Sale system with a Kitchen Display System (KDS). Has a React 19 frontend served via an Express backend, with Zustand for state management and Firebase for real-time data. Features floor plan management, table orders, KDS with bell/verification, menu management, performance metrics, and reporting.

## Tech Stack
- React 19 + TypeScript
- Vite + vite-plugin-pwa
- Tailwind CSS v4
- Zustand v5 (state management)
- Firebase ^12.11.0 (Firestore, Auth)
- Express ^4.21.2 (Node server)
- @google/genai ^1.29.0 (Gemini AI)
- Recharts ^3.8.1
- jspdf + jspdf-autotable
- date-fns ^4
- motion (Framer Motion)
- lucide-react
- clsx + tailwind-merge
- dotenv

## Structure
```
src/
  App.tsx               Root + routing
  main.tsx              Entry point
  features/
    auth/               Authentication
    floor/              Floor plan + table management
    kds/                Kitchen Display System
    menu/               Menu + modifiers
    orders/             Order management
    performance/        Staff/revenue performance
    reporting/          Reports
    settings/           App settings
  components/
    ui/                 Shared UI primitives
    floor/              Floor-specific components
    orders/             Order-specific components
  services/             Firebase + business logic
  domain/               Domain types and models
  hooks/                Custom React hooks
  lib/                  Utilities
server.ts               Express server (SSR + API)
firestore.rules         Security rules
```

## Notable Details
- Has dedicated KDS fix documentation: `KDS_BELL_AND_VERIFICATION_FIX_2026-07-22.md` and `KDS_FIX_REPORT.md` — the KDS bell/verification flow was a tricky bug fix
- `check_latest_tickets.mjs` — script to inspect latest Firestore tickets
- `FIXLOG.md` and `NEXT_UP.md` — active development tracking
- Dev command: `npm run dev` → `tsx server.ts` (not `vite dev` directly)
- Build produces both Vite client bundle AND Express server bundle (`dist/server.cjs`)
- Requires `GEMINI_API_KEY` in `.env` or `.env.local`
- Sister repo to Backbone-Hub (the back-office management system)
