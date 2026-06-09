import React from 'react';
import { usePOSStore } from '../../app/store';
import { StaffProfile, POSOrder, KDSTicket } from '../../types/pos';
import { 
  Trophy, TrendingUp, Target, Users, Zap, Clock, 
  BarChart3, Award, Star, ArrowRight, Timer, 
  Activity, Coffee, Wine, UtensilsCrossed, AlertCircle,
  Megaphone, Flame, ShieldCheck, UserCheck, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { PricingEngine } from '../../domain/PricingEngine';

export const PerformanceScreen: React.FC = () => {
  const { currentStaff, activeBriefing, posAlerts, getPersonalStats, getLeaderboards, isOnline } = usePOSStore();
  const [activeTab, setActiveTab] = React.useState<'me' | 'team' | 'briefing'>('me');

  if (!currentStaff) return null;

  const stats = getPersonalStats(currentStaff.id);
  const leaderboards = getLeaderboards();

  return (
    <div className="h-full flex flex-col bg-bg-dark p-8 overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between mt-10 mb-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-brand-primary" />
              Performance HUB
            </h1>
            <p className="text-text-muted text-xs font-black uppercase tracking-widest mt-1">Live Shift Analytics & Team Targets</p>
          </div>

          <div className={cn(
            "px-4 py-2 rounded-2xl border flex items-center gap-2 transition-all",
            isOnline ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>
        </div>

        <div className="flex bg-bg-card p-1.5 rounded-2xl border border-white/5 shadow-inner">
          <TabButton 
             active={activeTab === 'me'} 
             onClick={() => setActiveTab('me')} 
             label="My Stats" 
             icon={<UserCheck className="w-4 h-4" />} 
          />
          <TabButton 
             active={activeTab === 'team'} 
             onClick={() => setActiveTab('team')} 
             label="Team Leaderboard" 
             icon={<Award className="w-4 h-4" />} 
          />
          <TabButton 
             active={activeTab === 'briefing'} 
             onClick={() => setActiveTab('briefing')} 
             label="Today's Briefing" 
             icon={<Zap className="w-4 h-4" />} 
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           {/* Left Info / Alerts Column */}
           <div className="lg:col-span-1 space-y-6">
              {/* Profile Card */}
              <div className="bg-bg-card border border-white/5 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-3xl -mr-16 -mt-16 rounded-full" />
                 <div className="flex items-center gap-4 mb-6 relative">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shrink-0 shadow-lg">
                       <span className="text-white font-black text-2xl uppercase">{currentStaff.name[0]}</span>
                    </div>
                    <div>
                       <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">{currentStaff.name}</h3>
                       <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mt-1">{currentStaff.role}</p>
                    </div>
                 </div>
                 <div className="space-y-3 relative">
                    <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-text-muted">
                       <span>Efficiency Rating</span>
                       <span className="text-white bg-emerald-500/20 text-emerald-400 px-2 rounded-full border border-emerald-500/30">{stats.performanceScore}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                          className="h-full bg-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.performanceScore}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                       />
                    </div>
                 </div>
              </div>

              {/* Live Manager Alerts */}
              <div className="bg-bg-card border border-rose-500/10 rounded-3xl overflow-hidden flex flex-col shadow-sm">
                 <div className="p-5 bg-rose-500/5 border-b border-rose-500/10 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                       <Megaphone className="w-4 h-4" /> Live Alerts
                    </h3>
                    <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase">{posAlerts.filter(a => a.targetRole === 'all' || a.targetRole === currentStaff.role).length}</span>
                 </div>
                 <div className="p-4 space-y-3">
                    {posAlerts.filter(a => a.targetRole === 'all' || a.targetRole === currentStaff.role).map(alert => (
                       <motion.div 
                          key={alert.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                             "p-4 rounded-2xl border flex gap-3",
                             alert.priority === 'urgent' ? "bg-rose-500/10 border-rose-500/20" : "bg-bg-dark/50 border-white/5"
                          )}
                       >
                          <AlertCircle className={cn("w-5 h-5 shrink-0", alert.priority === 'urgent' ? "text-rose-500" : "text-amber-500")} />
                          <p className="text-[11px] font-bold text-white uppercase italic leading-relaxed tracking-tight">{alert.message}</p>
                       </motion.div>
                    ))}
                    {posAlerts.length === 0 && (
                       <p className="text-[10px] text-text-muted text-center py-4 font-black uppercase tracking-widest">No active alerts</p>
                    )}
                 </div>
              </div>
           </div>

           {/* Main Stats Area */}
           <div className="lg:col-span-3 space-y-8">
              <AnimatePresence mode="wait">
                {activeTab === 'me' && (
                   <motion.div 
                      key="me"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-8"
                   >
                       {/* Performance Cards */}
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard 
                               label="Sales Today" 
                               value={PricingEngine.formatCurrency(stats.totalSales)} 
                               icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} 
                               color="emerald"
                               trend={stats.trends.sales}
                            />
                            <StatCard 
                               label="Orders Served" 
                               value={stats.ordersServed} 
                               icon={<Users className="w-5 h-5 text-blue-400" />} 
                               color="blue"
                            />
                            <StatCard 
                               label="Avg Ticket" 
                               value={PricingEngine.formatCurrency(stats.avgTicket)} 
                               icon={<Zap className="w-5 h-5 text-amber-400" />} 
                               color="amber"
                               trend={stats.trends.avgTicket}
                            />
                            <StatCard 
                               label="Upsells Logged" 
                               value={stats.upsells} 
                               icon={<Star className="w-5 h-5 text-violet-400" />} 
                               color="violet"
                            />
                       </div>

                       {/* Target Progress */}
                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div className="bg-bg-card border border-white/5 rounded-3xl p-8 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Target className="w-32 h-32 text-brand-primary" />
                             </div>
                             <h3 className="text-xs font-black text-brand-primary uppercase tracking-widest mb-8">Personal Daily Targets</h3>
                             <div className="space-y-8 relative">
                                <ProgressSection 
                                   label="Sales Target" 
                                   current={stats.totalSales / 100} 
                                   target={activeBriefing?.targets.individual.salesTarget || 500} 
                                   prefix="£"
                                />
                                <ProgressSection 
                                   label="Dessert Upsells" 
                                   current={stats.upsells} 
                                   target={activeBriefing?.targets.individual.dessertTarget || 10} 
                                />
                             </div>
                          </div>

                          {/* Role Specific Metrics */}
                          <div className="bg-bg-card border border-white/5 rounded-3xl p-8 shadow-sm">
                             <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xs font-black text-text-muted uppercase tracking-widest">Department Focus</h3>
                                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                             </div>
                             
                             <div className="space-y-6">
                                {currentStaff.role === 'chef' ? (
                                   <MetricRow icon={<Clock className="w-5 h-5" />} label="Avg Prep Time" value="12:45 min" trend="Optimal" />
                                ) : currentStaff.role === 'bartender' ? (
                                   <MetricRow icon={<Wine className="w-5 h-5" />} label="Drink Prep Speed" value="3:20 min" trend="High Speed" />
                                ) : (
                                   <MetricRow icon={<Coffee className="w-5 h-5" />} label="Upsell Rate" value="18%" trend="Increasing" />
                                )}
                                <MetricRow icon={<Flame className="w-5 h-5" />} label="Service Load" value="Moderate" trend="Steady" />
                                <MetricRow icon={<Activity className="w-5 h-5" />} label="System Stability" value="100%" trend="Healthy" />
                             </div>
                          </div>
                       </div>
                   </motion.div>
                )}

                {activeTab === 'team' && (
                   <motion.div 
                      key="team"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                   >
                       <LeaderboardSection 
                          title="Floor Leaderboard" 
                          icon={<UtensilsCrossed className="w-5 h-5 text-brand-primary" />} 
                          data={leaderboards.floor} 
                          staffId={currentStaff.id}
                       />
                       <LeaderboardSection 
                          title="Bar Leaderboard" 
                          icon={<Wine className="w-5 h-5 text-violet-400" />} 
                          data={leaderboards.bar} 
                          staffId={currentStaff.id}
                       />
                       <LeaderboardSection 
                          title="Kitchen Load" 
                          icon={<Flame className="w-5 h-5 text-rose-400" />} 
                          data={leaderboards.kitchen} 
                          staffId={currentStaff.id}
                          isKitchen
                       />
                   </motion.div>
                )}

                {activeTab === 'briefing' && (
                   <motion.div 
                      key="briefing"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-bg-card border border-white/5 rounded-[2.5rem] p-10 shadow-xl"
                   >
                       {activeBriefing ? (
                          <div className="space-y-10">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div>
                                   <h3 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-4">Core Focus</h3>
                                   <p className="text-3xl font-black text-white uppercase italic tracking-tighter leading-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                                      {activeBriefing.focusOfDay}
                                   </p>
                                </div>
                                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                                   <h3 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-4">Manager Alert</h3>
                                   <p className="text-base text-text-secondary leading-relaxed italic">{activeBriefing.message}</p>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <ListSection title="Today's Specials" items={activeBriefing.specials} icon={<Star className="text-amber-400" />} />
                                <ListSection title="86'd Items" items={activeBriefing.items86} icon={<XCircle className="text-rose-500" />} isStrikethrough />
                                <ListSection title="Challenges" items={activeBriefing.challenges} icon={<Trophy className="text-emerald-400" />} />
                             </div>
                          </div>
                       ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-center">
                             <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                                <Megaphone className="w-10 h-10 text-white/20" />
                             </div>
                             <h3 className="text-xl font-black text-white uppercase italic tracking-widest">No Active Briefing</h3>
                             <p className="text-text-muted text-sm font-bold mt-2 uppercase tracking-tight">Briefings are published daily by management</p>
                          </div>
                       )}
                   </motion.div>
                )}
              </AnimatePresence>
           </div>
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon }: any) => (
   <button
     onClick={onClick}
     className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
        active ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-muted hover:text-white"
     )}
   >
      {React.cloneElement(icon, { className: active ? "text-white" : "text-text-muted" })}
      {label}
   </button>
);

