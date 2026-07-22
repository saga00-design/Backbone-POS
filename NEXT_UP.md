# Next Up

- No menu item currently has a `parentRecipeId` set, so the "goes with this dish" add-on matching in the order screen's Add-Ons tab will keep falling back to showing all add-ons until items are actually linked via the new field in Menu Management.
- `firestore.rules` now has a rule for the `recipes` collection (2026-07-22 fix) but it hasn't been deployed yet — run `firebase deploy --only firestore:rules` (or paste it into the Firebase console) before the Hub recipe-delete fix actually takes effect.
- Full live manual test pass still outstanding: KDS pending→preparing→bumped cycle + kdsHistory, Table Done with a real multi-station order, course strikethrough on a real 3-course order, all three bells audibly (including rapid back-to-back bumps), the new-order ding firing once per order, and the full golden path end to end. Only type-checked/built/traced in code so far, not run live.
- Bell back-to-back behavior: bumping two tickets quickly reuses the same audio element per bell type, so the second bell cuts off and restarts the first rather than layering both sounds. Doesn't error, but worth confirming it's acceptable during the live test pass above.
- Expo's own bell-on-bump watcher (`src/features/kds/ExpoScreen.tsx`, ~line 24) has the same "ticket disappears the instant it fully bumps" gap that was just fixed for the Kitchen/Bar screens — it was already unreliable before this fix and nothing here made it worse, but it wasn't in scope to touch this round. Worth doing the same move-it-to-the-button-press fix there if Expo's bump-bell (separate from its Table-Done bell) turns out to matter in practice.

## Done

- Sides and add-ons not saving + no way to view/edit/delete them — fixed 2026-07-11, see FIXLOG.md.
- VAT hardcoded-20% fallback in PaymentModal.tsx and PricingEngine.ts, plus two more spots found in the same sweep (OrderEntryScreen.tsx set-menu items, MenuManagementScreen.tsx Add Item default) — fixed 2026-07-22, see FIXLOG.md.
- KDS 2-stage flow, real bell audio, Table Done, permission fallback — fixed 2026-07-22, see FIXLOG.md and KDS_FIX_REPORT.md / KDS_BELL_AND_VERIFICATION_FIX_2026-07-22.md.
- ModifierModal deletion confirmed safe (no remaining references anywhere in the app) — confirmed 2026-07-22.
- Reprinted receipts recalculating VAT from a hardcoded 20% instead of the recorded total — fixed 2026-07-22, see FIXLOG.md.
