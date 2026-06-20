import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useConnectionStatus(): ConnectionStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    navigator.onLine ? new Date() : null
  );
  const [offlineSince, setOfflineSince] = useState<Date | null>(
    navigator.onLine ? null : new Date()
  );
  // Drives the ticking offlineDuration string without an extra state.
  const [now, setNow] = useState(Date.now());

  // Tick every second while offline so offlineDuration stays fresh.
  useEffect(() => {
    if (!offlineSince) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [offlineSince]);

  const markOffline = useCallback(() => {
    setIsOnline(false);
    setOfflineSince(prev => prev ?? new Date());
  }, []);

  const markOnline = useCallback(() => {
    setIsOnline(true);
    setLastOnlineAt(new Date());
    setOfflineSince(null);
  }, []);

  const runProbe = useCallback(async () => {
    // Skip heartbeats when not authenticated — probing would always fail anyway.
    if (!auth.currentUser) return;
    const alive = await probeServer();
    if (alive) markOnline();
    else markOffline();
  }, [markOffline, markOnline]);

  // Browser events — trust 'offline' immediately; verify 'online' with a real probe.
  useEffect(() => {
    const onOffline = () => markOffline();
    const onOnline = () => runProbe();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [markOffline, runProbe]);

  // Heartbeat: probe on mount and every 8 seconds thereafter.
  const runProbeRef = useRef(runProbe);
  runProbeRef.current = runProbe;
  useEffect(() => {
    runProbeRef.current();
    const interval = setInterval(() => runProbeRef.current(), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const offlineDuration = offlineSince ? formatDuration(now - offlineSince.getTime()) : null;

  return { isOnline, lastOnlineAt, offlineDuration };
}
