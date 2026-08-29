export interface ReconnectKickState {
  /** document.visibilityState === 'visible' */
  visible: boolean;
  isOnline: boolean;
  /** a disableNetwork/enableNetwork cycle is already in flight */
  isKicking: boolean;
  isPaymentModalOpen: boolean;
  isPaymentProcessing: boolean;
}

// The Firestore reconnect "kick" (disableNetwork -> enableNetwork) revives
// long-lived watch streams that go silently stale while a tab sits
// backgrounded — the stream stops receiving server pushes but never errors,
// so the UI just serves cached data until a reload.
//
// It must NOT run when a payment is being taken or verified: PaymentModal's
// post-payment getDocFromServer poll needs a live server round-trip and
// throws the instant the network is disabled, so a badly-timed kick can
// exhaust its retries and raise a false "ALERT MANAGER" even though the
// payment landed fine. Also skipped when the tab is backgrounded, the
// device is offline, or a kick is already running.
export const shouldReconnectKick = (s: ReconnectKickState): boolean =>
  s.visible &&
  s.isOnline &&
  !s.isKicking &&
  !s.isPaymentModalOpen &&
  !s.isPaymentProcessing;
