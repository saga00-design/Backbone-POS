import React from 'react';
import { usePOSStore } from '../../app/store';
import { 
  Settings, Users, LayoutGrid, ClipboardList, Database, 
  RefreshCcw, ShieldCheck, Info, ChevronRight, HardDrive,
  Cloud, Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { StaffManagement } from './StaffManagement';
import { ReceiptTemplateEditor } from './ReceiptTemplateEditor';

export const SettingsScreen: React.FC = () => {
  const { currentStaff, syncFromHub } = usePOSStore();
  const [activeTab, setActiveTab] = React.useState<'staff' | 'floor' | 'system' | 'receipt'>('staff');
  const [isSyncing, setIsSyncing] = React.useState(false);

  if (!currentStaff || currentStaff.role !== 'admin') {
     return (
        <div className="h-full flex items-center justify-center p-8 bg-bg-dark">
           <div className="text-center space-y-6 max-w-md">
              <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto text-rose-500 border border-rose-500/20">
                 <ShieldCheck className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase italic tracking-widest">Restricted Area</h2>
              <p className="text-text-muted text-sm font-bold uppercase tracking-tight leading-relaxed">
                 Settings and HUB configuration are restricted to Admin level staff only. Please consult your manager.
              </p>
           </div>
        </div>
     );
  }

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncFromHub();
    } catch (err) {
      console.error('Hub sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-dark p-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3 italic">
            <Settings className="w-8 h-8 text-brand-primary" />
            Control Center
          </h1>
          <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-1 ml-1">Location Management & HUB Synchronization</p>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={handleSync}
             disabled={isSyncing}
             className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
           >
             <RefreshCcw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
             {isSyncing ? 'Syncing...' : 'Sync All From HUB'}
           </button>
           <div className="h-8 w-px bg-white/10" />
           <div className="bg-bg-card p-1.5 rounded-2xl border border-white/5 flex gap-1">
              <TabButton active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} label="Staff" icon={<Users className="w-4 h-4" />} />
              <TabButton active={activeTab === 'floor'} onClick={() => setActiveTab('floor')} label="Floor" icon={<LayoutGrid className="w-4 h-4" />} />
              <TabButton active={activeTab === 'receipt'} onClick={() => setActiveTab('receipt')} label="Receipt Designer" icon={<Receipt className="w-4 h-4" />} />
               <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} label="System" icon={<Database className="w-4 h-4" />} />
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
         <AnimatePresence mode="wait">
            {activeTab === 'staff' && (
              <motion.div
                key="staff"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <StaffManagement />
              </motion.div>
            )}

            {activeTab === 'floor' && (
               <motion.div
                 key="floor"
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="bg-bg-card border border-white/5 rounded-[2.5rem] p-12 text-center"
               >
                  <div className="w-20 h-20 bg-brand-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 text-brand-primary border border-brand-primary/20">
                     <LayoutGrid className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase italic tracking-widest mb-4">Floor Plan Editor</h2>
                  <p className="text-text-muted text-sm font-bold uppercase tracking-tight max-w-md mx-auto mb-8 leading-relaxed">
                     The floor plan editor is integrated into the Floor screen. Enable 'Design Mode' there to rearrange tables, add zones, and resize elements.
                  </p>
                  <button className="bg-brand-primary text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-primary/20 transition-all hover:bg-brand-primary-light">
                     Go to Floor Screen
                  </button>
               </motion.div>
            )}

            {activeTab === 'receipt' && (
              <motion.div
                key="receipt"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <ReceiptTemplateEditor />
              </motion.div>
            )}

            {activeTab === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                 <SystemCard 
                   title="HUB Connector" 
                   status="Active" 
                   icon={<Cloud className="w-5 h-5" />}
                   description="Synchronizing menu, staff, floor plan, and shift briefings with Backbone HUB."
                 />
                 <SystemCard 
                   title="Local Database" 
                   status="Optimal" 
                   icon={<Database className="w-5 h-5" />}
                   description="Firestore indexedDb persistence is enabled for offline operations."
                 />
                 <SystemCard 
                   title="Asset Cache" 
                   status="Healthy" 
                   icon={<HardDrive className="w-5 h-5" />}
                   description="Menu images and icons are cached for high-speed performance."
                 />
              </motion.div>
            )}
         </AnimatePresence>
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
    {icon}
    {label}
  </button>
);

const SystemCard = ({ title, status, icon, description }: any) => (
  <div className="bg-bg-card border border-white/5 rounded-3xl p-8 shadow-sm group hover:border-brand-primary/30 transition-all">
     <div className="flex items-center justify-between mb-8">
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
           {icon}
        </div>
        <span className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
           {status}
        </span>
     </div>
     <h3 className="text-white font-black text-lg uppercase tracking-tight mb-2 tracking-widest">{title}</h3>
     <p className="text-text-muted text-xs font-bold uppercase tracking-tight leading-relaxed">{description}</p>
  </div>
);
