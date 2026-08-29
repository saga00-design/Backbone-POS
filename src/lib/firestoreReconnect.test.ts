// Runnable check for the Firestore reconnect-kick guard.
// No test runner is configured in this repo — run it directly:
//
//   npx tsx src/lib/firestoreReconnect.test.ts
//
import assert from 'node:assert/strict';
import { shouldReconnectKick, type ReconnectKickState } from './firestoreReconnect';

let n = 0;
const it = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`  ok  ${name}`);
};

// Baseline: tab foregrounded, online, no kick running, no payment in flight.
const clear: ReconnectKickState = {
  visible: true,
  isOnline: true,
  isKicking: false,
  isPaymentModalOpen: false,
  isPaymentProcessing: false,
};

console.log('firestoreReconnect');

it('kicks when everything is clear', () => {
  assert.equal(shouldReconnectKick(clear), true);
});

// --- payment guard: the reason this function exists ---

it('never kicks while the payment modal is open', () => {
  assert.equal(shouldReconnectKick({ ...clear, isPaymentModalOpen: true }), false);
});

it('never kicks while a payment is processing', () => {
  assert.equal(shouldReconnectKick({ ...clear, isPaymentProcessing: true }), false);
});

it('never kicks while both payment flags are set', () => {
  assert.equal(
    shouldReconnectKick({ ...clear, isPaymentModalOpen: true, isPaymentProcessing: true }),
    false,
  );
});

it('payment guard wins even when the tab just regained focus while online', () => {
  // the exact race the guard exists for: visibilitychange fires mid-payment
  assert.equal(
    shouldReconnectKick({
      visible: true,
      isOnline: true,
      isKicking: false,
      isPaymentModalOpen: true,
      isPaymentProcessing: true,
    }),
    false,
  );
});

// --- other guard conditions ---

it('does not kick when the tab is not visible', () => {
  assert.equal(shouldReconnectKick({ ...clear, visible: false }), false);
});

it('does not kick when offline', () => {
  assert.equal(shouldReconnectKick({ ...clear, isOnline: false }), false);
});

it('does not kick when a kick is already in flight', () => {
  assert.equal(shouldReconnectKick({ ...clear, isKicking: true }), false);
});

console.log(`\n${n} checks passed`);
