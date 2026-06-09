import React, { useState, useMemo } from 'react';
import { usePOSStore } from '../../app/store';
import { ZReport, PaymentMethod, POSOrder } from '../../types/pos';
import { PricingEngine } from '../../domain/PricingEngine';
import { X, Moon, Sun, Sunrise, Coffee, Pizza, Beer, CheckCircle2, AlertTriangle, FileText, Download, Users, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface EndOfDayModalProps {
  onClose: () => void;
}

export const EndOfDayModal: React.FC<EndOfDayModalProps> = ({ onClose }) => {
  const { allOrders, currentStaff, performEndOfDay } = usePOSStore();
  const [step, setStep] = useState<'preview' | 'closing' | 'summary'>('preview');
  const [generatedReport, setGeneratedReport] = useState<ZReport | null>(null);

  // 1. Calculate Preview Data
  const pendingOrders = useMemo(() => {
    return allOrders.filter(o => o.status === 'paid' && !o.zReportId);
  }, [allOrders]);

  const previewMetrics = useMemo(() => {
    return pendingOrders.reduce((acc, o) => {
      const gross = Number(o.totalGross) || 0;
      const net = Number(o.subtotalGross) || 0;
      const vat = Number(o.vatTotal) || 0;
      const sc = Number(o.serviceCharge) || 0;
      
      acc.gross += gross;
      acc.net += net;
      acc.vat += vat;
      acc.sc += sc;
      if (o.paymentMethod && acc.payments[o.paymentMethod] !== undefined) {
        acc.payments[o.paymentMethod] += gross;
      }
      return acc;
    }, { gross: 0, net: 0, vat: 0, sc: 0, payments: { cash: 0, card: 0, code: 0 } });
  }, [pendingOrders]);

  const activeOrdersCount = useMemo(() => {
    return allOrders.filter(o => ['open', 'sent', 'partially_paid'].includes(o.status)).length;
  }, [allOrders]);

  const handleDownloadPDF = () => {
    if (!generatedReport) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(22);
    doc.text('END OF DAY REPORT', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Z-REPORT ID: ${generatedReport.id}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Staff: ${currentStaff?.name || 'Unknown'}`, pageWidth / 2, 33, { align: 'center' });
    doc.text(`Generated: ${format(new Date(generatedReport.timestamp || Date.now()), 'EEEE, do MMMM yyyy HH:mm')}`, pageWidth / 2, 38, { align: 'center' });
    
    // Financial Summary
    doc.setFontSize(14);
    doc.text('FINANCIAL SUMMARY', 14, 55);
    
    const financialData = [
      ['Gross Sales', PricingEngine.formatCurrency(generatedReport.grossSales)],
      ['Net Sales', PricingEngine.formatCurrency(generatedReport.netSales)],
      ['VAT Collected', PricingEngine.formatCurrency(generatedReport.vatTotal)],
      ['Service Charge', PricingEngine.formatCurrency(generatedReport.serviceChargeTotal)],
      ['Cash Collected', PricingEngine.formatCurrency(generatedReport.payments.cash)],
      ['Card Collected', PricingEngine.formatCurrency(generatedReport.payments.card)],
      ['Digital Collected', PricingEngine.formatCurrency(generatedReport.payments.code)],
    ];
    
    (doc as any).autoTable({
      startY: 60,
      head: [['Metric', 'Value']],
      body: financialData,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0] },
      columnStyles: {
        1: { halign: 'right' }
      }
    });
    
    // Top Items
    const lastY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFontSize(14);
    doc.text('TOP PERFORMING ITEMS', 14, lastY + 15);
    
    const itemData = generatedReport.topItems.map((item, idx) => [
      idx + 1,
      item.name,
      item.quantity,
      PricingEngine.formatCurrency(item.revenue)
    ]);
    
    (doc as any).autoTable({
      startY: lastY + 20,
      head: [['#', 'Item Name', 'Qty', 'Revenue']],
      body: itemData,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0] },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' }
      }
    });
    
    doc.save(`Z_REPORT_${generatedReport.id}.pdf`);
  };

  const handleCloseDay = async () => {
    setStep('closing');
    const report = await performEndOfDay();
    if (report) {
      setGeneratedReport(report);
      setStep('summary');
    } else {
      setStep('preview');
      alert('Failed to generate report. Please ensure you have paid orders and a manager PIN.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-dark/95 backdrop-blur-xl">
      <div className="bg-bg-card border border-white/10 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
              <Moon className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">End of Day Report</h2>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">
                {format(new Date(), 'EEEE, do MMMM yyyy')} • {currentStaff?.name || 'Staff'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all">
            <X className="w-6 h-6 text-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            {step === 'preview' && (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-8 space-y-8"
              >
                {/* Warning for active orders */}
                {activeOrdersCount > 0 && (
                  <div className="bg-status-fired/10 border border-status-fired/20 p-6 rounded-3xl flex gap-6 items-center">
                    <AlertTriangle className="w-10 h-10 text-status-fired shrink-0" />
                    <div>
                      <h4 className="text-status-fired font-black uppercase text-sm tracking-widest">Active Orders Detected</h4>
                      <p className="text-text-secondary text-xs font-bold mt-1">
                        There are still {activeOrdersCount} open or partially paid orders. These will be force-closed (cleared from tables) if you continue, but they won't be included in this Z-total if they are not fully paid.
                      </p>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {pendingOrders.length === 0 && (
                  <div className="bg-white/5 border border-dashed border-white/10 p-12 rounded-[2rem] text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-8 h-8 text-text-muted" />
                    </div>
                    <div>
                      <h4 className="text-white font-black uppercase text-sm tracking-widest">No Paid Transactions</h4>
                      <p className="text-text-muted text-xs font-bold mt-2 max-w-xs mx-auto">
                        There are no orders marked as 'PAID' for the current shift. Complete some payments at the tables to see them here.
                      </p>
                    </div>
                  </div>
                )}

                {/* Summary Grid */}
                {pendingOrders.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard label="Gross Sales" value={PricingEngine.formatCurrency(previewMetrics.gross)} color="brand-primary" />
                    <MetricCard label="Net Sales" value={PricingEngine.formatCurrency(previewMetrics.net)} color="white" />
                    <MetricCard label="VAT Total" value={PricingEngine.formatCurrency(previewMetrics.vat)} color="text-secondary" />
                    <MetricCard label="Transactions" value={String(pendingOrders.length)} color="text-secondary" />
                  </div>
                )}

                {/* Payment Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={cn("bg-white/5 rounded-3xl p-6 border border-white/5", pendingOrders.length === 0 && "opacity-50")}>
                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-6">Payment Methods</h4>
                    <div className="space-y-4">
                      <PaymentRow label="Cash" value={previewMetrics.payments.cash} />
                      <PaymentRow label="Card" value={previewMetrics.payments.card} />
                      <PaymentRow label="Digital / Code" value={previewMetrics.payments.code} />
                      <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Total Collected</span>
                        <span className="text-lg font-mono font-black text-brand-primary">{PricingEngine.formatCurrency(previewMetrics.gross)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-3xl p-6 border border-white/5 md:col-span-2">
                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-6">Shift Estimations</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <ShiftEstimate icon={Sunrise} label="Breakfast" time="06:00 - 12:00" />
                      <ShiftEstimate icon={Sun} label="Lunch" time="12:00 - 17:00" />
                      <ShiftEstimate icon={Beer} label="Evening" time="17:00 - Close" />
                    </div>
                  </div>
                </div>

                <div className="pt-8">
                  <button 
                    onClick={handleCloseDay}
                    className="w-full py-6 bg-brand-primary text-white font-black uppercase text-xl tracking-[0.2em] rounded-3xl shadow-2xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    <CheckCircle2 className="w-8 h-8" />
                    Perform End of Day
                  </button>
                  <p className="text-center text-[10px] font-black text-text-muted uppercase tracking-widest mt-4">
                    By clicking above, you confirm all data is accurate and ready for tax recording.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 'closing' && (
              <motion.div 
                key="closing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-8 p-8"
              >
                <div className="w-24 h-24 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Closing Business Day</h3>
                  <p className="text-text-secondary font-bold mt-2">Writing Z-Report to HUB and archiving transactions...</p>
                </div>
              </motion.div>
            )}

            {step === 'summary' && generatedReport && (
              <motion.div 
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 space-y-8"
              >
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-8 rounded-[2rem] text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Day Closed Successfully</h3>
                    <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-2">Z-REPORT ID: {generatedReport.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Detailed Financial Breakdown */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Financial Breakdown</h4>
                    <div className="bg-white/5 rounded-3xl p-8 border border-white/5 space-y-6">
                      <SummaryRow label="Gross Sales" value={PricingEngine.formatCurrency(generatedReport.grossSales)} highlight />
                      <SummaryRow label="Net Sales" value={PricingEngine.formatCurrency(generatedReport.netSales)} />
                      <SummaryRow label="VAT Collected" value={PricingEngine.formatCurrency(generatedReport.vatTotal)} />
                      <SummaryRow label="Service Charge" value={PricingEngine.formatCurrency(generatedReport.serviceChargeTotal)} />
                      <div className="h-px bg-white/10" />
                      <SummaryRow label="Cash Payments" value={PricingEngine.formatCurrency(generatedReport.payments.cash)} />
                      <SummaryRow label="Card Payments" value={PricingEngine.formatCurrency(generatedReport.payments.card)} />
                      <SummaryRow label="Other (Digital)" value={PricingEngine.formatCurrency(generatedReport.payments.code)} />
                    </div>
                  </div>

                  {/* Shift Performance */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Shift Performance</h4>
                    <div className="space-y-4">
                      {generatedReport.shifts.lunch && <ShiftResultCard icon={Sun} shift={generatedReport.shifts.lunch} />}
                      {generatedReport.shifts.dinner && <ShiftResultCard icon={Beer} shift={generatedReport.shifts.dinner} />}
                    </div>
                  </div>
                </div>

                {/* Top Items */}
                <div className="bg-white/5 rounded-3xl p-8 border border-white/5">
                  <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-6">Top Performing Items</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    {generatedReport.topItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-brand-primary w-4">#{idx+1}</span>
                          <span className="text-white font-bold">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-mono font-bold text-xs">{item.quantity}x</p>
                          <p className="text-[9px] font-black text-text-muted uppercase">{PricingEngine.formatCurrency(item.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handleDownloadPDF}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest rounded-2xl border border-white/10 flex items-center justify-center gap-3 transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download PDF
                  </button>
                  <button 
                    onClick={onClose}
                    className="flex-1 py-4 bg-brand-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-3 transition-all"
                  >
                    Finish & Reset POS
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, color = "white" }: { label: string; value: string; color?: string }) => (
  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-1">
    <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">{label}</span>
    <span className={cn("text-xl font-mono font-black", `text-${color}`)}>{value}</span>
  </div>
);

const PaymentRow = ({ label, value }: { label: string, value: number }) => (
  <div className="flex justify-between items-center">
    <span className="text-[10px] font-bold text-text-secondary uppercase">{label}</span>
    <span className="text-sm font-mono font-bold text-white">{PricingEngine.formatCurrency(value)}</span>
  </div>
);

const SummaryRow = ({ label, value, highlight = false }: { label: string, value: string, highlight?: boolean }) => (
  <div className="flex justify-between items-center">
    <span className={cn("text-[10px] font-black uppercase tracking-widest", highlight ? "text-white" : "text-text-secondary")}>{label}</span>
    <span className={cn("font-mono font-bold", highlight ? "text-xl text-brand-primary" : "text-sm text-white")}>{value}</span>
  </div>
);

const ShiftEstimate = ({ icon: Icon, label, time }: { icon: any, label: string, time: string }) => (
  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
    <Icon className="w-5 h-5 text-brand-primary" />
    <div className="text-center">
      <p className="text-[10px] font-black text-white uppercase">{label}</p>
      <p className="text-[8px] font-bold text-text-muted mt-0.5">{time}</p>
    </div>
  </div>
);

const ShiftResultCard = ({ icon: Icon, shift }: { icon: any, shift: any }) => (
  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-primary" />
      </div>
      <div>
        <h5 className="text-[10px] font-black text-white uppercase tracking-widest">{shift.name} Shift</h5>
        <div className="flex items-center gap-3 mt-1 text-[8px] font-black uppercase text-text-muted">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {shift.covers} Covers</span>
          <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {shift.transactions} Bills</span>
        </div>
      </div>
    </div>
    <div className="text-right">
      <p className="text-sm font-mono font-black text-white">{PricingEngine.formatCurrency(shift.grossSales)}</p>
      <p className="text-[8px] font-black text-text-muted uppercase">Gross</p>
    </div>
  </div>
);
