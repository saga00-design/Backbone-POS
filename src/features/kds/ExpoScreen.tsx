import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../../app/store';
import { KDSTicket, POSOrder } from '../../types/pos';
import { CheckCircle2, Clock, AlertCircle, ChefHat, Wine, ArrowRightCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const ExpoScreen: React.FC = () => {
  const { kdsTickets, barKdsTickets, allOrders, serveOrder, fireCourse } = usePOSStore();
  const [now, setNow] = useState(Date.now());
  
  // Existing state logic...
  
  // Inside the map loop...
  // ...
  
  // (I need to replace the card content)
  // Let's replace the whole card inside the map for clarity as it's a major change


  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync tickets into orders
  const activeOrderIds = Array.from(new Set([
    ...kdsTickets.filter(t => t.status !== 'bumped' && t.status !== 'served').map(t => t.orderId),
    ...barKdsTickets.filter(t => t.status !== 'bumped' && t.status !== 'served').map(t => t.orderId)
  ]));

  const expoTickets = activeOrderIds.map(orderId => {
    const kitchenTkts = kdsTickets.filter(t => t.orderId === orderId && t.status !== 'bumped' && t.status !== 'served');
    const barTkts = barKdsTickets.filter(t => t.orderId === orderId && t.status !== 'bumped' && t.status !== 'served');
    const order = allOrders.find(o => o.id === orderId);
    
    const kitchenReady = kitchenTkts.length > 0 && kitchenTkts.every(t => t.status === 'ready');
    const barReady = barTkts.length > 0 && barTkts.every(t => t.status === 'ready');
    const kitchenPending = kitchenTkts.length > 0 && !kitchenReady;
    const barPending = barTkts.length > 0 && !barReady;
    
    // An order is "Ready to Serve" if all its active station tickets are 'ready'
    const isFullReady = (kitchenTkts.length === 0 || kitchenReady) && (barTkts.length === 0 || barReady);
    
    // Course management
    const hasHeldMains = [...kitchenTkts, ...barTkts].some(t => t.items.some(i => (i.status as string) === 'held' && (i.course || 'mains') === 'mains'));
    const hasHeldDesserts = [...kitchenTkts, ...barTkts].some(t => t.items.some(i => (i.status as string) === 'held' && i.course === 'desserts'));
    const createdAt = Math.min(...[...kitchenTkts, ...barTkts].map(t => t.createdAt));
    const elapsed = now - createdAt;
    const timeSeated = order?.seatedAt ? now - order.seatedAt : elapsed;
    const timeSinceLastCourse = order?.lastCourseAt ? now - order.lastCourseAt : elapsed;

    return {
       orderId,
       tableName: kitchenTkts[0]?.tableName || barTkts[0]?.tableName || 'Table',
       createdAt,
       kitchenStatus: kitchenTkts.length === 0 ? 'none' : kitchenReady ? 'ready' : kitchenPending ? 'pending' : 'none',
       barStatus: barTkts.length === 0 ? 'none' : barReady ? 'ready' : barPending ? 'pending' : 'none',
       kitchenItems: kitchenTkts.flatMap(t => t.items),
       barItems: barTkts.flatMap(t => t.items),
       isFullReady,
       priority: [...kitchenTkts, ...barTkts].some(t => t.priority),
       hasHeldMains,
       hasHeldDesserts,
       timeSeated,
       timeSinceLastCourse,
       currentCourse: order?.currentCourse
    };
  }).sort((a, b) => a.createdAt - b.createdAt);

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
                    ticket.kitchenStatus === 'ready' ? "bg-status-available/20" : ticket.kitchenStatus === 'pending' ? "bg-amber-500/10" : "bg-white/2"
                  )}>
                    <div className="flex items-center gap-2">
                      <ChefHat className={cn("w-4 h-4", ticket.kitchenStatus === 'ready' ? "text-status-available" : "text-text-muted")} />
                      <span className={cn("text-[8px] font-black uppercase tracking-widest", ticket.kitchenStatus === 'ready' ? "text-status-available" : "text-text-muted")}>
                        Kitchen
                      </span>
                    </div>
                    <span className={cn("text-xs font-black", ticket.kitchenStatus === 'ready' ? "text-status-available" : "text-text-muted")}>
                      {ticket.kitchenStatus === 'ready' ? 'READY' : ticket.kitchenStatus === 'none' ? 'N/A' : 'PREP'}
                    </span>
                  </div>
                  <div className={cn(
                    "p-4 flex flex-col items-center justify-center gap-1 transition-colors",
                    ticket.barStatus === 'ready' ? "bg-status-available/20" : ticket.barStatus === 'pending' ? "bg-amber-500/10" : "bg-white/2"
                  )}>
                    <div className="flex items-center gap-2">
                       <Wine className={cn("w-4 h-4", ticket.barStatus === 'ready' ? "text-status-available" : "text-text-muted")} />
                       <span className={cn("text-[8px] font-black uppercase tracking-widest", ticket.barStatus === 'ready' ? "text-status-available" : "text-text-muted")}>
                         Bar
                       </span>
                    </div>
                    <span className={cn("text-xs font-black", ticket.barStatus === 'ready' ? "text-status-available" : "text-text-muted")}>
                      {ticket.barStatus === 'ready' ? 'READY' : ticket.barStatus === 'none' ? 'N/A' : 'PREP'}
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
                      {ticket.kitchenItems.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-start relative">
                           <span className={cn("text-xl font-black", item.status === 'held' ? "text-white/5" : "text-white/20")}>{item.quantity}</span>
                           <div className={cn(item.status === 'held' && "opacity-30")}>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-white uppercase tracking-tight">{item.name}</p>
                                {item.status === 'held' && (
                                   <span className="text-[7px] bg-white/10 text-text-muted px-1 py-0.5 rounded font-black uppercase tracking-widest">HELD</span>
                                )}
                              </div>
                              {item.modifiers.length > 0 && (
                                <p className="text-[9px] text-brand-primary font-black uppercase tracking-widest mt-1">
                                  {item.modifiers.map(m => m.name).join(' • ')}
                                </p>
                              )}
                           </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {ticket.barItems.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black text-status-pending uppercase tracking-[0.3em]">BAR</span>
                        <div className="flex-1 h-px bg-white/5" />
                      </div>
                      {ticket.barItems.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-start relative">
                           <span className={cn("text-xl font-black", item.status === 'held' ? "text-white/5" : "text-white/20")}>{item.quantity}</span>
                           <div className={cn(item.status === 'held' && "opacity-30")}>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-white uppercase tracking-tight">{item.name}</p>
                                {item.status === 'held' && (
                                   <span className="text-[7px] bg-white/10 text-text-muted px-1 py-0.5 rounded font-black uppercase tracking-widest">HELD</span>
                                )}
                              </div>
                              {item.modifiers.length > 0 && (
                                <p className="text-[9px] text-status-pending font-black uppercase tracking-widest mt-1">
                                  {item.modifiers.map(m => m.name).join(' • ')}
                                </p>
                              )}
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="p-8 bg-white/5 border-t border-white/5 mt-auto flex flex-col gap-4">
                    {/* Course Controls */}
                    <div className="flex gap-2">
                       {ticket.hasHeldMains && (
                          <button 
                            onClick={() => fireCourse(ticket.orderId, 'mains')}
                            className="flex-1 py-3 bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/30 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                             FIRE MAINS
                          </button>
                       )}
                       {ticket.hasHeldDesserts && (
                          <button 
                             onClick={() => fireCourse(ticket.orderId, 'desserts')}
                             className="flex-1 py-3 bg-status-pending/10 hover:bg-status-pending/20 border border-status-pending/30 text-status-pending rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                          >
                             FIRE DESSERTS
                          </button>
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
