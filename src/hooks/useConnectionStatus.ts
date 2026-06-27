import { useSyncExternalStore } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const HEARTBEAT_INTERVAL_MS = 8000;
const PROBE_TIMEOUT_MS = 5000;

// Bypass the Firestore cache and hit the real server.
// A permission-denied response still means the server is reachable — treat as online.
async function probeServer(): Promise<boolean> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'connectionHeartbeat', 'probe')),
      timeout,
    ]);
    return true;
  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.code === 'not-found') return true;
    return false;
  }
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export interface ConnectionStatus {
  isOnline: boolean;
  lastOnlineAt: Date | null;
  offlineDuration: string | null;
}

// ---- Singleton store — initialized once per module ----
// All callers share one Firestore poller and one set of browser event listeners,
// so OfflineBanner + PaymentModal both calling this hook produces a single 8-second probe.

type Listener = () => void;
const _listeners = new Set<Listener>();

let _isOnline = navigator.onLine;
let _lastOnlineAt: Date | null = navigator.onLine ? new Date() : null;
let _offlineSince: Date | null = navigator.onLine ? null : new Date();
let _now = Date.now();
let _tickTimer: ReturnType<typeof setInterval> | null = null;
let _snapshot: ConnectionStatus = {
  isOnline: _isOnline,
  lastOnlineAt: _lastOnlineAt,
  offlineDuration: _offlineSince ? formatDuration(_now - _offlineSince.getTime()) : null,
};

function notify(): void {
  _snapshot = {
    isOnline: _isOnline,
    lastOnlineAt: _lastOnlineAt,
    offlineDuration: _offlineSince ? formatDuration(_now - _offlineSince.getTime()) : null,
  };
  _listeners.forEach(l => l());
}

// Keep the per-second tick alive only while offline so we aren't burning CPU online.
function syncTickTimer(): void {
  if (_offlineSince && !_tickTimer) {
    _tickTimer = setInterval(() => {
      _now = Date.now();
      notify();
    }, 1000);
  } else if (!_offlineSince && _tickTimer) {
    clearInterval(_tickTimer);
    _tickTimer = null;
  }
}

function markOffline(): void {
  _isOnline = false;
  if (!_offlineSince) _offlineSince = new Date();
  notify();
  syncTickTimer();
}

function markOnline(): void {
  _isOnline = true;
  _lastOnlineAt = new Date();
  _offlineSince = null;
  notify();
  syncTickTimer();
}

async function runProbe(): Promise<void> {
  // Skip heartbeats when not authenticated — probing would always fail anyway.
  if (!auth.currentUser) return;
  const alive = await probeServer();
  if (alive) markOnline();
  else markOffline();
}

// Browser events — trust 'offline' immediately; verify 'online' with a real probe.
window.addEventListener('offline', () => markOffline());
window.addEventListener('online', () => void runProbe());

// First probe fires when auth resolves — auth.currentUser is null on module load
// so an immediate runProbe() would be skipped. Also re-probes on subsequent sign-ins.
onAuthStateChanged(auth, user => {
  if (user) void runProbe();
});
setInterval(() => void runProbe(), HEARTBEAT_INTERVAL_MS);

// Arm the tick timer if we started offline.
syncTickTimer();

// ---- Hook ----

function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function getSnapshot(): ConnectionStatus {
  return _snapshot;
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
