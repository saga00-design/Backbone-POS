# Fix Log

## 2026-07-22
Fixed: Existing staff would have silently lost their bulk Void/Discount buttons the moment the new permission fields shipped — added a fallback to their old permissions so nothing changes for them until you explicitly update their profile.
Checked: tsc clean, full production build passed.
Files touched: src/features/orders/OrderEntryScreen.tsx

Fixed: Kitchen/bar bells were still placeholder tones — wired up the three real sound files, added a genuinely-new-order ding, and fixed the audio-unlock so it actually works with real audio files instead of doing nothing.
Checked: tsc clean, full production build passed. Not audibly tested — no audio output available to me here.
Files touched: src/lib/bellSound.ts, src/features/kds/KdsScreen.tsx, src/features/kds/ExpoScreen.tsx, src/lib/useFirestoreSync.ts

Fixed: Four spots where VAT silently fell back to a hardcoded 20% instead of your configured rate (PaymentModal, PricingEngine, a new set-menu item, and the Add Item form default) — all now use the real configured rate.
Checked: tsc clean, full production build passed. Confirmed none of this touches batch/COGS costing. Deliberately did NOT touch a related VAT display bug in receipt PDFs — that one affects how past transactions are shown and needs your call first.
Files touched: src/components/orders/PaymentModal.tsx, src/domain/PricingEngine.ts, src/features/orders/OrderEntryScreen.tsx, src/features/menu/MenuManagementScreen.tsx

Fixed: Recipe deletion in Hub was failing because the shared Firestore security rules had no rule at all for the recipes collection (everything on it, including delete, was silently denied) — added one matching the same pattern used for menu items.
Checked: Confirmed by reading the rules file directly — no rule existed. Could not click-test this live in Hub from here, and the fix isn't live until the rules are actually deployed.
Files touched: firestore.rules

Confirmed: the earlier deletion of the old modifier popup screen is safe — searched the whole app and nothing references it anymore.

Fixed: Expo's KITCHEN/BAR status badges never turned green when a station actually started preparing — they only checked for a "ready" stage that got removed from the kitchen/bar screens a while back, so the badge was permanently stuck between "nothing ordered" and "waiting," with no way to show "actively being prepped." Rebuilt the underlying status check to match how the stations actually work now (pending → preparing → done), so the badge genuinely reflects waiting/preparing/done, live, no refresh needed. As a direct side effect of fixing that same broken check, the "READY TO SERVE" count and full-order-ready highlighting on Expo — which shared the identical bug — should now also work correctly for the first time under the current kitchen/bar flow.
Checked: tsc clean, full production build passed. Traced by hand for both kitchen and bar: waiting → Start Prep → active/green → final bump → done/green, and confirmed a multi-course ticket correctly stays "active" between courses rather than flickering. Confirmed no overlap with the bell-timing fix from the previous run — nothing here touches how or when bells ring.
Files touched: src/features/kds/ExpoScreen.tsx

Fixed: The Bar KDS "Ready" bell almost never rang, while the Kitchen bell seemed to work fine. Root cause: bells were rung by watching for tickets changing state, but a ticket disappears the instant it's fully bumped (it drops out of the live ticket list), so that watcher could never actually catch the moment for any ticket that finishes in one go — which is nearly every bar round (one course), but only sometimes true for kitchen (which usually has multiple courses, so an earlier partial bump would ring by coincidence and hide the same underlying gap). Moved the bell to fire the instant staff press the button, before anything else happens, so it can't be missed on either station.
Checked: tsc clean, full production build passed. Traced by hand: a single-course bar bump now rings once immediately; a multi-course kitchen ticket rings on its earlier partial bump AND rings again on its final bump right before it disappears; confirmed nothing can ring twice for the same button press.
Files touched: src/app/store.ts, src/features/kds/KdsScreen.tsx

Fixed: Reprinted receipts were recalculating VAT from a hardcoded 20% instead of showing what was actually charged — now reads the real recorded VAT total straight off the transaction. Caught and corrected a second, deeper issue in the same fix: the field the printed "GROSS" figure came from is actually stored net-of-VAT despite its name, so the breakdown would have still been wrong even with the right VAT number. Confirmed reprint-only — the original at-time-of-sale receipt path (receiptPrinter.ts) was never affected by any of this.
Checked: tsc clean, full production build passed, manually traced both a simple case and a mixed-VAT-rate case against the actual stored numbers — both matched exactly.
Files touched: src/lib/pdfGenerator.ts

## 2026-07-11
Fixed: Sides and add-ons weren't actually saving because there was no on/off switch anywhere to mark a menu item as one — the app had the data field ready but nothing in the screen ever set it. Added Side and Add-On switches to the menu item editor (with an optional field to link an add-on to a specific dish), and added a new "Sides & Add-Ons" section in Menu Management so anything flagged this way can be found, edited, or deleted afterward.
Checked: Full project type check passed, full production build passed, and traced through creating a new side, editing/unflagging an existing one, and viewing/editing/deleting from the new Sides & Add-Ons list by hand — all confirmed working, including that toggling a switch off actually saves as off.
Files touched: src/features/menu/MenuManagementScreen.tsx
