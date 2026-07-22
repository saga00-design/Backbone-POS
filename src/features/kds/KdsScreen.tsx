import React, { useState, useEffect, useRef } from 'react';
import { usePOSStore } from '../../app/store';
import { KDSTicket, KDSTicketItem, Course } from '../../types/pos';
import { Clock, CheckCircle2, ChefHat, Wine, AlertCircle, Play, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { playNotificationSound } from '../../lib/notifications';
import { ringKitchenBell, ringBarBell } from '../../lib/bellSound';

interface KdsScreenProps {
  station: 'kitchen' | 'bar';
}

export const KdsScreen: React.FC<KdsScreenProps> = ({ station }) => {
  const { kdsTickets, barKdsTickets, kdsHistory, updateKdsTicketStatus } = usePOSStore();
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow] = useState(Date.now());
  const prevTicketsCount = useRef<number>(0);
  const prevStatuses = useRef<Record<string, string>>({});
  const prevBumpedCounts = useRef<Record<string, number>>({});

  const stationTickets = station === 'bar' ? barKdsTickets : kdsTickets;

  // A ticket stays visible as long as it isn't fully bumped — 'bumped'
  // hides it only once every item has actually been bumped too, so a
  // ticket waiting on held items for the next course still shows.
  const currentTickets = stationTickets.filter(t => {
    if (t.status === 'served') return false;
    const hasUnfinishedItems = t.items.some(i =>
      i.status === 'pending' || i.status === 'preparing' || (i.status as string) === 'held'
    );
    return (t.status as string) !== 'bumped' || hasUnfinishedItems;
  });

  // Sound notification effect
  useEffect(() => {
    if (currentTickets.length > prevTicketsCount.current) {
      playNotificationSound();
    }
    prevTicketsCount.current = currentTickets.length;
  }, [currentTickets.length]);

  // Bell — rings whenever a course is bumped (some items newly marked
  // 'bumped') or the whole ticket transitions to 'bumped'. Watches the
  // unfiltered per-station list (not currentTickets) since a fully-bumped
  // ticket is immediately excluded from currentTickets — the transition
  // would never be observed otherwise.
  useEffect(() => {
    stationTickets.forEach(ticket => {
      const prevStatus = prevStatuses.current[ticket.id];
      const currStatus = ticket.status;
      const prevBumpedCount = prevBumpedCounts.current[ticket.id];
      const currBumpedCount = ticket.items.filter(i => (i.status as string) === 'bumped').length;

      const ticketFullyBumped = prevStatus && prevStatus !== 'bumped' && currStatus === 'bumped';
      const courseJustBumped = prevBumpedCount !== undefined && currBumpedCount > prevBumpedCount;

      if (ticketFullyBumped || courseJustBumped) {
        if (station === 'bar') {
          ringBarBell();
        } else {
          ringKitchenBell();
        }
      }

      prevStatuses.current[ticket.id] = currStatus;
      prevBumpedCounts.current[ticket.id] = currBumpedCount;
    });
  }, [stationTickets, station]);

  // Unlock audio on first user interaction (browser autoplay restriction)
  useEffect(() => {
    const unlock = () => {
      const ctx = new (window.AudioContext ||
                      (window as any).webkitAudioContext)();
      ctx.resume().then(() => ctx.close());
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Timer refresh
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getUrgencyColor = (ms: number) => {
    if (ms > 600000) return 'text-status-pending'; // 10 mins
    if (ms > 300000) return 'text-amber-500'; // 5 mins
    return 'text-status-available';
  };

  const getUrgencyBg = (ms: number) => {
    if (ms > 600000) return 'bg-status-pending/20 animate-pulse-slow'; // 10 mins
    if (ms > 300000) return 'bg-amber-500/10'; // 5 mins
    return 'bg-white/5';
  };

  return (
    <div className="h-full flex flex-col bg-bg-dark font-sans">
      {/* Header */}
      <div className="h-20 bg-bg-card border-b border-white/5 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
            {station === 'kitchen' ? <ChefHat className="w-6 h-6" /> : <Wine className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              {station === 'kitchen' ? 'KITCHEN' : 'BAR'} DISPLAY
            </h2>
            <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Station Display v2.0</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(false)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                !showHistory ? "bg-brand-primary text-white" : "bg-white/5 text-text-muted hover:bg-white/10"
              )}
            >
              LIVE
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                showHistory ? "bg-brand-primary text-white" : "bg-white/5 text-text-muted hover:bg-white/10"
              )}
            >
              HISTORY
            </button>
          </div>

          <div className="h-10 w-px bg-white/5" />
          <div className="text-right">
            <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">ACTIVE</p>
            <p className="text-lg font-black text-white tracking-tighter">{currentTickets.length}</p>
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      <div className="flex-1 overflow-x-auto p-8 flex gap-6 no-scrollbar items-start">
        <AnimatePresence mode="popLayout">
          {showHistory ? (
            // History remains similar but simpler
            kdsHistory.filter(h => h.station === station).map(h => (
              <div key={h.id} className="w-80 shrink-0 bg-bg-card/50 rounded-[2rem] border border-white/5 opacity-60">
                 <div className="p-6 border-b border-white/5">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Table {h.tableName || h.tableId}</h3>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mt-1">Bumped {new Date(h.bumpedAt).toLocaleTimeString()}</p>
                 </div>
                 <div className="p-6 space-y-2">
                    {h.items.map((item: any, idx: number) => (
                      <p key={idx} className="text-xs text-white/50 font-bold uppercase tracking-tight">{item.quantity}x {item.name?.replace(/\s*batch\s*/gi, '').trim()}</p>
                    ))}
                 </div>
              </div>
            ))
          ) : (
            currentTickets.map(ticket => {
              const elapsed = now - ticket.createdAt;
              const urgencyColor = getUrgencyColor(elapsed);
              const urgencyBg = getUrgencyBg(elapsed);

              // Items now carry their own 'bumped' status independent of the
              // ticket — bumping only marks the active course's items done,
              // so completion reads from the item, not ticket.status.
              const hasActiveItems = ticket.items.some(i => i.status === 'pending' || i.status === 'preparing');
              const hasHeldItems = ticket.items.some(i => (i.status as string) === 'held');
              const activeCourse = ticket.items
                .filter(i => i.status === 'pending' || i.status === 'preparing')
                .map(i => i.course)[0];
              const bumpLabel = station === 'bar'
                ? 'READY ✓'
                : activeCourse
                ? `DONE — ${activeCourse.toUpperCase()} ✓`
                : 'BUMP TO DONE';

              return (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  className={cn(
                    "w-80 shrink-0 flex flex-col bg-bg-card rounded-[2rem] border overflow-hidden shadow-2xl relative",
                    ticket.priority ? "border-status-pending shadow-status-pending/20" : "border-white/10 shadow-black/40",
                    ticket.status === 'preparing' && "ring-2 ring-brand-primary/30"
                  )}
                >
                  {/* Priority Indicator */}
                  {ticket.priority && (
                    <div className="absolute top-0 right-0 bg-status-pending text-white px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest z-10 animate-pulse">
                      PRIORITY
                    </div>
                  )}

                  {/* Ticket Header */}
                  <div className={cn("p-6 border-b border-white/5", urgencyBg)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                          {ticket.tableName || 'Takeaway'}
                        </h3>
                        <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest mt-1">
                          #{ticket.orderId.slice(-4)} • {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className={cn("flex flex-col items-end font-mono font-black", urgencyColor)}>
                        <div className="flex items-center gap-1.5 text-lg">
                          <Clock className="w-5 h-5" />
                          {formatTime(elapsed)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  {(() => {
                    const visibleItems = ticket.items.filter(i => !i.parentOrderItemUuid);
                    return (
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar min-h-[300px]">
                    <div className="space-y-4">
                      {visibleItems.map((item, idx) => {
                        const itemBumped = (item.status as string) === 'bumped';
                        return (
                        <div
                          key={item.uuid}
                          className={cn(
                            "space-y-2 transition-all",
                            item.status === 'held' && "opacity-40",
                            itemBumped && "opacity-30"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-black text-white shrink-0 mt-0.5">
                              {item.quantity}
                            </span>
                            <div className="flex-1">
                              <h4 className={cn(
                                "text-base font-black uppercase tracking-tight leading-tight",
                                item.status === 'held' ? "text-white/60" : "text-white",
                                itemBumped && "line-through text-text-muted"
                              )}>
                                {item.name}
                              </h4>
                              {/* Course + Held/Done badge row */}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={cn(
                                  "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                  itemBumped
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : item.status === 'held'
                                    ? "bg-white/5 text-text-muted"
                                    : "bg-brand-primary/20 text-brand-primary"
                                )}>
                                  {itemBumped ? "✓ " : ""}{item.course || 'mains'}
                                </span>
                                {item.status === 'held' && !itemBumped && (
                                  <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                                    HELD
                                  </span>
                                )}
                                {itemBumped && (
                                  <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                                    DONE
                                  </span>
                                )}
                              </div>
                              {item.modifiers?.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {item.modifiers.map((m, mIdx) => (
                                    <span key={mIdx} className="text-[9px] font-black text-brand-primary uppercase tracking-tighter bg-brand-primary/10 px-2 py-0.5 rounded-md border border-brand-primary/20">
                                      + {m.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.notes && (
                                <div className="mt-2 bg-status-pending/10 border-l-2 border-status-pending p-2 rounded-r-lg">
                                  <p className="text-[10px] font-black text-status-pending uppercase tracking-tight italic">
                                    "{item.notes}"
                                  </p>
                                </div>
                              )}
                              {/* Addons — shown inside parent item, like notes */}
                              {ticket.items
                                .filter(a => a.parentOrderItemUuid === item.uuid)
                                .map(addon => (
                                  <div key={addon.uuid}
                                       className="flex items-center gap-1.5 mt-1">
                                    <div className="w-1 self-stretch bg-brand-primary rounded-full shrink-0" />
                                    <span className="text-[11px] font-black text-brand-primary uppercase tracking-wide">
                                      {addon.name.replace(/\s*batch\s*/gi, '').trim()}
                                    </span>
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                    );
                  })()}

                  {/* Actions */}
                  <div className="p-6 bg-white/5 border-t border-white/5 gap-3 flex flex-col">
                    {ticket.items.some(i => (i.status as string) === 'held') && (
                      <div className="flex items-center gap-2 mb-2 px-2">
                        <AlertCircle className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                          {ticket.items.filter(i => (i.status as string) === 'held').length} Items Held
                        </span>
                      </div>
                    )}
                    {ticket.status === 'pending' && (
                      <button
                        onClick={() => updateKdsTicketStatus(ticket.id, station, 'preparing')}
                        className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center gap-3 transition-all group"
                      >
                        <Play className="w-5 h-5 text-brand-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest">
                          {station === 'bar' ? 'START' : 'START PREP'}
                        </span>
                      </button>
                    )}

                    {ticket.status === 'preparing' && hasActiveItems && (
                      <button
                        onClick={() => updateKdsTicketStatus(ticket.id, station, 'bumped')}
                        className="w-full py-4 bg-brand-primary text-white rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">
                          {bumpLabel}
                        </span>
                      </button>
                    )}

                    {ticket.status === 'preparing' && !hasActiveItems && hasHeldItems && (
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                            Waiting for next course
                          </span>
                        </div>
                        <span className="text-[8px] text-text-muted font-bold uppercase tracking-widest">
                          {ticket.items.filter(i => (i.status as string) === 'held').length} items held
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] font-black text-text-muted uppercase tracking-[0.2em] px-2">
                       <span>{ticket.items.length} ITEMS</span>
                       <span className={cn(
                         ticket.status === 'pending' && "text-amber-500",
                         ticket.status === 'preparing' && "text-brand-primary",
                         (ticket.status as string) === 'bumped' && "text-emerald-500"
                       )}>
                         {ticket.status === 'pending' ? 'PENDING' : ticket.status === 'preparing' ? 'PREPARING' : (ticket.status as string) === 'bumped' ? 'DONE' : ticket.status}
                       </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {((!showHistory && currentTickets.length === 0) || (showHistory && kdsHistory.filter(h => h.station === station).length === 0)) && (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-text-muted opacity-10">
            <ChefHat className="w-32 h-32 mb-6" />
            <h3 className="text-4xl font-black uppercase tracking-[0.5em]">CLEAR</h3>
          </div>
        )}
      </div>
    </div>
  );
};