const StatCard = ({ label, value, icon, color, trend }: any) => (
   <div className="bg-bg-card border border-white/5 rounded-3xl p-6 shadow-sm group hover:border-brand-primary/30 transition-all flex flex-col justify-between h-full">
      <div>
         <div className="flex items-center gap-3 mb-4">
            <div className={cn("p-2 rounded-xl border border-white/5 group-hover:scale-110 transition-transform bg-white/5")}>
               {icon}
            </div>
            <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">{label}</span>
         </div>
         <p className="text-2xl font-black text-white tracking-tighter uppercase">{value}</p>
      </div>
      
      {trend !== undefined && (
         <div className="mt-4 flex items-center gap-2">
            <div className={cn(
               "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1",
               trend >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
            )}>
               {trend >= 0 ? '+' : ''}{Math.round(trend)}%
               {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
            </div>
            <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">vs Yesterday</span>
         </div>
      )}
   </div>
);

const ProgressSection = ({ label, current, target, prefix = '' }: any) => {
   const percent = Math.min(100, Math.round((current / target) * 100));
   return (
      <div className="space-y-3">
         <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-white uppercase tracking-widest italic">{label}</span>
            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
               {prefix}{Math.round(current)} / {prefix}{target}
            </span>
         </div>
         <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div 
               className="h-full bg-brand-primary"
               initial={{ width: 0 }}
               animate={{ width: `${percent}%` }}
               transition={{ duration: 1.5, ease: "circOut" }}
            />
         </div>
      </div>
   );
};

const MetricRow = ({ icon, label, value, trend }: any) => (
   <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5">
      <div className="flex items-center gap-4">
         <div className="text-brand-primary opacity-50">{icon}</div>
         <div>
            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm font-black text-white uppercase tracking-tight">{value}</p>
         </div>
      </div>
      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{trend}</span>
   </div>
);

const LeaderboardSection = ({ title, icon, data, staffId, isKitchen }: any) => (
   <div className="bg-bg-card border border-white/5 rounded-[2rem] overflow-hidden flex flex-col shadow-sm">
      <div className="p-6 bg-white/[0.02] border-b border-white/5 flex items-center gap-3">
         <div className="p-2 bg-white/5 rounded-xl">{icon}</div>
         <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
      </div>
      <div className="flex-1 p-4 space-y-2">
         {data.map((s: any, i: number) => (
            <div 
               key={i} 
               className={cn(
                  "flex items-center justify-between p-4 rounded-3xl border transition-all",
                  s.id === staffId ? "bg-brand-primary/10 border-brand-primary/30" : "bg-bg-dark/30 border-white/3"
               )}
            >
               <div className="flex items-center gap-4">
                  <span className={cn(
                     "w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black",
                     i === 0 ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : 
                     i === 1 ? "bg-slate-300 text-black" :
                     i === 2 ? "bg-amber-700 text-white" : "bg-white/5 text-text-muted"
                  )}>
                     {i + 1}
                  </span>
                  <div>
                     <p className="text-xs font-black text-white uppercase tracking-tight">{s.name}</p>
                     <p className="text-[9px] font-black text-text-muted uppercase tracking-widest opacity-50"># {i + 1} in shift</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-xs font-black text-white font-mono">
                     {isKitchen ? `${s.avgTime}m` : PricingEngine.formatCurrency(s.sales)}
                  </p>
                  <p className="text-[8px] font-black text-brand-primary uppercase tracking-widest">{isKitchen ? 'Prep Time' : `${s.orders} Orders`}</p>
               </div>
            </div>
         ))}
         {data.length === 0 && (
            <div className="py-10 text-center opacity-30">
               <Trophy className="w-8 h-8 text-white mx-auto mb-3" />
               <p className="text-[10px] font-black uppercase tracking-widest">Waiting for data</p>
            </div>
         )}
      </div>
   </div>
);

const ListSection = ({ title, items, icon, isStrikethrough }: any) => (
   <div className="space-y-4">
      <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
         {icon} {title}
      </h3>
      <div className="space-y-2">
         {items.map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                <ChevronRight className="w-3 h-3 text-brand-primary" />
                <span className={cn(
                  "text-xs font-bold uppercase tracking-tight text-white/90 italic",
                  isStrikethrough && "line-through opacity-50"
                )}>
                   {item}
                </span>
            </div>
         ))}
      </div>
   </div>
);

const XCircle = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
);
