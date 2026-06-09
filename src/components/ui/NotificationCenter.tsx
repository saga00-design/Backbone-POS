import React from 'react';
import { usePOSStore } from '../../app/store';
import { Bell, X, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationCenter: React.FC = () => {
  const { activeAlerts, dismissAlert } = usePOSStore();

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-80">
      <AnimatePresence>
        {activeAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className={cn(
              "p-4 rounded-2xl shadow-2xl border backdrop-blur-xl flex flex-col gap-2",
              alert.type === 'READY' ? "bg-status-available/10 border-status-available text-status-available" :
              alert.type === 'PACING' ? "bg-brand-primary/10 border-brand-primary text-brand-primary" :
              "bg-status-pending/10 border-status-pending text-status-pending"
            )}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {alert.type === 'READY' && <CheckCircle className="w-5 h-5" />}
                {(alert.type === 'DELAY_DRINKS' || alert.type === 'DELAY_FOOD') && <AlertTriangle className="w-5 h-5" />}
                {alert.type === 'PACING' && <Clock className="w-5 h-5" />}
                <p className="text-[10px] font-black uppercase tracking-widest">{alert.type}</p>
              </div>
              <button 
                onClick={() => dismissAlert(alert.id)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div>
              <p className="text-sm font-black tracking-tight">{alert.message}</p>
              <p className="text-[10px] font-bold opacity-60 mt-1 uppercase">Table {alert.tableName}</p>
            </div>
            
            <div className="flex justify-end mt-1">
               <span className="text-[8px] font-mono opacity-40">
                  {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
