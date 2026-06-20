import React, { useMemo, useState } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { POSOrder, PaymentMethod } from '../../types/pos';
import { X, CreditCard, Banknote, Ticket, Check, Calculator, Delete, CornerDownLeft, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PricingEngine } from '../../domain/PricingEngine';
import { db } from '../../lib/firebase';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { OfflineBanner } from '../OfflineBanner';

interface PaymentModalProps {
  order: POSOrder | null;
  onClose: () => void;
  onProcess: (amount: number, method: PaymentMethod) => Promise<void> | void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ order, onClose, onProcess }) => {
  const totals = useMemo(() => {
    if (!order) {
      return {
        subtotalGross: 0,
        vatTotal: 0,
        serviceCharge: 0,
        totalGross: 0,
        amountPaid: 0,
        remaining: 0,
      };
    }
    const safeItems = Array.isArray(order.items) ? order.items : [];

    const lineTotals = safeItems.map((item: any) => {
      const base =
        item?.snapshot?.priceGross ??
        item?.snapshot?.basePrice ??
        item?.snapshot?.price ??
        item?.priceGross ??
        0;

      const modifierTotal = Array.isArray(item?.modifiers)
        ? item.modifiers.reduce((sum: number, mod: any) => {
            return sum + (mod?.priceDelta ?? mod?.priceDeltaPence ?? mod?.price ?? 0);
          }, 0)
        : 0;

      const qty = item?.quantity ?? 1;

      return PricingEngine.calculateItemGross(base, modifierTotal, qty);
    });

    const vatRates = safeItems.map((item: any) => item?.snapshot?.vatRate ?? item?.vatRate ?? 20);

    const subtotalGross =
      order?.subtotalGross ??
      order?.subtotal ??
      PricingEngine.calculateOrderSubtotalGross(lineTotals);

    const vatTotal =
      order?.vatTotal ??
      order?.taxTotal ??
      PricingEngine.calculateOrderVatTotal(lineTotals, vatRates);

    const serviceCharge =
      order?.serviceCharge ??
      order?.serviceChargeAmount ??
      PricingEngine.calculateServiceCharge(subtotalGross, true);

    const totalGross =
      order?.totalGross ??
      order?.grandTotal ??
      PricingEngine.calculateGrandTotalGross(subtotalGross, serviceCharge);

    const amountPaid =
      order?.amountPaid ??
      (Array.isArray((order as any)?.payments)
        ? (order as any).payments.reduce((sum: number, p: any) => sum + (p?.amount ?? 0), 0)
        : 0);

    const remaining = PricingEngine.calculateBalanceRemaining(totalGross, amountPaid);

    return {
      subtotalGross,
      vatTotal,
      serviceCharge,
      totalGross,
      amountPaid,
      remaining,
    };
  }, [order]);

  const [amount, setAmount] = useState<string>((totals.remaining / 100).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [paymentWarning, setPaymentWarning] = useState<string | null>(null);

  const { isOnline } = useConnectionStatus();

  // Math Calculator Popup State & Helpers
  const [showCalculator, setShowCalculator] = useState(false);
  const [expression, setExpression] = useState('');

  const handleInput = (val: string) => {
    setExpression(prev => {
      // Avoid consecutive operators
      if (['+', '-', '*', '/'].includes(val)) {
        const lastChar = prev.trim().slice(-1);
        if (['+', '-', '*', '/'].includes(lastChar)) {
          return prev.slice(0, -1) + val;
        }
      }
      return prev + val;
    });
  };

  const handleClear = () => {
    setExpression('');
  };

  const handleDelete = () => {
    setExpression(prev => prev.slice(0, -1));
  };

  const evaluateExpressionSafe = (expr: string): string => {
    if (!expr) return '';
    let cleanExpr = expr.trim();
    // Strip trailing operators/parentheses for live evaluation
    while (cleanExpr && ['+', '-', '*', '/', '('].includes(cleanExpr.slice(-1))) {
      cleanExpr = cleanExpr.slice(0, -1).trim();
    }
    if (!cleanExpr) return '';
    try {
      const sanitized = cleanExpr.replace(/[^0-9.+\-*/()]/g, '');
      const res = new Function(`return (${sanitized});`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        if (res % 1 === 0) {
          return res.toString();
        } else {
          return parseFloat(res.toFixed(4)).toString();
        }
      }
    } catch {
      // Suppress parsing errors during draft typing
    }
    return '';
  };

  const handleEvaluate = () => {
    const res = evaluateExpressionSafe(expression);
    if (res) {
      setExpression(res);
    }
  };

  const handleApply = () => {
    const res = evaluateExpressionSafe(expression);
    if (res) {
      setAmount(res);
      setShowCalculator(false);
    } else if (expression) {
      setAmount(expression);
      setShowCalculator(false);
    }
  };

  const handleProcess = async () => {
    const parsed = parseFloat(amount || '0');
    if (!parsed || parsed <= 0) return;

    // UI-layer offline guard — belt and suspenders alongside the store guard.
    if (!isOnline) return;

    setIsProcessing(true);
    setPaymentWarning(null);

    try {
      await (onProcess(Math.round(parsed * 100), method) as Promise<void>);
    } catch {
      setIsProcessing(false);
      setPaymentWarning(
        'Payment write failed. Do not retry without confirming with a manager whether the payment was recorded.'
      );
      return;
    }

    // Verify the posPayments + posOrders write actually landed on the server.
    // Retries up to 3 times with increasing delays before raising the manager alert.
    const expectedAmountPaid = (order.amountPaid || 0) + Math.round(parsed * 100);
    let verified = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) await new Promise<void>(r => setTimeout(r, attempt * 700));
        const snap = await getDocFromServer(doc(db, 'posOrders', order.id));
        if (snap.exists() && (snap.data()?.amountPaid ?? 0) >= expectedAmountPaid) {
          verified = true;
          break;
        }
      } catch {
        // Network failure on the verification probe — keep retrying.
      }
    }

    setIsProcessing(false);

    if (!verified) {
      const formattedAmount = PricingEngine.formatCurrency(Math.round(parsed * 100));
      setPaymentWarning(
        `ALERT MANAGER: Payment for ${formattedAmount} could not be confirmed on the server after 3 attempts. ` +
        `Note the table (${order.tableId}) and amount and do NOT re-process without manager approval — ` +
        `the payment may have gone through.`
      );
      return;
    }

    setIsDone(true);
    setTimeout(onClose, 1500);
  };

  const methods: { id: PaymentMethod; label: string; icon: any }[] = [
    { id: 'card', label: 'Credit Card', icon: CreditCard },
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'code', label: 'Code', icon: Ticket },
  ];

  if (isDone) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-bg-card w-full max-w-md rounded-3xl md:rounded-[2rem] border border-white/10 p-8 md:p-12 flex flex-col items-center text-center space-y-4 md:space-y-6 shadow-2xl">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-status-available/10 rounded-full flex items-center justify-center text-status-available">
            <Check className="w-8 md:w-12 h-8 md:h-12" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Payment Successful</h2>
            <p className="text-text-secondary text-[10px] md:text-sm font-bold uppercase tracking-widest mt-2">Transaction Completed</p>
          </div>

          <div className="w-full bg-white/5 border border-white/5 rounded-3xl p-6 space-y-4">
            <h3 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-2">Service Turnaround Report</h3>
            
            <div className="space-y-3">
              {[
                { label: 'Seated', time: order.seatedAt },
                { label: 'First Order', time: order.firstOrderSentAt },
                { label: 'Mains Fired', time: order.mainsFiredAt },
                { label: 'Desserts Fired', time: order.dessertsFiredAt },
                { label: 'Total Duration', time: order.paidAt || Date.now(), isTotal: true }
              ].map((m, i) => {
                const formattedTime = m.time ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'PENDING';
                const duration = m.time && order.seatedAt ? Math.floor((m.time - order.seatedAt) / 60000) : null;
                
                return (
                  <div key={m.label} className={cn(
                    "flex items-center justify-between py-2 border-b border-white/5 last:border-0",
                    m.isTotal && "pt-4 border-t-2 border-white/10 mt-2"
                  )}>
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">{m.label}</span>
                      {duration !== null && i > 0 && (
                        <span className="text-[8px] font-mono text-brand-primary/60 font-bold">+{duration} min</span>
                      )}
                    </div>
                    <span className={cn(
                      "text-xs font-mono font-black",
                      m.isTotal ? "text-white text-base" : m.time ? "text-text-secondary" : "text-text-muted opacity-30"
                    )}>
                      {m.isTotal ? `${duration || 0} MINUTES` : formattedTime}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4">
      <div className="bg-bg-card w-full max-w-xl rounded-3xl md:rounded-[2rem] border border-white/10 flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Process Payment</h2>
            <p className="text-text-secondary text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">
              Remaining: {PricingEngine.formatCurrency(totals.remaining)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 md:p-3 bg-white/5 rounded-xl md:rounded-2xl text-text-muted hover:text-white transition-all">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 no-scrollbar">
          <OfflineBanner position="inline" />

          <div className="bg-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 space-y-2 md:space-y-3 border border-white/5">
            <div className="flex justify-between text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary">
              <span>Subtotal</span>
              <span>{PricingEngine.formatCurrency(totals.subtotalGross)}</span>
            </div>
            <div className="flex justify-between text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary">
              <span>VAT</span>
              <span>{PricingEngine.formatCurrency(totals.vatTotal)}</span>
            </div>
            <div className="flex justify-between text-[8px] md:text-[10px] font-black uppercase tracking-widest text-text-secondary">
              <span>Service Charge</span>
              <span>{PricingEngine.formatCurrency(totals.serviceCharge)}</span>
            </div>
            <div className="pt-2 md:pt-3 border-t border-white/10 flex justify-between text-[10px] md:text-xs font-black uppercase tracking-widest text-white">
              <span>Grand Total</span>
              <span className="text-brand-primary">{PricingEngine.formatCurrency(totals.totalGross)}</span>
            </div>
          </div>

          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Amount to Pay</label>
              <button
                type="button"
                onClick={() => {
                  setExpression(amount);
                  setShowCalculator(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-brand-primary/10 hover:text-brand-primary text-text-secondary border border-white/5 hover:border-brand-primary/30 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
              >
                <Calculator className="w-3.5 h-3.5 text-brand-primary hover:animate-pulse" />
                Calculator
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-xl md:text-2xl font-black text-brand-primary">£</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 pl-10 md:pl-12 text-2xl md:text-4xl font-black text-white focus:outline-none focus:border-brand-primary transition-all"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAmount((totals.remaining / 100).toFixed(2))}
                className="px-3 md:px-4 py-2 bg-white/5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black text-text-secondary uppercase tracking-widest hover:text-white transition-all"
              >
                Full
              </button>
              <button
                onClick={() => setAmount((totals.remaining / 200).toFixed(2))}
                className="px-3 md:px-4 py-2 bg-white/5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black text-text-secondary uppercase tracking-widest hover:text-white transition-all"
              >
                1/2
              </button>
              <button
                onClick={() => setAmount((totals.remaining / 300).toFixed(2))}
                className="px-3 md:px-4 py-2 bg-white/5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black text-text-secondary uppercase tracking-widest hover:text-white transition-all"
              >
                1/3
              </button>
              <button
                onClick={() => setAmount((totals.remaining / 400).toFixed(2))}
                className="px-3 md:px-4 py-2 bg-white/5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black text-text-secondary uppercase tracking-widest hover:text-white transition-all"
              >
                1/4
              </button>
            </div>
          </div>

          <div className="space-y-3 md:space-y-4">
            <label className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Select Method</label>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {methods.map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      'p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all flex flex-col items-center gap-2 md:gap-3',
                      isSelected
                        ? 'bg-brand-primary/10 border-brand-primary text-white'
                        : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/20'
                    )}
                  >
                    <Icon className={cn('w-6 h-6 md:w-8 md:h-8', isSelected ? 'text-brand-primary' : 'text-text-muted')} />
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 border-t border-white/5 shrink-0 space-y-3">
          {!isOnline && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-black uppercase tracking-widest justify-center">
              Payment disabled while offline
            </div>
          )}

          {paymentWarning && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-200 text-xs font-bold leading-relaxed">{paymentWarning}</p>
            </div>
          )}

          <button
            disabled={isProcessing || !amount || parseFloat(amount) <= 0 || !isOnline}
            onClick={handleProcess}
            className={cn(
              'w-full py-4 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase tracking-widest text-xs md:text-sm transition-all shadow-xl flex items-center justify-center gap-3',
              !isProcessing && amount && parseFloat(amount) > 0 && isOnline
                ? 'bg-brand-primary text-white shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-5 h-5" />
                Complete Payment
              </>
            )}
          </button>
        </div>
      </div>

      {showCalculator && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#121620] w-full max-w-sm rounded-[2rem] border border-white/10 p-6 flex flex-col space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-primary/20 rounded-xl text-brand-primary">
                  <Calculator className="w-5 h-5" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-white">POS Math Assistant</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCalculator(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Calculator Display */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col items-end justify-center min-h-[96px] space-y-1">
              <div className="text-sm font-mono text-text-secondary overflow-x-auto whitespace-nowrap scrollbar-none w-full text-right">
                {expression || '0'}
              </div>
              <div className="text-2xl font-mono font-bold text-brand-primary overflow-x-auto whitespace-nowrap scrollbar-none w-full text-right">
                {evaluateExpressionSafe(expression) ? `= ${evaluateExpressionSafe(expression)}` : '= 0'}
              </div>
            </div>

            {/* Button Pad */}
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1 */}
              <button
                type="button"
                onClick={handleClear}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-black text-rose-500 uppercase tracking-widest transition-all active:scale-95"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleInput('(')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-black text-brand-primary transition-all active:scale-95"
              >
                (
              </button>
              <button
                type="button"
                onClick={() => handleInput(')')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-sm font-black text-brand-primary transition-all active:scale-95"
              >
                )
              </button>
              <button
                type="button"
                onClick={() => handleInput('/')}
                className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-black text-brand-primary transition-all active:scale-95"
              >
                ÷
              </button>

              {/* Row 2 */}
              {['7', '8', '9'].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleInput(num)}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-lg font-black text-white transition-all active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleInput('*')}
                className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-black text-brand-primary transition-all active:scale-95"
              >
                ×
              </button>

              {/* Row 3 */}
              {['4', '5', '6'].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleInput(num)}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-lg font-black text-white transition-all active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleInput('-')}
                className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-black text-brand-primary transition-all active:scale-95"
              >
                -
              </button>

              {/* Row 4 */}
              {['1', '2', '3'].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleInput(num)}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-lg font-black text-white transition-all active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleInput('+')}
                className="p-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-black text-brand-primary transition-all active:scale-95"
              >
                +
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => handleInput('0')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-lg font-black text-white transition-all active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleInput('.')}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-lg font-black text-white transition-all active:scale-95"
              >
                .
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex items-center justify-center text-text-secondary transition-all active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleEvaluate}
                className="p-4 bg-brand-primary text-white rounded-xl text-lg font-black transition-all active:scale-95 shadow-lg shadow-brand-primary/20"
              >
                =
              </button>
            </div>

            <button
              type="button"
              disabled={!expression}
              onClick={handleApply}
              className={cn(
                "w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                expression
                  ? "bg-brand-primary hover:bg-brand-primary-light text-white shadow-lg shadow-brand-primary/10 active:scale-[0.98]"
                  : "bg-white/5 text-white/20 cursor-not-allowed"
              )}
            >
              <CornerDownLeft className="w-4 h-4" />
              Apply to Amount (£{evaluateExpressionSafe(expression) || '0'})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};