# KDS Fix Report

Autonomous run — all 6 requested fixes. `tsc --noEmit` passes cleanly after every change described below.

## Fix 1 — Simplified KDS flow (2 stages instead of 3)
**File:** `src/features/kds/KdsScreen.tsx`

- Removed the `ready` intermediate stage from the ticket action buttons. Flow is now `pending → preparing → bumped`.
- Kitchen buttons: **START PREP** (pending → preparing), **BUMP TO DONE** (preparing → bumped).
- Bar buttons: **START** (pending → preparing), **READY ✓** (preparing → bumped).
- Bottom status text now reads PENDING (amber) / PREPARING (brand-primary) / DONE (emerald).
- `ready` was **not** removed from any type definition (`KDSTicket.status` and `KDSTicketItem.status` in `src/types/pos.ts` still include it), per the rule — it's just no longer a distinct KDS button stage.
- Removed the now-unused `ArrowRightCircle` icon import (was only used by the deleted `ready`-stage button).

## Fix 2 — Bell sounds
**File:** `src/lib/bellSound.ts`

- `ringServiceBell` renamed to `ringBarBell` (single ring, unchanged sound) — this is a rename, not an addition, so I updated its one call site in `KdsScreen.tsx` accordingly.
- Added `ringKitchenBell` (double ring) exactly as specified.

## Fix 3 — Bell on Expo when a ticket bumps
**File:** `src/features/kds/ExpoScreen.tsx`

- Added a `prevStatuses` ref watching every ticket (kitchen + bar) for a transition into `'bumped'`, ringing `ringBarBell()` or `ringKitchenBell()` based on `ticket.station`.
- Added the audio-unlock effect (click/touchstart listeners), matching the one already in `KdsScreen.tsx`.

## Fix 4 — Course strike-through when a course is done
**Files:** `src/features/kds/ExpoScreen.tsx`, `src/features/kds/KdsScreen.tsx`

**Issue found and resolved:** the spec's `isCourseComplete` checked `item.status` for values like `'bumped'`, `'served'`, `'ready'`. Tracing the actual data model, **individual ticket items never carry those statuses** — only `'held'` or `'pending'` are ever written to an item inside a ticket's `items[]` array. Completion is tracked on the **ticket's own top-level `status`** field, not per-item. This is the same class of issue already identified and corrected earlier in this project's KDS work (the Expo course-progression strip), so I applied the same established fix here: `isCourseComplete` now checks the status of the ticket(s) that contain the course's items, not the items themselves.

