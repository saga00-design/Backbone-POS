import React, { useEffect, useRef, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useConnectionStatus } from '../hooks/useConnectionStatus';

interface OfflineBannerProps {
  position?: 'top' | 'inline';
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ position = 'top' }) => {
  const { isOnline, offlineDuration } = useConnectionStatus();
  const [showRestored, setShowRestored] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (isOnline && wasOffline) {
      setShowRestored(true);
      const t = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  // Nothing to show when connected and no recent restoration.
  if (isOnline && !showRestored) return null;

  if (showRestored) {
    if (position === 'top') {
      return (
        <div role="alert" aria-live="assertive" className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-600 text-white pt-[env(safe-area-inset-top)] py-2 text-center text-sm font-bold tracking-wide">
          Connection restored
        </div>
      );
    }
    return (
      <div role="alert" aria-live="assertive" className="w-full bg-emerald-600/20 border border-emerald-500/40 rounded-2xl px-4 py-3 text-center text-emerald-300 text-sm font-bold">
        Connection restored
      </div>
    );
  }

  const offlineLabel = `You are offline${offlineDuration ? ` (${offlineDuration})` : ''}`;

  if (position === 'top') {
    return (
      <div role="alert" aria-live="assertive" className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white flex items-center justify-center gap-3 pt-[env(safe-area-inset-top)] py-3 px-4">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="font-bold text-sm">{offlineLabel}</span>
        <span className="hidden sm:inline text-white/60">·</span>
        <span className="hidden sm:inline font-black text-sm uppercase tracking-widest">
          DO NOT PROCESS PAYMENTS
        </span>
      </div>
    );
  }

  return (
    <div role="alert" aria-live="assertive" className="w-full bg-red-500/10 border border-red-500/40 rounded-2xl p-4 flex items-start gap-3">
      <WifiOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-red-300 font-bold text-sm">{offlineLabel}</p>
        <p className="text-red-200 font-black text-xs uppercase tracking-widest mt-1">
          DO NOT PROCESS PAYMENTS
        </p>
      </div>
    </div>
  );
};
