import React, { useState } from 'react';
import { POSOrder } from '../../types/pos';
import { usePOSStore } from '../../app/store';
import { PricingEngine } from '../../domain/PricingEngine';
import { X, Percent, Hash, Gift } from 'lucide-react';
import { cn } from '../../lib/utils';

interface POSDiscountModalProps {
  order: POSOrder | null;
  onClose: () => void;
}

export const POSDiscountModal: React.FC<POSDiscountModalProps> = ({ order, onClose }) => {
  const { applyOrderDiscount } = usePOSStore();
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(order?.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(order?.discountValue || 0);

  const handleApply = () => {
    applyOrderDiscount(discountType, discountValue);
    onClose();
  };

  const handleClear = () => {
    applyOrderDiscount(null, 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-dark/95 backdrop-blur-md">
      <div className="bg-bg-card border border-white/10 rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
              <Percent className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Order Discount</h3>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">Apply to entire bill</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all">
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setDiscountType('percentage')}
              className={cn(
                "p-8 rounded-[2rem] border transition-all flex flex-col items-center gap-4 group",
                discountType === 'percentage' ? "bg-brand-primary/20 border-brand-primary text-white" : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
              )}
            >
              <Percent className={cn("w-8 h-8", discountType === 'percentage' ? "text-brand-primary" : "group-hover:text-white")} />
              <span className="font-black uppercase text-[10px] tracking-[0.2em]">Percentage (%)</span>
            </button>
            <button 
              onClick={() => setDiscountType('fixed')}
              className={cn(
                "p-8 rounded-[2rem] border transition-all flex flex-col items-center gap-4 group",
                discountType === 'fixed' ? "bg-brand-primary/20 border-brand-primary text-white" : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
              )}
            >
              <Hash className={cn("w-8 h-8", discountType === 'fixed' ? "text-brand-primary" : "group-hover:text-white")} />
              <span className="font-black uppercase text-[10px] tracking-[0.2em]">Fixed Amount (GBP)</span>
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Discount Value</label>
              <span className="text-3xl font-mono font-black text-white">
                {discountType === 'percentage' ? `${discountValue}%` : `£${PricingEngine.formatCurrency(discountValue)}`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[5, 10, 20, 25, 50, 100].map(v => (
                <button 
                  key={v}
                  onClick={() => setDiscountValue(discountType === 'fixed' ? v * 100 : v)}
                  className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black text-white border border-white/10 transition-all font-mono"
                >
                  {discountType === 'fixed' ? `£${v}` : `${v}%`}
                </button>
              ))}
              <button 
                onClick={() => { setDiscountType('percentage'); setDiscountValue(100); }}
                className="col-span-2 py-4 bg-brand-primary/10 hover:bg-brand-primary/20 rounded-2xl text-[10px] font-black text-brand-primary border border-brand-primary/20 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Gift className="w-4 h-4" /> Guest Comp
              </button>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-white/5 bg-white/[0.01] flex gap-4">
          <button 
            onClick={handleClear}
            className="flex-1 py-5 bg-white/5 text-status-pending font-black uppercase tracking-widest rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
          >
            Clear
          </button>
          <button 
            onClick={handleApply}
            className="flex-[2] py-5 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
};