- **KDS:** a course is "complete" once its whole parent ticket is bumped (bumping is a whole-ticket action in this system, so courses can't complete independently within a single ticket). Items get dimmed, struck through, and tagged "DONE" once their ticket bumps.
- **Expo:** reused/extended the existing course-progression-strip logic into a shared `isCourseComplete(course)` helper, applied to both the strip pills (now also gets `opacity-50` on done courses, per spec) and to individual item rows in the Kitchen/Bar lists (strikethrough, dimmed, "✓ DONE" tag).

**Note on reachability (KDS only):** on the live Kitchen/Bar KDS view, a ticket disappears from the visible list the instant it's bumped (`currentTickets` filters out bumped/served tickets). Since "course complete" for KDS is defined as "the ticket is bumped," this state can only be True for a ticket that has, by definition, already vanished from view — so the strike-through/DONE styling on KDS is logically correct but will rarely or never be visibly observed in the live ticket grid (it would only be reachable via the History tab, which uses a different, simpler rendering with no course concept). I left this as specified rather than restructuring KDS's ticket-visibility filtering, since KDS's "only show active work" behavior is clearly intentional for a working kitchen display, unlike Expo (see Fix 5 below, where the equivalent problem was worth solving).

## Fix 5 — Table Done on Expo
**File:** `src/features/kds/ExpoScreen.tsx`

**Issue found and resolved:** implementing `allTicketsBumped` literally would have been permanently unreachable. `activeOrderIds` (the list that decides which orders even get a card on Expo) excluded any order once **all** its tickets were bumped or served — meaning the instant `allTicketsBumped` would become true, the whole card would already have vanished from the screen in that same render, before the Table Done UI could ever show. I changed `activeOrderIds` to only exclude orders once every ticket is `'served'` (bumped-but-not-served orders now stay visible), so the Table Done prompt has a real, visible moment to exist in before staff click "Close Table" (which calls `serveOrder`, the action that finally removes it). This only affects the top-level "does this order get a card at all" gate — the existing kitchen/bar dashboard, item lists, and course-fire logic (which all separately filter out bumped tickets already) were left untouched.
- Added the "Table Done" block exactly as specified, replacing the normal Course Controls/Serve/Awaiting footer when `allTicketsBumped` is true.
- Fixed a second reachability bug in the given bell-ring code: it used a single shared `useRef(false)` (`prevAllDone`) to track "did the table just become fully done" — but Expo shows many orders simultaneously, so one shared boolean can't correctly track multiple tables independently (the second table to complete would never ring, or would ring incorrectly). Changed it to a `Record<orderId, boolean>` map, following the same per-ID tracking pattern already used elsewhere in this file and in `KdsScreen.tsx`.

## Fix 6 — Permission field names — **not applied as originally specified**
**Files:** `src/types/pos.ts`, `src/features/settings/StaffManagement.tsx`, `src/features/auth/PinLoginScreen.tsx`, `src/lib/seedData.ts`, `src/features/orders/OrderEntryScreen.tsx`

**This was flagged mid-run as a critical decision and the user was asked directly (not resolved autonomously).**

The instruction stated Firestore uses `canVoidItem`/`canApplyDiscount`, not `canVoid`/`canDiscount`. A full codebase search found the opposite: `canVoidItem`/`canApplyDiscount` appeared **nowhere**, while `canVoid`/`canDiscount` were used consistently in the type definition, the actual staff permission-editor UI (`StaffManagement.tsx`), the bootstrap admin account, seed data, and the bulk action bar built earlier this project. Renaming as originally instructed would have permanently broken the bulk Void/Discount buttons for every staff member, including managers who currently have access.

**Resolution the user chose:** treat `canVoidItem`/`canApplyDiscount` as **new, additional** permission fields — not a rename — specifically scoped to the bulk multi-select actions in the order panel, distinct from the existing single-item `canVoid`/`canDiscount` (used nowhere currently, since `ItemActionsModal.tsx`'s single-item Void/Discount tabs have no permission gating at all — confirmed, zero matches there and in `store.ts`, so nothing needed changing in either of those two files). Changes made:
- Added `canVoidItem?: boolean` and `canApplyDiscount?: boolean` to `StaffProfile.permissions` in `src/types/pos.ts` (optional, so existing Firestore documents without them don't become type-invalid).
- Added matching "Bulk Void" / "Bulk Discount" toggles and badges to the Staff Management editor UI, with the same manager/admin/supervisor default-by-role preset as the existing `canVoid`/`canDiscount`.
- Set both new fields to `true` on the bootstrap admin account and added them (as `false`) to the seed data.
- Updated the bulk action bar in `OrderEntryScreen.tsx` to gate on `canVoidItem`/`canApplyDiscount` instead of `canVoid`/`canDiscount`.

## Issues found and how they were resolved (summary)
1. **Item-status vs ticket-status mismatch** (Fix 4) — corrected using the same pattern already established earlier in this project; not treated as a stop-worthy decision since there was one clear correct fix.
2. **Table Done structurally unreachable** (Fix 5) — required changing `activeOrderIds` filtering; judged as the single obvious correct fix (not a genuine design fork) and applied without stopping.
3. **Single shared ref for a per-order boolean** (Fix 5's bell trigger) — bug in the given code; fixed to a per-orderId map.
4. **Permission field names contradicted by the entire codebase** (Fix 6) — stopped and asked; user chose to add new fields rather than rename.

## Anything that still needs manual testing
- **Fix 6, most importantly:** existing staff records already in production Firestore will **not** automatically have `canVoidItem`/`canApplyDiscount` set. Until a manager re-opens each staff member's profile in Staff Management and either re-selects their role (which reapplies the full permission preset) or manually toggles the two new switches on, those staff will **not** see the bulk Void All / Discount buttons — even if they already have the original single-item `canVoid`/`canDiscount`. This needs a manual pass through existing staff profiles.
- Bell sounds (Fix 2/3) — needs a real device test with sound on; double-ring timing (320ms between strikes) was not audibly verified, only visually reviewed in code.
- KDS 2-stage flow (Fix 1) — test the full pending → preparing → bumped cycle on both a Kitchen and a Bar ticket, including the kdsHistory write (already implemented in `store.ts` from earlier work, untouched here) actually populating the History tab after a bump.
- Fix 5's Table Done flow — test with a multi-station order (both a kitchen and a bar ticket) to confirm the card correctly stays visible after both tickets are bumped, shows Table Done, and disappears only after "Close Table" is clicked.
- Fix 4 on Expo — test with a multi-course order where an early course (e.g. drinks) reaches `'ready'`/`'bumped'` while a later course (e.g. mains) is still active, to confirm the earlier course's items show struck-through/DONE while the order card remains open.

## Critical decisions deferred
- Fix 6 was fully resolved via a direct question mid-run (see above) — not left open.
- No other critical decisions were deferred; all other ambiguities encountered had one clearly-correct resolution and were resolved without stopping, each documented above.
