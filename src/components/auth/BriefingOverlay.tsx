import React from 'react';
import { usePOSStore } from '../../app/store';
import { ShiftBriefing } from '../../types/pos';
import { BookOpen, AlertCircle, TrendingUp, Info, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { QuizChallengeModal } from './QuizChallengeModal';

export const BriefingOverlay: React.FC = () => {
  const { currentStaff, activeBriefing, isBriefingAcknowledged, acknowledgeBriefing } = usePOSStore();
  const [isAcknowledging, setIsAcknowledging] = React.useState(false);
  const [showQuiz, setShowQuiz] = React.useState(false);

  if (!currentStaff || !activeBriefing) return null;
  
  const hasAcknowledged = isBriefingAcknowledged(activeBriefing.id, currentStaff.id);
  if (hasAcknowledged && !showQuiz) return null;

  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    try {
      await acknowledgeBriefing(activeBriefing.id);
      setShowQuiz(true);
    } catch (error) {
      console.error('Failed to acknowledge briefing:', error);
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (showQuiz) {
    return <QuizChallengeModal onComplete={() => setShowQuiz(false)} />;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-bg-card border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary/20 rounded-2xl flex items-center justify-center text-brand-primary border border-brand-primary/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Shift Briefing</h2>
              <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-0.5">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1">Authenticated As</div>
             <div className="flex items-center gap-2">
                <span className="text-white font-black text-sm uppercase">{currentStaff.name}</span>
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-text-muted uppercase tracking-widest">{currentStaff.role}</span>
             </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Main Focus & Message */}
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-white/5 rounded-3xl p-6 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Focus of the Day</h3>
                </div>
                <p className="text-xl font-black text-white leading-tight uppercase italic text-emerald-400">"{activeBriefing.focusOfDay}"</p>
              </section>

              <section className="bg-white/3 rounded-3xl p-6 border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <Info className="w-12 h-12 text-brand-primary" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-brand-primary" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Manager's Message</h3>
                  </div>
                  {activeBriefing.createdAt && (
                    <span className="text-[9px] font-black text-brand-primary/60 uppercase tracking-widest">
                      Updated {new Date(activeBriefing.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <p className="text-text-secondary text-lg leading-relaxed font-medium selection:bg-brand-primary/30">
                  {activeBriefing.message}
                </p>
              </section>

              <div className="grid grid-cols-2 gap-4">
                 <section className="bg-amber-500/5 rounded-3xl p-6 border border-amber-500/10">
                    <div className="flex items-center gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Specials</h3>
                    </div>
                    <ul className="space-y-2">
                      {(activeBriefing.specials || []).map((s, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-white/80 text-sm font-bold uppercase italic">
                           <ChevronRight className="w-3 h-3 text-amber-500" />
                           {s}
                        </li>
                      ))}
                    </ul>
                 </section>

                 <section className="bg-rose-500/5 rounded-3xl p-6 border border-rose-500/10">
                    <div className="flex items-center gap-3 mb-4">
                      <XCircle className="w-5 h-5 text-rose-500" />
                      <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">86'd Items</h3>
                    </div>
                    <ul className="space-y-2">
                      {(activeBriefing.items86 || []).map((s, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-white/80 text-sm font-black uppercase tracking-tight line-through opacity-50">
                           {s}
                        </li>
                      ))}
                    </ul>
                 </section>
              </div>
            </div>

            {/* Right: Targets & Challenges */}
            <div className="space-y-6">
               <section className="bg-blue-500/5 rounded-3xl p-6 border border-blue-500/10">
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Shift Targets</h3>
                  <div className="space-y-6">
                    {/* Floor Targets */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Floor</span>
                      </div>
                      <TargetCard label="Sales Target" value={`£${activeBriefing.targets?.floor?.totalSalesTarget || (activeBriefing as any).totalSalesTarget || 0}`} />
                      <TargetCard label="Dessert Target" value={`${activeBriefing.targets?.floor?.dessertTarget || (activeBriefing as any).floorDessertTarget || 0} Units`} />
                    </div>

                    {/* Bar Targets */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-3 bg-blue-500 rounded-full" />
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Bar</span>
                      </div>
                      <TargetCard label="Cocktail Target" value={`${activeBriefing.targets?.bar?.cocktailTarget || (activeBriefing as any).barCocktailTarget || 0} Units`} />
                      <TargetCard label="Premium Drinks" value={`${activeBriefing.targets?.bar?.premiumDrinkTarget || 0} Units`} />
                    </div>

                    {/* Kitchen Targets */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1 h-3 bg-rose-500 rounded-full" />
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Kitchen</span>
                      </div>
                      <TargetCard label="Prep Time Target" value={`${activeBriefing.targets?.kitchen?.avgPrepTimeTarget || 0}m Avg`} />
                    </div>
                  </div>
               </section>

               <section className="bg-emerald-500/5 rounded-3xl p-6 border border-emerald-500/10">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4">Daily Challenges</h3>
                  <div className="space-y-3">
                     {(activeBriefing.challenges || []).map((c, i) => (
                        <div key={i} className="flex gap-3 items-start">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                           <p className="text-xs font-bold text-white uppercase italic tracking-tight">{c}</p>
                        </div>
                     ))}
                  </div>
               </section>

               <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                  <h3 className="text-xs font-black text-text-muted uppercase tracking-widest mb-3">Manager Alerts</h3>
                  <div className="space-y-2">
                     {(activeBriefing.managerAlerts || []).map((a, i) => (
                        <p key={i} className="text-xs font-bold text-amber-200/70 border-l border-amber-500/50 pl-2">
                           {a}
                        </p>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
           <p className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Required Acknowledgement
           </p>
           <button
             disabled={isAcknowledging}
             onClick={handleAcknowledge}
             className="px-10 py-5 bg-brand-primary hover:bg-brand-primary-light disabled:opacity-50 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-3"
           >
             {isAcknowledging ? 'Processing...' : 'I have read today\'s briefing'}
             <ChevronRight className="w-5 h-5" />
           </button>
        </div>
      </motion.div>
    </div>
  );
};

const TargetCard = ({ label, value }: { label: string, value: string }) => (
   <div className="flex justify-between items-center bg-black/20 p-3 px-4 rounded-xl border border-white/5">
      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black text-white">{value}</span>
   </div>
);
