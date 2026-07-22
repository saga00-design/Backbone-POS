# KDS Bell & Verification Fix — 2026-07-22

Consolidated run covering the checkpoint commit plus Steps 2–6 of the follow-up
task. Step 7 (live manual test pass) was **not** performed by me — see "Still
needs you" below — so nothing beyond the Step 1 checkpoint has been committed.

## Step 1 — Checkpoint commit
Committed locally as `cf4001a`: "wip: KDS 2-stage flow, bell sounds, table
done, permission fields — pending manual test pass". Not pushed.

## Step 2 — Permission backfill fix
`store.ts` never checked `canVoidItem`/`canApplyDiscount` at all — only
`OrderEntryScreen.tsx`'s bulk-action bar gates on them (two spots, lines
~1349 and ~1357). Added `?? canVoid ?? false` / `?? canDiscount ?? false`
fallbacks at both spots. Existing staff without the new fields keep their
current Void/Discount access; nothing was renamed. `tsc --noEmit` clean.

## Step 3 — Real bell audio
Rewrote `bellSound.ts` to play the three real files instead of synthesized
oscillator tones:
- `ringBarBell()` → `/bell-ready.mp3`
- `ringKitchenBell()` → `/bell-complete.mp3`
- new `ringNewOrderBell()` → `/new-order.mp3`

All three `Audio` objects are created at module load (this module is
imported from `App.tsx` via `useFirestoreSync`, so it's live at app start,
not first trigger). `play()` is never awaited, so bell calls stay
synchronous. Playback failures are swallowed silently.

Replaced the old per-screen `AudioContext.resume()` unlock effects in
`KdsScreen.tsx` and `ExpoScreen.tsx` (which did nothing for `HTMLAudioElement`
autoplay policy) with a shared `unlockBellAudio()` that actually
play+pause's the three real elements on first click/touch.

Wired `ringNewOrderBell()` into `useFirestoreSync.ts`'s `kdsTickets` and
`barKdsTickets` `onSnapshot` listeners. Each listener tracks its own
per-ticket-id "seen" set (mirrors the existing per-orderId Table Done guard
pattern); the very first snapshot after login/reconnect populates the set
without ringing (so tickets already in progress never ding), and only
ticket ids not already in the set ring the bell going forward. Guards are
reset on auth change. `tsc --noEmit` clean.

**Known limitation, needs your live check:** rapid back-to-back bumps reuse
the same `Audio` element per bell type, so a second bell fired while the
first is still playing will cut it off and restart rather than layer both
sounds. It won't error, but you should confirm that's acceptable during
Step 7 — I have no audio output in this environment to verify by ear.

## Step 4 — ModifierModal deletion
Full-repo search for `ModifierModal` found zero remaining references.
Deletion confirmed safe.

## Step 5 — VAT sweep
Found and fixed four hardcoded-`20` VAT spots (all now
`?? POS_CONFIG.DEFAULT_VAT_RATE` or `??`-guarded reads of it):
- `PaymentModal.tsx` (~line 51) — live order VAT-rate fallback when reading item snapshots
- `PricingEngine.ts` (~line 61) — live order VAT-total calculation fallback (also switched `||` → `??` so a genuinely 0%-rated item isn't wrongly bumped to 20%)
- `OrderEntryScreen.tsx` (~line 345) — VAT rate assigned to a newly-added set-menu item
- `MenuManagementScreen.tsx` (~line 756) — default VAT rate pre-filled on the "Add Item" form

None of these touch batch/COGS calculations — confirmed `PricingEngine.ts`'s
Cost Calculation (COGS) block is untouched and doesn't reference VAT.
`tsc --noEmit` and a full production build both passed clean.

**Stopped and did not fix — needs your decision:** `pdfGenerator.ts` (~line
242) recomputes a "VAT BREAKDOWN" section on printed/reprinted receipts using
a hardcoded 20% rate, and — more importantly — **ignores the transaction's
actually-recorded `vatTotal`** (`standardVat` is computed on line 241 and
never used). This means a reprinted historical receipt shows a VAT
breakdown that doesn't necessarily match what was actually charged at the
time. This directly affects how already-recorded transactions are
displayed, which is exactly the category I'm told to stop on rather than
silently reinterpret. Left completely untouched pending your call.

## Step 6 — Hub recipe delete bug
`firestore.rules` had **no rule at all** for a `recipes` collection —
meaning every operation on it, including delete, falls to Firestore's
default deny. This is almost certainly the entire cause of the reported
permissions error. Added a rule matching the same convention already used
for `menuItems`/`modifierGroups` in this file (read: any authenticated
staff at the right location; write — including delete — manager-only).

**Could not fully verify — needs you:**
1. I don't have access to Hub's live UI from this environment, so I could
   not click through "delete a test recipe" myself to confirm the fix.
2. Editing `firestore.rules` in this repo does **not** deploy it — the live
   rules on Firebase won't change until someone runs
   `firebase deploy --only firestore:rules` (or pastes the updated rule into
   the Firebase console). I did not run this myself since deploying
   security rules to production is exactly the kind of action I should
   check with you on first.

## Still needs you
- Run `firebase deploy --only firestore:rules` (or update it in the
  Firebase console) — the recipes fix isn't live until you do.
- Confirm the recipes delete actually works in Hub afterward.
- Decide what to do about `pdfGenerator.ts`'s VAT breakdown on reprinted
  receipts (Step 5) — I did not touch it.
- Run the full Step 7 manual test pass yourself on a real test table:
  pending→preparing→bumped cycle + kdsHistory, Table Done with a real
  multi-station order, course strikethrough on a real 3-course order, all
  three bells audibly (including back-to-back bumps), the new-order ding
  firing exactly once per new order, and the full golden path end to end.
  None of this was live-tested by me — only type-checked, built, and
  traced through in code.

Nothing beyond the Step 1 checkpoint commit has been committed, per the
original instructions, since Step 7 couldn't be completed.
