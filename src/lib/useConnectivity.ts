import { useEffect, useRef } from 'react';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { db } from './firebase';
import { usePOSStore } from '../app/store';
import { shouldReconnectKick } from './firestoreReconnect';

export const useConnectivity = () => {
  const setIsOnline = usePOSStore(state => state.setIsOnline);
  const isKicking = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(window.navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);

  // Long-lived Firestore listeners (menu items, orders, KDS, etc.) can go
  // silently stale after a tab sits backgrounded/idle for a while — the
  // watch stream stops receiving server pushes but never errors, so the UI
  // just quietly serves cached data until a full reload. Forcing a
  // disable/enable cycle on tab-focus-regain re-establishes the stream
  // without needing a restart. The guard conditions (never mid-payment,
  // etc.) live in shouldReconnectKick().
  useEffect(() => {
    const kick = async () => {
      const state = usePOSStore.getState();
      const allowed = shouldReconnectKick({
        visible: document.visibilityState === 'visible',
        isOnline: state.isOnline,
        isKicking: isKicking.current,
        isPaymentModalOpen: state.isPaymentModalOpen,
        isPaymentProcessing: state.isPaymentProcessing,
      });
      if (!allowed) return;

      isKicking.current = true;
      try {
        await disableNetwork(db);
        await enableNetwork(db);
      } catch (err) {
        console.error('[Connectivity] Firestore network kick failed:', err);
      } finally {
        isKicking.current = false;
      }
    };

    document.addEventListener('visibilitychange', kick);
    window.addEventListener('online', kick);

    return () => {
      document.removeEventListener('visibilitychange', kick);
      window.removeEventListener('online', kick);
    };
  }, []);
};
