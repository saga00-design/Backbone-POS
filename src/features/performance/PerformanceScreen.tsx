import React from 'react';
import { usePOSStore } from '../../app/store';
import {
  Trophy, TrendingUp, Target, Users, Zap,
  BarChart3, Award, Star,
  Wine, UtensilsCrossed, AlertCircle,
  Megaphone, Flame, ShieldCheck, UserCheck,
  BookOpen, Brain, Medal, XCircle as XCircleIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { PricingEngine } from '../../domain/PricingEngine';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { POS_CONFIG } from '../../app/config';

export const PerformanceScreen: React.FC = () => {
  const { currentStaff, activeBriefing, posAlerts, getPersonalStats, getLeaderboards, isOnline, quizSubmissions } = usePOSStore();
  const [activeTab, setActiveTab] = React.useState<'me' | 'team' | 'profile' | 'briefing'>('me');
  const [certCount, setCertCount] = React.useState<{ total: number; passed: number } | null>(null);

  if (!currentStaff) return null;

  const stats = getPersonalStats(currentStaff.id);
  const leaderboards = getLeaderboards();

  React.useEffect(() => {
    const loadCerts = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'staffCertifications'),
          where('staffId', '==', currentStaff.id),
          where('locationId', '==', POS_CONFIG.LOCATION_ID)
        ));
        const certs = snap.docs.map(d => d.data());
        setCertCount({ total: certs.length, passed: certs.filter(c => c.passed).length });
      } catch {
        setCertCount({ total: 0, passed: 0 });
      }
    };
    loadCerts();
  }, [currentStaff.id]);

  const myQuizzes = React.useMemo(() =>
    (quizSubmissions as any[])
      .filter(s => s.staffId === currentStaff.id)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 10),
    [quizSubmissions, currentStaff.id]
  );

  const quizAvgScore = React.useMemo(() => {
    if (myQuizzes.length === 0) return null;
    return Math.round(myQuizzes.reduce((acc, q) => acc + (q.score / q.totalQuestions) * 100, 0) / myQuizzes.length);
  }, [myQuizzes]);

  const allLeaders = [...leaderboards.floor, ...leaderboards.bar];
  const myPosition = allLeaders.findIndex((s: any) => s.id === currentStaff.id);
  const myRank = myPosition >= 0 ? myPosition + 1 : null;
  const rankLabel = myRank === 1 ? '1st' : myRank === 2 ? '2nd' : myRank === 3 ? '3rd' : myRank ? `${myRank}th` : null;

  return (
    <div className="h-full flex flex-col bg-bg-dark p-6 lg:p-8 overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-8 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-brand-primary" />
              Performance HUB
            </h1>
            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Live Shift Analytics & Team Targets</p>
          </div>
          <div className={cn("px-3 py-1.5 rounded-xl border flex items-center gap-2",
            isOnline ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <div className="flex bg-bg-card p-1.5 rounded-2xl border border-white/5 gap-1 self-start lg:self-auto">
          <TabButton active={activeTab === 'me'} onClick={() => setActiveTab('me')} label="My Stats" icon={<UserCheck className="w-4 h-4" />} />
          <TabButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} label="Leaderboard" icon={<Award className="w-4 h-4" />} />
          <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="My Profile" icon={<BookOpen className="w-4 h-4" />} />
          <TabButton active={activeTab === 'briefing'} onClick={() => setActiveTab('briefing')} label="Briefing" icon={<Zap className="w-4 h-4" />} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-bg-card border border-white/5 rounded-3xl p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-3xl -mr-16 -mt-16 rounded-full" />
              <div className="flex items-center gap-3 mb-5 relative">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shrink-0">
                  <span className="text-white font-black text-xl uppercase">{currentStaff.name[0]}</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight leading-none">{currentStaff.name}</h3>
                  <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mt-1">{currentStaff.role}</p>
                  {myRank && <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-0.5">{rankLabel} of {allLeaders.length} today</p>}
                </div>
              </div>
              <div className="space-y-2 relative">
                <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-text-muted">
                  <span>Efficiency</span><span className="text-emerald-400">{stats.performanceScore}%</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${stats.performanceScore}%` }} transition={{ duration: 1 }} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-white">{certCount?.passed ?? '—'}</p>
                  <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mt-0.5">Certs</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-white">{quizAvgScore != null ? `${quizAvgScore}%` : '—'}</p>
                  <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mt-0.5">Quiz Avg</p>
                </div>
              </div>
            </div>

            <div className="bg-bg-card border border-rose-500/10 rounded-3xl overflow-hidden">
              <div className="p-4 bg-rose-500/5 border-b border-rose-500/10 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><Megaphone className="w-4 h-4" /> Alerts</h3>
                <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded uppercase">
                  {posAlerts.filter(a => a.targetRole === 'all' || a.targetRole === currentStaff.role).length}
                </span>
              </div>
              <div className="p-3 space-y-2">
                {posAlerts.filter(a => a.targetRole === 'all' || a.targetRole === currentStaff.role).map(alert => (
                  <div key={alert.id} className={cn("p-3 rounded-xl border flex gap-2", alert.priority === 'urgent' ? "bg-rose-500/10 border-rose-500/20" : "bg-bg-dark/50 border-white/5")}>
                    <AlertCircle className={cn("w-4 h-4 shrink-0 mt-0.5", alert.priority === 'urgent' ? "text-rose-500" : "text-amber-500")} />
                    <p className="text-[10px] font-bold text-white uppercase italic leading-relaxed">{alert.message}</p>
                  </div>
                ))}
                {posAlerts.length === 0 && <p className="text-[10px] text-text-muted text-center py-4 font-black uppercase tracking-widest">No active alerts</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {activeTab === 'me' && (
                <motion.div key="me" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Sales Today" value={PricingEngine.formatCurrency(stats.totalSales)} icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} trend={stats.trends.sales} />
                    <StatCard label="Orders" value={stats.ordersServed} icon={<Users className="w-5 h-5 text-blue-400" />} />
                    <StatCard label="Avg Ticket" value={PricingEngine.formatCurrency(stats.avgTicket)} icon={<Zap className="w-5 h-5 text-amber-400" />} trend={stats.trends.avgTicket} />
                    <StatCard label="Upsells" value={stats.upsells} icon={<Star className="w-5 h-5 text-violet-400" />} />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-bg-card border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5"><Target className="w-28 h-28 text-brand-primary" /></div>
                      <h3 className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-6">Daily Targets</h3>
                      <div className="space-y-6 relative">
                        <ProgressSection label="Sales Target" current={stats.totalSales / 100} target={Number(activeBriefing?.targets?.individual?.salesTarget) || 500} prefix="£" />
                        <ProgressSection label="Dessert Upsells" current={stats.upsells} target={Number(activeBriefing?.targets?.individual?.dessertTarget) || 10} />
                      </div>
                    </div>
                    <div className="bg-bg-card border border-white/5 rounded-3xl p-6">
                      <div className="flex items-center justify-between mb-5">
                        <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest">Today's Quiz</h3>
                        <Brain className="w-5 h-5 text-brand-primary" />
                      </div>
                      {myQuizzes.length > 0 ? (() => {
                        const latest = myQuizzes[0];
                        const pct = Math.round((latest.score / latest.totalQuestions) * 100);
                        return (
                          <div className="space-y-4">
                            <div className="flex items-end gap-3">
                              <p className="text-5xl font-black text-white">{latest.score}</p>
                              <p className="text-2xl font-black text-text-muted mb-1">/{latest.totalQuestions}</p>
                              <p className={cn("text-2xl font-black mb-1", pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-rose-400")}>{pct}%</p>
                            </div>
                            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                              <motion.div className={cn("h-full", pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.5, ease: "circOut" }} />
                            </div>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                              {pct >= 80 ? '🔥 Excellent — keep it up!' : pct >= 60 ? '👍 Good — review training guides.' : '📖 Check training section to improve.'}
                            </p>
                          </div>
                        );
                      })() : (
                        <div className="text-center py-8">
                          <Brain className="w-10 h-10 text-white/10 mx-auto mb-3" />
                          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No quiz taken this shift</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {activeBriefing?.challenges && activeBriefing.challenges.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6">
                      <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Trophy className="w-4 h-4" /> Today's Challenges</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeBriefing.challenges.map((c: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <Medal className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-xs font-bold text-white uppercase italic tracking-tight">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'team' && (
                <motion.div key="team" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  {myRank && (
                    <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-2xl p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg",
                          myRank === 1 ? "bg-amber-500 text-black" : myRank === 2 ? "bg-slate-300 text-black" : myRank === 3 ? "bg-amber-700 text-white" : "bg-white/10 text-white"
                        )}>{myRank}</div>
                        <div>
                          <p className="text-sm font-black text-white uppercase">You're in {rankLabel} place</p>
                          <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest">out of {allLeaders.length} staff today</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-white">{PricingEngine.formatCurrency(stats.totalSales)}</p>
                        <p className="text-[9px] text-text-muted uppercase tracking-widest">your sales</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <LeaderboardSection title="Floor" icon={<UtensilsCrossed className="w-5 h-5 text-brand-primary" />} data={leaderboards.floor} staffId={currentStaff.id} />
                    <LeaderboardSection title="Bar" icon={<Wine className="w-5 h-5 text-violet-400" />} data={leaderboards.bar} staffId={currentStaff.id} />
                    <LeaderboardSection title="Kitchen" icon={<Flame className="w-5 h-5 text-rose-400" />} data={leaderboards.kitchen} staffId={currentStaff.id} isKitchen />
                  </div>
                </motion.div>
              )}

              {activeTab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div className="bg-bg-card border border-white/5 rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Training Certifications</h3>
                      {certCount && <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full uppercase">{certCount.passed} passed</span>}
                    </div>
                    {certCount ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/5 rounded-2xl p-5 text-center">
                          <p className="text-3xl font-black text-white">{certCount.total}</p>
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">Tests Taken</p>
                        </div>
                        <div className="bg-emerald-500/10 rounded-2xl p-5 text-center border border-emerald-500/20">
                          <p className="text-3xl font-black text-emerald-400">{certCount.passed}</p>
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">Passed</p>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-5 text-center">
                          <p className="text-3xl font-black text-white">{certCount.total > 0 ? `${Math.round((certCount.passed / certCount.total) * 100)}%` : '—'}</p>
                          <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mt-1">Pass Rate</p>
                        </div>
                      </div>
                    ) : <p className="text-[10px] text-text-muted py-4 uppercase">Loading...</p>}
                  </div>

                  <div className="bg-bg-card border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2"><Brain className="w-4 h-4 text-brand-primary" /> Shift Quiz History</h3>
                      {quizAvgScore != null && (
                        <span className={cn("text-[9px] font-black px-3 py-1 rounded-full uppercase border",
                          quizAvgScore >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : quizAvgScore >= 60 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        )}>Avg {quizAvgScore}%</span>
                      )}
                    </div>
                    <div className="divide-y divide-white/5">
                      {myQuizzes.length === 0 ? (
                        <div className="py-12 text-center">
                          <Brain className="w-10 h-10 text-white/10 mx-auto mb-3" />
                          <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No quiz history yet</p>
                        </div>
                      ) : myQuizzes.map((q: any, i: number) => {
                        const pct = Math.round((q.score / q.totalQuestions) * 100);
                        return (
                          <div key={i} className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-4">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                                pct >= 80 ? "bg-emerald-500/20 text-emerald-400" : pct >= 60 ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"
                              )}>{pct}%</div>
                              <div>
                                <p className="text-xs font-black text-white uppercase tracking-tight">Shift Briefing Quiz</p>
                                <p className="text-[9px] text-text-muted uppercase tracking-widest mt-0.5">
                                  {new Date(q.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {new Date(q.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-white">{q.score}/{q.totalQuestions}</p>
                              <p className={cn("text-[9px] font-black uppercase tracking-widest", pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-rose-400")}>
                                {pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : 'Needs work'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'briefing' && (
                <motion.div key="briefing" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  {activeBriefing ? (
                    <div className="space-y-5">
                      <div className="bg-bg-card border border-white/5 rounded-3xl p-7">
                        <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-3">Manager's Message</p>
                        <p className="text-base text-white leading-relaxed">{activeBriefing.message}</p>
                      </div>
                      {activeBriefing.focusOfDay && (
                        <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-3xl p-7">
                          <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-3">Focus of the Day</p>
                          <p className="text-2xl font-black text-white uppercase italic tracking-tight">{activeBriefing.focusOfDay}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <BriefingListCard title="Today's Specials" items={activeBriefing.specials || []} icon={<Star className="w-4 h-4 text-amber-400" />} color="amber" />
                        <BriefingListCard title="86'd Items" items={activeBriefing.items86 || []} icon={<XCircleIcon className="w-4 h-4 text-rose-400" />} color="rose" strikethrough />
                        <BriefingListCard title="Challenges" items={activeBriefing.challenges || []} icon={<Trophy className="w-4 h-4 text-emerald-400" />} color="emerald" />
                      </div>
                      {activeBriefing.managerAlerts && activeBriefing.managerAlerts.length > 0 && (
                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-6 space-y-3">
                          <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Alerts</p>
                          {activeBriefing.managerAlerts.map((a: string, i: number) => <p key={i} className="text-sm text-white font-bold">! {a}</p>)}
                        </div>
                      )}
                      <p className="text-[9px] text-text-muted text-center uppercase tracking-widest">
                        {activeBriefing.date ? `${activeBriefing.date}` : 'Today'} · Active briefing
                      </p>
                    </div>
                  ) : (
                    <div className="bg-bg-card border border-white/5 rounded-3xl flex flex-col items-center justify-center py-24 text-center">
                      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6"><Megaphone className="w-10 h-10 text-white/20" /></div>
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
  <button onClick={onClick} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
    active ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-muted hover:text-white"
  )}>
    {React.cloneElement(icon, { className: active ? "text-white" : "text-text-muted" })}
    {label}
  </button>
);

const StatCard = ({ label, value, icon, trend }: any) => (
  <div className="bg-bg-card border border-white/5 rounded-3xl p-5 hover:border-brand-primary/30 transition-all">
    <div className="flex items-center gap-3 mb-3">
      <div className="p-2 rounded-xl bg-white/5">{icon}</div>
      <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">{label}</span>
    </div>
    <p className="text-2xl font-black text-white tracking-tighter uppercase">{value}</p>
    {trend !== undefined && (
      <div className="mt-3 flex items-center gap-2">
        <div className={cn("px-2 py-0.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1",
          trend >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
        )}>
          {trend >= 0 ? '+' : ''}{Math.round(trend)}%
          <TrendingUp className={cn("w-3 h-3", trend < 0 && "rotate-180")} />
        </div>
        <span className="text-[8px] font-black text-text-muted uppercase">vs Yesterday</span>
      </div>
    )}
  </div>
);

const ProgressSection = ({ label, current, target, prefix = '' }: any) => {
  const percent = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-white uppercase italic">{label}</span>
        <span className="text-[10px] font-black text-text-muted uppercase">{prefix}{Math.round(current)} / {prefix}{target}</span>
      </div>
      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <motion.div className="h-full bg-brand-primary" initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1.5, ease: "circOut" }} />
      </div>
    </div>
  );
};

const LeaderboardSection = ({ title, icon, data, staffId, isKitchen }: any) => (
  <div className="bg-bg-card border border-white/5 rounded-[2rem] overflow-hidden">
    <div className="p-5 bg-white/[0.02] border-b border-white/5 flex items-center gap-3">
      <div className="p-2 bg-white/5 rounded-xl">{icon}</div>
      <h3 className="text-xs font-black text-white uppercase tracking-widest">{title}</h3>
    </div>
    <div className="p-4 space-y-2">
      {data.map((s: any, i: number) => (
        <div key={i} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all",
          s.id === staffId ? "bg-brand-primary/10 border-brand-primary/30" : "bg-bg-dark/30 border-white/5"
        )}>
          <div className="flex items-center gap-3">
            <span className={cn("w-6 h-6 flex items-center justify-center rounded-lg text-[10px] font-black",
              i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-white/5 text-text-muted"
            )}>{i + 1}</span>
            <div>
              <p className="text-xs font-black text-white uppercase tracking-tight">{s.name}</p>
              {s.id === staffId && <p className="text-[8px] font-black text-brand-primary uppercase">← You</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-black text-white">{isKitchen ? `${s.avgTime}m` : PricingEngine.formatCurrency(s.sales)}</p>
            <p className="text-[8px] font-black text-brand-primary uppercase">{isKitchen ? 'Prep Time' : `${s.orders} Orders`}</p>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <div className="py-8 text-center opacity-30">
          <Trophy className="w-8 h-8 text-white mx-auto mb-3" />
          <p className="text-[10px] font-black uppercase">Waiting for data</p>
        </div>
      )}
    </div>
  </div>
);

const BriefingListCard = ({ title, items, icon, color, strikethrough }: any) => (
  <div className={cn("bg-bg-card border rounded-3xl p-5 space-y-3",
    color === 'amber' ? "border-amber-500/20" : color === 'rose' ? "border-rose-500/20" : "border-emerald-500/20"
  )}>
    <h3 className={cn("text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2",
      color === 'amber' ? "text-amber-400" : color === 'rose' ? "text-rose-400" : "text-emerald-400"
    )}>{icon} {title}</h3>
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-[10px] text-text-muted uppercase">None</p>
      ) : items.map((item: string, i: number) => (
        <div key={i} className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
          <span className="text-brand-primary text-xs shrink-0">›</span>
          <span className={cn("text-xs font-bold uppercase tracking-tight text-white/90 italic", strikethrough && "line-through opacity-50")}>{item}</span>
        </div>
      ))}
    </div>
  </div>
);
