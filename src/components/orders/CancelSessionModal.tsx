import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface CancelSessionModalProps {
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const CancelSessionModal: React.FC<CancelSessionModalProps> = ({ onClose, onConfirm }) => {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-bg-card border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
        >
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-status-pending/20 rounded-3xl flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-status-pending" />
            </div>
            
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">No Items Remaining</h3>
            <p className="text-text-secondary text-sm leading-relaxed mb-8">
              This table has no active items. 
              Would you like to close the empty session?
            </p>
            
            <div className="grid grid-cols-1 w-full gap-3">
              <button
                onClick={() => onConfirm('empty_session')}
                className="h-16 bg-status-pending rounded-2xl flex items-center justify-center text-white font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Cancel Session
              </button>
              
              <button
                onClick={onClose}
                className="h-16 bg-white/5 rounded-2xl flex items-center justify-center text-text-secondary font-black uppercase tracking-widest hover:bg-white/10 active:scale-[0.98] transition-all"
              >
                Keep Table Open
              </button>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-text-muted hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
