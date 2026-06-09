import React, { useState } from 'react';
import { Users, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface GuestCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: number) => void;
  tableName: string;
}

export const GuestCountModal: React.FC<GuestCountModalProps> = ({ isOpen, onClose, onConfirm, tableName }) => {
  const [count, setCount] = useState<string>('');

  const handleConfirm = () => {
    const num = parseInt(count);
    if (!isNaN(num) && num > 0) {
      onConfirm(num);
      onClose();
      setCount('');
    }
  };

  const addDigit = (digit: string) => {
    if (count.length < 2) {
      setCount(prev => prev + digit);
    }
  };

  const clear = () => setCount('');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-bg-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Table {tableName}</h3>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-widest">How many covers?</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>

            <div className="mb-8">
              <div className="h-24 bg-black/40 rounded-3xl border border-white/5 flex items-center justify-center relative overflow-hidden">
                <span className="text-5xl font-black text-white font-mono tracking-tighter">
                  {count || '0'}
                </span>
                {count && (
                  <button 
                    onClick={clear}
                    className="absolute right-4 text-[10px] font-black text-brand-primary uppercase tracking-widest hover:opacity-80"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((key) => {
                const isAction = key === 'C' || key === 'OK';
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === 'C') clear();
                      else if (key === 'OK') handleConfirm();
                      else addDigit(key);
                    }}
                    className={cn(
                      "h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all active:scale-95",
                      key === 'OK' 
                        ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                        : key === 'C'
                          ? "bg-white/5 text-text-muted hover:bg-white/10"
                          : "bg-white/5 text-white hover:bg-white/10"
                    )}
                  >
                    {key === 'OK' ? <Check className="w-6 h-6" /> : key}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[2, 4, 6, 8].map(preset => (
                <button
                  key={preset}
                  onClick={() => {
                    onConfirm(preset);
                    onClose();
                  }}
                  className="py-3 rounded-xl bg-white/5 border border-white/5 hover:border-brand-primary/30 transition-all text-sm font-black text-white"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
