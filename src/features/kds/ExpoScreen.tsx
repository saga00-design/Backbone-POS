import React, { useState, useEffect, useRef } from 'react';
import { usePOSStore } from '../../app/store';
import { KDSTicket, POSOrder, Course } from '../../types/pos';
import { CheckCircle2, Clock, AlertCircle, ChefHat, Wine, ArrowRightCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ringKitchenBell, ringBarBell, unlockBellAudio } from '../../lib/bellSound';

export const ExpoScreen: React.FC = () => {
  const { kdsTickets, barKdsTickets, allOrders, serveOrder, fireCourse } = usePOSStore();
  const [now, setNow] = useState(Date.now());
  const prevStatuses = useRef<Record<string, string>>({});
  const prevAllDone = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Bell — rings once per ticket when it transitions to 'bumped'. Watches
  // every ticket regardless of status (not the below activeOrderIds-scoped
  // list), so the transition is observed at the moment it happens.
  const allTickets = [...kdsTickets, ...barKdsTickets];
  useEffect(() => {
    allTickets.forEach(ticket => {
      const prev = prevStatuses.current[ticket.id];
      const curr = ticket.status;

      if (prev && prev !== 'bumped' && curr === 'bumped') {
        if (ticket.station === 'bar') {
          ringBarBell();
        } else {
          ringKitchenBell();
        }
      }

      prevStatuses.current[ticket.id] = curr;
    });
  }, [allTickets]);

  // Unlock audio on first user interaction (browser autoplay restriction)
  useEffect(() => unlockBellAudio(), []);

  // Sync tickets into orders. Orders stay visible until every ticket is
  // 'served' — a fully 'bumped' (but not yet served) order must remain
  // visible so the Table Done prompt (Fix 5) has something to render on;
  // excluding 'bumped' here the way it used to would make Table Done
  // structurally impossible to ever show.
  const activeOrderIds = Array.from(new Set([
    ...kdsTickets.filter(t => t.status !== 'served').map(t => t.orderId),
    ...barKdsTickets.filter(t => t.status !== 'served').map(t => t.orderId)
  ]));

  const COURSE_ORDER: Course[] = ['drinks', 'starters', 'tacos', 'sides', 'mains', 'desserts'];

  const expoTickets = activeOrderIds.map(orderId => {
    const kitchenTkts = kdsTickets.filter(t => t.orderId === orderId && t.status !== 'bumped' && t.status !== 'served');
    const barTkts = barKdsTickets.filter(t => t.orderId === orderId && t.status !== 'bumped' && t.status !== 'served');
    const order = allOrders.find(o => o.id === orderId);
    // Unfiltered — includes bumped/served tickets too, needed so completed
    // courses can still be shown as DONE on the progression strip, and so
    // Table Done can be detected.
    const allOrderTickets = [...kdsTickets, ...barKdsTickets].filter(t => t.orderId === orderId);
    const allKitchenTkts = kdsTickets.filter(t => t.orderId === orderId);
    const allBarTkts = barKdsTickets.filter(t => t.orderId === orderId);

    // The 2-stage KDS flow (pending -> preparing -> bumped) never writes
    // 'ready' anymore, so "station done with its part" now means every
    // ticket for that station on this order is bumped/served — checked
    // against the unfiltered set, since bumped tickets are excluded from
    // kitchenTkts/barTkts above.
    const kitchenReady = allKitchenTkts.length > 0 && allKitchenTkts.every(t => t.status === 'bumped' || t.status === 'served');
    const barReady = allBarTkts.length > 0 && allBarTkts.every(t => t.status === 'bumped' || t.status === 'served');
    const kitchenPreparing = kitchenTkts.length > 0 && kitchenTkts.some(t => t.status === 'preparing');
    const barPreparing = barTkts.length > 0 && barTkts.some(t => t.status === 'preparing');
    const kitchenPending = kitchenTkts.length > 0 && !kitchenPreparing;
    const barPending = barTkts.length > 0 && !barPreparing;

    // An order is "Ready to Serve" once every station that has items is done with them
    const isFullReady = (allKitchenTkts.length === 0 || kitchenReady) && (allBarTkts.length === 0 || barReady);

    // Table Done — every ticket for this order (any station) has been bumped or served
    const allTicketsBumped = allOrderTickets.length > 0 &&
      allOrderTickets.every(t => t.status === 'bumped' || t.status === 'served');

    // Course management
    const hasHeldMains = [...kitchenTkts, ...barTkts].some(t => t.items.some(i => (i.status as string) === 'held' && (i.course || 'mains') === 'mains'));
    const hasHeldDesserts = [...kitchenTkts, ...barTkts].some(t => t.items.some(i => (i.status as string) === 'held' && i.course === 'desserts'));
    const hasHeldTacos = [...kitchenTkts, ...barTkts].some(t => t.items.some(i => (i.status as string) === 'held' && i.course === 'tacos'));
    const hasHeldSides = [...kitchenTkts, ...barTkts].some(t => t.items.some(i => (i.status as string) === 'held' && i.course === 'sides'));
    const createdAt = Math.min(...allOrderTickets.map(t => t.createdAt));
    const elapsed = now - createdAt;
    const timeSeated = order?.seatedAt ? now - order.seatedAt : elapsed;
    const timeSinceLastCourse = order?.lastCourseAt ? now - order.lastCourseAt : elapsed;

    return {
       orderId,
       tableName: kitchenTkts[0]?.tableName || barTkts[0]?.tableName || allOrderTickets[0]?.tableName || 'Table',
       createdAt,
       kitchenStatus: allKitchenTkts.length === 0 ? 'none' : kitchenReady ? 'ready' : kitchenPreparing ? 'preparing' : kitchenPending ? 'pending' : 'none',
       barStatus: allBarTkts.length === 0 ? 'none' : barReady ? 'ready' : barPreparing ? 'preparing' : barPending ? 'pending' : 'none',
       kitchenItems: kitchenTkts.flatMap(t => t.items),
       barItems: barTkts.flatMap(t => t.items),
       isFullReady,
       allTicketsBumped,
       priority: allOrderTickets.some(t => t.priority),
       hasHeldMains,
       hasHeldDesserts,
       hasHeldTacos,
       hasHeldSides,
       allOrderTickets,
       timeSeated,
       timeSinceLastCourse,
       currentCourse: order?.currentCourse
    };
  }).sort((a, b) => a.createdAt - b.createdAt);

  // Ring kitchen bell once per order when it fully transitions to Table Done
  useEffect(() => {
    expoTickets.forEach(t => {
      const prev = prevAllDone.current[t.orderId] || false;
      if (t.allTicketsBumped && !prev) {
        ringKitchenBell();
      }
      prevAllDone.current[t.orderId] = t.allTicketsBumped;
    });
  }, [expoTickets]);

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPacingPrompt = (ticket: any) => {
    if (ticket.isFullReady) return "Service Ready";
    if (ticket.currentCourse === 'starters') {
       if (ticket.timeSinceLastCourse > 900000) return "Alert: Starter Delay";
       if (ticket.kitchenStatus === 'ready') return "Action: Serve Starters";
    }
    if (ticket.hasHeldMains && ticket.currentCourse === 'starters' && ticket.kitchenStatus === 'ready') {
       return "Fire Mains soon?";
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-bg-dark font-sans">
      <div className="h-20 bg-bg-card border-b border-white/5 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-status-available/10 rounded-2xl flex items-center justify-center text-status-available">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">EXPEDITOR CONTROL</h2>
            <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">Global Order Synchronization</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
             <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">PENDING ORDERS</p>
             <p className="text-lg font-black text-white tracking-tighter">{expoTickets.length}</p>
          </div>
          <div className="h-10 w-px bg-white/5" />
          <div className="text-right">
             <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">READY TO SERVE</p>
             <p className="text-lg font-black text-status-available tracking-tighter">
                {expoTickets.filter(t => t.isFullReady).length}
             </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-8 flex gap-6 no-scrollbar items-start">
        <AnimatePresence mode="popLayout">
          {expoTickets.map(ticket => {
            const elapsed = now - ticket.createdAt;

            // Course completion is ticket-status based, not item-status
            // based — individual ticket items never carry 'ready'/'bumped'/
            // 'served' themselves (only 'held'/'pending'); only the parent
            // ticket's own status cycles through the full lifecycle.
            const isCourseComplete = (course: string | undefined) => {
              if (!course) return false;
              const courseItems = ticket.allOrderTickets.flatMap(t => t.items).filter(i => i.course === course);
              if (courseItems.length === 0) return false;
              const relevantTickets = ticket.allOrderTickets.filter(t => t.items.some(i => i.course === course));
              return relevantTickets.every(t => ['ready', 'bumped', 'served'].includes(t.status));
            };

            return (
              <motion.div
                key={ticket.orderId}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -100 }}
                className={cn(
                  "w-96 shrink-0 bg-bg-card rounded-[2.5rem] border overflow-hidden shadow-2xl flex flex-col relative",
                  ticket.isFullReady ? "border-status-available shadow-status-available/20 ring-4 ring-status-available/10" : "border-white/10 shadow-black/60",
                  ticket.priority && !ticket.isFullReady && "border-status-pending shadow-status-pending/20"
                )}
              >
                {/* Header */}
                <div className={cn(
                  "p-8 border-b border-white/5 relative",
                  ticket.isFullReady && "bg-status-available/5"
                )}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{ticket.tableName}</h3>
                      <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest mt-1">
                        ORD #{ticket.orderId.slice(-6)} • {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {ticket.priority && (
                       <div className="px-3 py-1 bg-status-pending text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse">
                         PRIORITY
                       </div>
                    )}
                  </div>

                  {/* Course Progression Strip */}
                  <div className="flex items-center gap-1 flex-wrap mt-3">
                     {COURSE_ORDER.map(course => {
                        const courseItems = ticket.allOrderTickets.flatMap(t => t.items).filter(i => i.course === course);
                        if (courseItems.length === 0) return null;

                        const isHeld = courseItems.every(i => (i.status as string) === 'held');
                        const isDone = !isHeld && isCourseComplete(course);
                        const isActive = !isHeld && !isDone;

                        return (
                           <span key={course} className={cn(
                              "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full transition-all",
                              isDone && "bg-white/5 text-text-muted line-through opacity-50",
                              isActive && "bg-brand-primary/20 text-brand-primary",
                              isHeld && "bg-white/5 text-text-muted"
                           )}>
                              {isDone ? "✓ " : ""}{course}
                              {isHeld ? " · held" : ""}
                           </span>
                        );
                     })}
                  </div>

                  {/* Table Timers */}
                  <div className="mt-4 flex gap-4">
                     <div>
                        <p className="text-[8px] text-text-muted font-black uppercase tracking-widest">Seated</p>
                        <p className="text-xs font-mono font-black text-white">{formatTime(ticket.timeSeated)}</p>
                     </div>
                     <div className="h-6 w-px bg-white/5" />
                     <div>
                        <p className="text-[8px] text-text-muted font-black uppercase tracking-widest">Pacing</p>
                        <p className="text-xs font-mono font-black text-white">{formatTime(ticket.timeSinceLastCourse)}</p>
                     </div>
                     {getPacingPrompt(ticket) && (
                        <div className="ml-auto bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-lg flex items-center justify-center">
                           <p className="text-[9px] font-black text-brand-primary uppercase tracking-tight">{getPacingPrompt(ticket)}</p>
                        </div>
                     )}
                  </div>
                </div>

                {/* Status Dashboard */}
                <div className="grid grid-cols-2 border-b border-white/5">
                  <div className={cn(
                    "p-4 flex flex-col items-center justify-center gap-1 border-r border-white/5 transition-colors",
                    (ticket.kitchenStatus === 'ready' || ticket.kitchenStatus === 'preparing') ? "bg-status-available/20" : ticket.kitchenStatus === 'pending' ? "bg-amber-500/10" : "bg-white/2"
                  )}>
                    <div className="flex items-center gap-2">
                      <ChefHat className={cn("w-4 h-4", (ticket.kitchenStatus === 'ready' || ticket.kitchenStatus === 'preparing') ? "text-status-available" : "text-text-muted")} />
                      <span className={cn("text-[8px] font-black uppercase tracking-widest", (ticket.kitchenStatus === 'ready' || ticket.kitchenStatus === 'preparing') ? "text-status-available" : "text-text-muted")}>
                        Kitchen
                      </span>
                    </div>
                    <span className={cn("text-xs font-black", (ticket.kitchenStatus === 'ready' || ticket.kitchenStatus === 'preparing') ? "text-status-available" : "text-text-muted")}>
                      {ticket.kitchenStatus === 'ready' ? 'READY' : ticket.kitchenStatus === 'preparing' ? 'PREP' : ticket.kitchenStatus === 'pending' ? 'WAITING' : 'N/A'}
                    </span>
                  </div>
                  <div className={cn(
                    "p-4 flex flex-col items-center justify-center gap-1 transition-colors",
                    (ticket.barStatus === 'ready' || ticket.barStatus === 'preparing') ? "bg-status-available/20" : ticket.barStatus === 'pending' ? "bg-amber-500/10" : "bg-white/2"
                  )}>
                    <div className="flex items-center gap-2">
                       <Wine className={cn("w-4 h-4", (ticket.barStatus === 'ready' || ticket.barStatus === 'preparing') ? "text-status-available" : "text-text-muted")} />
                       <span className={cn("text-[8px] font-black uppercase tracking-widest", (ticket.barStatus === 'ready' || ticket.barStatus === 'preparing') ? "text-status-available" : "text-text-muted")}>
                         Bar
                       </span>
                    </div>
                    <span className={cn("text-xs font-black", (ticket.barStatus === 'ready' || ticket.barStatus === 'preparing') ? "text-status-available" : "text-text-muted")}>
                      {ticket.barStatus === 'ready' ? 'READY' : ticket.barStatus === 'preparing' ? 'PREP' : ticket.barStatus === 'pending' ? 'WAITING' : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar min-h-[300px]">
                  {ticket.kitchenItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-brand-primary uppercase tracking-[0.3em]">KITCHEN</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                      {ticket.kitchenItems.filter(i => !i.parentOrderItemUuid).map((item, idx) => {
                        const courseComplete = isCourseComplete(item.course);
                        return (
                        <div key={idx} className="flex gap-4 items-start relative">
                           <span className={cn("text-xl font-black", item.status === 'held' ? "text-white/5" : "text-white/20")}>{item.quantity}</span>
                           <div className={cn((item.status === 'held' || courseComplete) && "opacity-30")}>
                              <div className="flex items-center gap-2">
                                <p className={cn("text-sm font-bold text-white uppercase tracking-tight", courseComplete && "line-through text-text-muted")}>{item.name}</p>
                                {item.status === 'held' && !courseComplete && (
                                   <span className="text-[7px] bg-white/10 text-text-muted px-1 py-0.5 rounded font-black uppercase tracking-widest">HELD</span>
                                )}
                                {courseComplete && (
                                   <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">✓ DONE</span>
                                )}
                              </div>
                              {item.modifiers.length > 0 && (
                                <p className="text-[9px] text-brand-primary font-black uppercase tracking-widest mt-1">
                                  {item.modifiers.map(m => m.name).join(' • ')}
                                </p>
                              )}
                              {ticket.kitchenItems
                                .filter(a => a.parentOrderItemUuid === item.uuid)
                                .map(addon => (
                                  <div key={addon.uuid}
                                       className="flex items-center gap-1.5 mt-1 ml-2">
                                    <div className="w-1 self-stretch bg-brand-primary rounded-full shrink-0" />
                                    <span className="text-[11px] font-black text-brand-primary uppercase tracking-wide">
                                      {addon.name.replace(/\s*batch\s*/gi, '').trim()}
                                    </span>
                                  </div>
                                ))
                              }
                           </div>
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {ticket.barItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-status-pending uppercase tracking-[0.3em]">BAR</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                      {ticket.barItems.filter(i => !i.parentOrderItemUuid).map((item, idx) => {
                        const courseComplete = isCourseComplete(item.course);
                        return (
                        <div key={idx} className="flex gap-4 items-start relative">
                           <span className={cn("text-xl font-black", item.status === 'held' ? "text-white/5" : "text-white/20")}>{item.quantity}</span>
                           <div className={cn((item.status === 'held' || courseComplete) && "opacity-30")}>
                              <div className="flex items-center gap-2">
                                <p className={cn("text-sm font-bold text-white uppercase tracking-tight", courseComplete && "line-through text-text-muted")}>{item.name}</p>
                                {item.status === 'held' && !courseComplete && (
                                   <span className="text-[7px] bg-white/10 text-text-muted px-1 py-0.5 rounded font-black uppercase tracking-widest">HELD</span>
                                )}
                                {courseComplete && (
                                   <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">✓ DONE</span>
                                )}
                              </div>
                              {item.modifiers.length > 0 && (
                                <p className="text-[9px] text-status-pending font-black uppercase tracking-widest mt-1">
                                  {item.modifiers.map(m => m.name).join(' • ')}
                                </p>
                              )}
                              {ticket.barItems
                                .filter(a => a.parentOrderItemUuid === item.uuid)
                                .map(addon => (
                                  <div key={addon.uuid}
                                       className="flex items-center gap-1.5 mt-1 ml-2">
                                    <div className="w-1 self-stretch bg-status-pending rounded-full shrink-0" />
                                    <span className="text-[11px] font-black text-status-pending uppercase tracking-wide">
                                      {addon.name.replace(/\s*batch\s*/gi, '').trim()}
                                    </span>
                                  </div>
                                ))
                              }
                           </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-8 bg-white/5 border-t border-white/5 mt-auto flex flex-col gap-4">
                  {ticket.allTicketsBumped ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-3 border-t border-emerald-500/20 mt-3">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <span className="text-2xl">✓</span>
                      </div>
                      <span className="text-sm font-black text-emerald-400 uppercase tracking-widest">
                        Table Done
                      </span>
                      <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest">
                        All courses served
                      </span>
                      <button
                        onClick={() => serveOrder(ticket.orderId)}
                        className="mt-2 px-6 py-2.5 bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl active:scale-95 hover:bg-emerald-400 transition-all"
                      >
                        Close Table
                      </button>
                    </div>
                  ) : (
                    <>
                    {/* Course Controls */}
                    <div className="flex gap-2">
                       {ticket.hasHeldTacos && (
                          <div className="flex-1 flex flex-col items-center gap-1">
                             <span className="text-[8px] text-amber-400 font-black uppercase tracking-widest animate-pulse">Ready to Fire →</span>
                             <button
                               onClick={() => fireCourse(ticket.orderId, 'tacos')}
                               className="w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-primary text-white border border-brand-primary shadow-lg shadow-brand-primary/20 animate-pulse"
                             >
                                Fire Tacos
                             </button>
                          </div>
                       )}
                       {ticket.hasHeldSides && (
                          <div className="flex-1 flex flex-col items-center gap-1">
                             <span className="text-[8px] text-amber-400 font-black uppercase tracking-widest animate-pulse">Ready to Fire →</span>
                             <button
                               onClick={() => fireCourse(ticket.orderId, 'sides')}
                               className="w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-primary text-white border border-brand-primary"
                             >
                                Fire Sides
                             </button>
                          </div>
                       )}
                       {ticket.hasHeldMains && (
                          <div className="flex-1 flex flex-col items-center gap-1">
                             <span className="text-[8px] text-amber-400 font-black uppercase tracking-widest animate-pulse">Ready to Fire →</span>
                             <button
                               onClick={() => fireCourse(ticket.orderId, 'mains')}
                               className="w-full py-3 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                             >
                                FIRE MAINS
                             </button>
                          </div>
                       )}
                       {ticket.hasHeldDesserts && (
                          <div className="flex-1 flex flex-col items-center gap-1">
                             <span className="text-[8px] text-amber-400 font-black uppercase tracking-widest animate-pulse">Ready to Fire →</span>
                             <button
                                onClick={() => fireCourse(ticket.orderId, 'desserts')}
                                className="w-full py-3 bg-status-pending/10 hover:bg-status-pending/20 border border-status-pending/30 text-status-pending rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                             >
                                FIRE DESSERTS
                             </button>
                          </div>
                       )}
                    </div>

                    {ticket.isFullReady ? (
                       <button
                        onClick={() => serveOrder(ticket.orderId)}
                        className="w-full py-6 bg-status-available text-bg-dark rounded-[1.5rem] flex items-center justify-center gap-4 shadow-2xl shadow-status-available/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                       >
                          <CheckCircle className="w-8 h-8" />
                          <span className="text-xl font-black uppercase tracking-widest">SERVE ORDER</span>
                       </button>
                    ) : (
                       <div className="w-full py-6 bg-white/5 border border-white/10 rounded-[1.5rem] flex items-center justify-center gap-4 text-text-muted">
                          <Clock className="w-6 h-6" />
                          <span className="text-xs font-black uppercase tracking-widest">AWAITING STATIONS</span>
                       </div>
                    )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {expoTickets.length === 0 && (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-text-muted opacity-5">
            <CheckCircle2 className="w-48 h-48 mb-8" />
            <h3 className="text-6xl font-black uppercase tracking-[0.4em]">ALL SERVED</h3>
          </div>
        )}
      </div>
    </div>
  );
};
