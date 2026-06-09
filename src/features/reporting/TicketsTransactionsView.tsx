import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Printer, 
  Mail, 
  Trash2, 
  RotateCcw, 
  CheckCircle, 
  X, 
  FileText, 
  Clock, 
  Users, 
  Calculator, 
  Layers, 
  CornerDownRight, 
  Check, 
  Lock,
  ArrowRight
} from 'lucide-react';
import { usePOSStore, OperationType, handleFirestoreError } from '../../app/store';
import { PricingEngine } from '../../domain/PricingEngine';
import { db } from '../../lib/firebase';
import { collection, doc, query, where, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { sanitizeForFirestore } from '../../lib/utils';
import { generateReceiptPDF } from '../../lib/pdfGenerator';
import { format, subDays } from 'date-fns';
import { POSTransaction, TicketSnapshot } from '../../types/transactions';
import { POS_CONFIG } from '../../app/config';
import { ReceiptPreview } from '../settings/ReceiptPreview';
import { getDefaultReceiptTemplate } from '../settings/receiptDefaults';

interface TicketsTransactionsViewProps {
  initialSelectedId?: string | null;
  onClearInitialId?: () => void;
}

export const TicketsTransactionsView: React.FC<TicketsTransactionsViewProps> = ({ 
  initialSelectedId, 
  onClearInitialId 
}) => {
  const { 
    allTransactions, 
    staffList, 
    voidTransaction, 
    refundTransaction, 
    correctPaymentMethod, 
    currentStaff 
  } = usePOSStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<POSTransaction | null>(null);

  // Date Filtering states & helper for past transactions
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === 'last7') {
      const startStr = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      setStartDate(startStr);
      setEndDate(todayStr);
    } else if (preset === 'last30') {
      const startStr = format(subDays(new Date(), 29), 'yyyy-MM-dd');
      setStartDate(startStr);
      setEndDate(todayStr);
    } else if (preset === 'custom') {
      if (!startDate) setStartDate(todayStr);
      if (!endDate) setEndDate(todayStr);
    }
  };

  // Auto-select initial transaction from props if specified
  useEffect(() => {
    if (initialSelectedId) {
      const found = allTransactions.find(tx => tx.id === initialSelectedId);
      if (found) {
        setSelectedTx(found);
      }
      if (onClearInitialId) {
        onClearInitialId();
      }
    }
  }, [initialSelectedId, allTransactions, onClearInitialId]);

  // Sub-collection Details states loaded on demand
  const [snapshot, setSnapshot] = useState<TicketSnapshot | null>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [printHistory, setPrintHistory] = useState<any[]>([]);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);

  // Modals for Actions
  const [pinModal, setPinModal] = useState<{
    isOpen: boolean;
    type: 'void' | 'refund' | 'correct';
    requiredRole: 'supervisor' | 'manager';
    data?: any;
  }>({ isOpen: false, type: 'void', requiredRole: 'manager' });

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Default Template and Action states
  const [defaultTemplate, setDefaultTemplate] = useState<any>(null);
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'void' | 'refund' | 'correct' | null;
    reason: string;
    selectedItems: { [uuid: string]: boolean };
    correctedMethod: 'cash' | 'card' | 'deposit' | 'voucher' | 'complimentary' | 'staff_meal' | 'bank_transfer' | 'other';
    refundType: 'full' | 'partial';
  }>({
    isOpen: false,
    type: null,
    reason: '',
    selectedItems: {},
    correctedMethod: 'cash',
    refundType: 'full'
  });

  // Load fallback active template when starting
  useEffect(() => {
    const templateId = POS_CONFIG.LOCATION_ID;
    getDoc(doc(db, 'receiptTemplates', templateId)).then(tplSnap => {
      if (tplSnap.exists()) {
        setDefaultTemplate(tplSnap.data());
      } else {
        setDefaultTemplate(getDefaultReceiptTemplate(templateId));
      }
    }).catch(err => {
      console.warn("Could not load fallback receipt template", err);
      setDefaultTemplate(getDefaultReceiptTemplate(templateId));
    });
  }, []);

  const logAuditAction = async (
    actionType: string,
    actionLabel: string,
    previousValue: any,
    newValue: any,
    reason: string = ''
  ) => {
    if (!selectedTx) return;
    const businessId = selectedTx.businessId || 'biz_backbone';
    const siteId = selectedTx.locationId || POS_CONFIG.LOCATION_ID;
    const auditId = `AUD-${Math.random().toString(36).substring(7)}`;
    try {
      const auditRecord = {
        id: auditId,
        businessId,
        siteId,
        locationId: siteId,
        transactionId: selectedTx.id,
        ticketNumber: selectedTx.ticketNumber,
        actionType,
        actionLabel,
        previousValue: previousValue !== null ? String(previousValue) : '',
        newValue: newValue !== null ? String(newValue) : '',
        reason,
        performedBy: currentStaff?.id || 'unknown',
        performedByName: currentStaff?.name || 'Unknown Staff',
        performedAt: Date.now(),
        role: currentStaff?.role || 'Waiter'
      };

      // Write nested
      await setDoc(
        doc(db, `businesses/${businessId}/sites/${siteId}/transactionAuditLogs`, auditId),
        sanitizeForFirestore(auditRecord)
      );
      console.log(`[Audit System] Logged nested audit record: ${actionType}`);
    } catch (err) {
      console.error('Audit Save Err:', err);
      handleFirestoreError(err, OperationType.WRITE, `businesses/${businessId}/sites/${siteId}/transactionAuditLogs/${auditId}`);
    }
  };

  // Load Single Transaction Sub-details On Demand
  useEffect(() => {
    if (!selectedTx) {
      setSnapshot(null);
      setAdjustments([]);
      setPrintHistory([]);
      setEmailHistory([]);
      return;
    }

    const txId = selectedTx.id;

    // Snapshot Order Details
    getDoc(doc(db, 'ticketSnapshots', `SNAP-${txId}`)).then(snap => {
      if (snap.exists()) {
        setSnapshot(snap.data() as TicketSnapshot);
      }
    }).catch(err => {
      console.error('Snapshot Error', err);
      handleFirestoreError(err, OperationType.GET, `ticketSnapshots/SNAP-${txId}`);
    });

    // Adjustment logs (refunds, voids, Corrections)
    getDocs(query(
      collection(db, 'transactionAdjustments'), 
      where('locationId', '==', selectedTx.locationId),
      where('transactionId', '==', txId)
    ))
      .then(res => {
        setAdjustments(res.docs.map(d => d.data()));
      }).catch(err => {
        console.error('Adjustments list loading err', err);
        handleFirestoreError(err, OperationType.LIST, 'transactionAdjustments');
      });

    // Print logs
    getDocs(query(
      collection(db, 'receiptPrintHistory'), 
      where('locationId', '==', selectedTx.locationId),
      where('transactionId', '==', txId)
    ))
      .then(res => {
        setPrintHistory(res.docs.map(d => d.data()));
      }).catch(err => {
        console.error('Print log err', err);
        handleFirestoreError(err, OperationType.LIST, 'receiptPrintHistory');
      });

    // Email logs
    getDocs(query(
      collection(db, 'receiptEmailHistory'), 
      where('locationId', '==', selectedTx.locationId),
      where('transactionId', '==', txId)
    ))
      .then(res => {
        setEmailHistory(res.docs.map(d => d.data()));
      }).catch(err => {
        console.error('Email history err', err);
        handleFirestoreError(err, OperationType.LIST, 'receiptEmailHistory');
      });

  }, [selectedTx]);

  // Audit transaction viewed
  useEffect(() => {
    if (selectedTx) {
      logAuditAction('transaction_viewed', 'Transaction Viewed', null, selectedTx.status, 'Viewed transaction details');
    }
  }, [selectedTx]);

  // Filtering transactions locally with a highly robust, normalized search implementation
  const filteredTxs = useMemo(() => {
    // Calculate date filter boundaries using local time formats safely
    const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : null;
    const endMs = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : null;

    const baseFiltered = allTransactions.filter(tx => {
      if (startMs !== null && tx.createdAt < startMs) return false;
      if (endMs !== null && tx.createdAt > endMs) return false;
      return true;
    });

    const rawQuery = search.trim();
    if (!rawQuery) {
      return baseFiltered.filter(tx => {
        const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
        let matchesMethod = true;
        if (methodFilter !== 'all') {
          if (methodFilter === 'cash') matchesMethod = tx.payments?.cash > 0;
          if (methodFilter === 'card') matchesMethod = tx.payments?.card > 0;
          if (methodFilter === 'voucher') matchesMethod = tx.payments?.voucher > 0;
        }
        return matchesStatus && matchesMethod;
      });
    }

    const queryVal = rawQuery.toLowerCase();

    return baseFiltered.filter(tx => {
      // 1. ticketNumber normalization
      const ticketNumber = (tx.ticketNumber || '').toLowerCase();

      // 2. tableNumber / tableName normalization (includes tableId/tableName/tableNumber)
      const tableNumber = String((tx as any).tableNumber || tx.tableName || tx.tableId || '').toLowerCase();

      // 3. staffName normalization
      const staffName = (tx.staffName || '').toLowerCase();

      // 4. paymentSummary.primaryPaymentMethod normalization & fallbacks
      const primaryPaymentMethod = ((tx as any).paymentSummary?.primaryPaymentMethod || '').toLowerCase();
      const fallbackMethods: string[] = [];
      if (tx.payments?.cash > 0) fallbackMethods.push('cash');
      if (tx.payments?.card > 0) fallbackMethods.push('card', 'chip', 'pin', 'chippin', 'chip & pin');
      if (tx.payments?.voucher > 0) fallbackMethods.push('voucher', 'coupon', 'giftcard');
      if (tx.payments?.deposit > 0) fallbackMethods.push('deposit');

      // 5. grandTotal normalization (cence representations, exact decimals, and formatted representations)
      const grandTotalVal = Number((tx as any).grandTotal ?? tx.totalGross ?? 0);
      const grandTotalString = grandTotalVal.toString();
      const grandTotalDecimal = (grandTotalVal / 100).toFixed(2);
      const grandTotalInteger = Math.floor(grandTotalVal / 100).toString();
      const grandTotalFormatted = PricingEngine.formatCurrency ? PricingEngine.formatCurrency(grandTotalVal).toLowerCase() : '';

      // Supporting optional secondary keys for backwards compatibility/robustness (tx id, orderId)
      const bonusFields = [
        tx.id,
        tx.orderId,
        tx.staffRole,
        tx.status,
        (tx as any).paymentStatus,
        (tx as any).transactionStatus,
        (tx as any).transactionType
      ].map(f => String(f || '').toLowerCase());

      // Matches explicit user requested fields
      const matchesTicket = ticketNumber.includes(queryVal);
      const matchesTable = tableNumber.includes(queryVal);
      const matchesStaff = staffName.includes(queryVal);
      const matchesPaymentMethod = primaryPaymentMethod.includes(queryVal) || fallbackMethods.some(m => m.includes(queryVal));
      const matchesTotal = grandTotalString.includes(queryVal) || 
                           grandTotalDecimal.includes(queryVal) || 
                           grandTotalInteger.includes(queryVal) || 
                           grandTotalFormatted.includes(queryVal);
      const matchesBonus = bonusFields.some(b => b.includes(queryVal));

      const matchesSearch = matchesTicket || matchesTable || matchesStaff || matchesPaymentMethod || matchesTotal || matchesBonus;

      const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
      
      let matchesMethod = true;
      if (methodFilter !== 'all') {
        if (methodFilter === 'cash') matchesMethod = tx.payments?.cash > 0;
        if (methodFilter === 'card') matchesMethod = tx.payments?.card > 0;
        if (methodFilter === 'voucher') matchesMethod = tx.payments?.voucher > 0;
      }

      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [allTransactions, search, statusFilter, methodFilter, startDate, endDate]);

  // Authorization Check Dialog Submissions
  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError(null);

    // Find authorized staff profile
    const authedStaff = staffList.find(s => s.pin === pinInput);
    if (!authedStaff) {
      setPinError('Invalid PIN code');
      setPinInput('');
      return;
    }

    const role = authedStaff.role.toLowerCase();
    const isSupervisor = ['supervisor', 'manager', 'admin', 'architect'].includes(role);
    const isManager = ['manager', 'admin', 'architect'].includes(role);

    if (pinModal.requiredRole === 'manager' && !isManager) {
      setPinError('Manager level access is required for this action');
      return;
    }

    if (pinModal.requiredRole === 'supervisor' && !isSupervisor) {
      setPinError('Supervisor level access is required for this action');
      return;
    }

    // Auth OK - Execute requested modifier actions
    try {
      const tx = selectedTx!;
      if (pinModal.type === 'void') {
        const reason = pinModal.data?.reason || 'Manager Void Overwrite';
        await voidTransaction(tx.id, authedStaff.id, reason);
        
        // Log to nested adjustments
        const adjId = `ADJ-${Math.random().toString(36).substring(7)}`;
        const businessId = tx.businessId || 'biz_backbone';
        const siteId = tx.locationId || POS_CONFIG.LOCATION_ID;
        const adjustment = {
          id: adjId,
          transactionId: tx.id,
          businessId,
          siteId,
          locationId: siteId,
          ticketNumber: tx.ticketNumber,
          timestamp: Date.now(),
          type: 'void',
          reason,
          staffId: authedStaff.id,
          staffName: authedStaff.name,
          originalData: { status: tx.status },
          adjustedData: { status: 'voided' }
        };
        await setDoc(doc(db, `businesses/${businessId}/sites/${siteId}/transactionAdjustments`, adjId), sanitizeForFirestore(adjustment));
        await setDoc(doc(db, 'transactionAdjustments', adjId), sanitizeForFirestore(adjustment));
        setAdjustments(prev => [adjustment, ...prev]);

        // Audit void
        await logAuditAction('void_created', 'Void Bill Created', tx.status, 'voided', reason);

        // Refresh detail view
        setSelectedTx(p => p ? { ...p, status: 'voided' } : null);
      } else if (pinModal.type === 'refund') {
        const reason = pinModal.data?.reason || 'Manager Refund Overwrite';
        await refundTransaction(tx.id, authedStaff.id, reason, pinModal.data?.items);
        
        // Log to nested adjustments
        const adjId = `ADJ-${Math.random().toString(36).substring(7)}`;
        const businessId = tx.businessId || 'biz_backbone';
        const siteId = tx.locationId || POS_CONFIG.LOCATION_ID;
        const adjustment = {
          id: adjId,
          transactionId: tx.id,
          businessId,
          siteId,
          locationId: siteId,
          ticketNumber: tx.ticketNumber,
          timestamp: Date.now(),
          type: pinModal.data?.items ? 'partial_refund' : 'full_refund',
          reason,
          staffId: authedStaff.id,
          staffName: authedStaff.name,
          originalData: { status: tx.status },
          adjustedData: { status: 'refunded', refundItems: pinModal.data?.items || null }
        };
        await setDoc(doc(db, `businesses/${businessId}/sites/${siteId}/transactionAdjustments`, adjId), sanitizeForFirestore(adjustment));
        await setDoc(doc(db, 'transactionAdjustments', adjId), sanitizeForFirestore(adjustment));
        setAdjustments(prev => [adjustment, ...prev]);

        // Audit refund
        await logAuditAction('refund_created', 'Refund Created', tx.status, 'refunded', reason);

        // Refresh detail view
        setSelectedTx(p => p ? { ...p, status: 'refunded' } : null);
      } else if (pinModal.type === 'correct') {
        const { newMethod, reason } = pinModal.data;
        await correctPaymentMethod(tx.id, authedStaff.id, newMethod, reason);
        
        const updatedPayments = {
          cash: newMethod === 'cash' ? tx.totalGross : 0,
          card: newMethod === 'card' ? tx.totalGross : 0,
          deposit: 0,
          voucher: newMethod === 'code' || newMethod === 'voucher' ? tx.totalGross : 0
        };

        // Log to nested adjustments
        const adjId = `ADJ-${Math.random().toString(36).substring(7)}`;
        const businessId = tx.businessId || 'biz_backbone';
        const siteId = tx.locationId || POS_CONFIG.LOCATION_ID;
        const adjustment = {
          id: adjId,
          transactionId: tx.id,
          businessId,
          siteId,
          locationId: siteId,
          ticketNumber: tx.ticketNumber,
          timestamp: Date.now(),
          type: 'payment_correction',
          reason,
          staffId: authedStaff.id,
          staffName: authedStaff.name,
          originalPaymentSummary: tx.payments,
          correctedPaymentSummary: updatedPayments,
          originalPaymentMethod: tx.payments?.cash > 0 ? 'cash' : tx.payments?.card > 0 ? 'card' : 'voucher',
          correctedPaymentMethod: newMethod,
          correctedBy: authedStaff.id,
          correctedByName: authedStaff.name,
          correctedAt: Date.now()
        };
        await setDoc(doc(db, `businesses/${businessId}/sites/${siteId}/transactionAdjustments`, adjId), sanitizeForFirestore(adjustment));
        await setDoc(doc(db, 'transactionAdjustments', adjId), sanitizeForFirestore(adjustment));
        setAdjustments(prev => [adjustment, ...prev]);

        // Audit payment correction
        const prevMethod = tx.payments?.cash > 0 ? 'cash' : tx.payments?.card > 0 ? 'card' : 'voucher';
        await logAuditAction('payment_method_amended', 'Payment Method Amended', prevMethod, newMethod, reason);

        // Refresh detail view
        setSelectedTx(p => p ? { ...p, status: 'corrected', payments: updatedPayments } : null);
      }

      // Close Pin Verification drawer/modal
      setPinModal({ isOpen: false, type: 'void', requiredRole: 'manager' });
      setPinInput('');
    } catch (err: any) {
      console.error(err);
      setPinError('An update error occurred');
      handleFirestoreError(err, OperationType.WRITE, `posTransactions/${selectedTx?.id}`);
    }
  };

  // Preview Order and Template variables for safe unified receipt visualization
  const previewTemplate = snapshot?.receiptTemplateData || defaultTemplate;
  const previewOrder = useMemo(() => {
    if (snapshot?.orderData) {
      return snapshot.orderData;
    }
    if (!selectedTx) return null;
    return {
      id: selectedTx.id,
      locationId: selectedTx.locationId,
      tableId: selectedTx.tableId,
      covers: selectedTx.covers,
      items: [], // Fallback handles sample items beautifully
      subtotalGross: selectedTx.subtotalGross,
      vatTotal: selectedTx.vatTotal,
      serviceCharge: selectedTx.serviceCharge,
      discountAmount: selectedTx.discountAmount,
      totalGross: selectedTx.totalGross,
      amountPaid: selectedTx.amountPaid,
      status: selectedTx.status === 'voided' ? 'voided' : selectedTx.status === 'refunded' ? 'cancelled' : 'paid',
      createdAt: selectedTx.createdAt,
      voidedAt: selectedTx.voidedAt,
      refundedAt: selectedTx.refundedAt,
      staffId: selectedTx.staffId
    } as any;
  }, [snapshot, selectedTx, defaultTemplate]);

  // Reprint triggered directly from action toolbar
  const handleReprint = async () => {
    if (!selectedTx) return;

    try {
      const activeSnapshot = snapshot || {
        id: `SNAP-${selectedTx.id}`,
        locationId: selectedTx.locationId,
        orderData: previewOrder,
        receiptTemplateData: previewTemplate,
        createdAt: selectedTx.createdAt
      };

      generateReceiptPDF(selectedTx, activeSnapshot as any, true);

      // Log reprint operation
      const printLog = {
        id: `PRN-${Math.random().toString(36).substring(7)}`,
        transactionId: selectedTx.id,
        locationId: selectedTx.locationId,
        timestamp: Date.now(),
        staffId: currentStaff?.id || 'unknown',
        staffName: currentStaff?.name || 'Unknown Staff',
        type: 'reprint',
        watermark: 'REPRINT COPY'
      };

      await setDoc(doc(db, 'receiptPrintHistory', printLog.id), sanitizeForFirestore(printLog));
      setPrintHistory(p => [printLog, ...p]);

      // Audit log
      await logAuditAction('receipt_reprinted', 'Receipt Reprinted', null, 'printed', 'Physical receipt ticket reprint request');
    } catch (err) {
      console.error('Failed logging print copy details', err);
      handleFirestoreError(err, OperationType.WRITE, 'receiptPrintHistory');
    }
  };

  // Email Submit action (Option C compliant)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;

    try {
      const emailLog = {
        id: `EML-${Math.random().toString(36).substring(7)}`,
        transactionId: selectedTx.id,
        locationId: selectedTx.locationId,
        timestamp: Date.now(),
        staffId: currentStaff?.id || 'unknown',
        staffName: currentStaff?.name || 'Unknown Staff',
        emailAddress: emailInput,
        status: "queued",
        failureReason: "Email provider is not configured yet. Please connect Firebase Trigger Email, SendGrid, Resend, or a Cloud Function before sending receipts."
      };

      const businessId = selectedTx.businessId || 'biz_backbone';
      const siteId = selectedTx.locationId || POS_CONFIG.LOCATION_ID;

      await setDoc(
        doc(db, `businesses/${businessId}/sites/${siteId}/receiptEmailHistory`, emailLog.id),
        sanitizeForFirestore(emailLog)
      );
      await setDoc(doc(db, 'receiptEmailHistory', emailLog.id), sanitizeForFirestore(emailLog));
      setEmailHistory(e => [emailLog, ...e]);

      // Informative alert showing configuration warning
      alert("Email provider is not configured yet. Please connect Firebase Trigger Email, SendGrid, Resend, or a Cloud Function before sending receipts.\n\nYour receipt dispatch request has been safely logged in receiptEmailHistory.");

      // Increment emailedCount on transaction
      try {
        const txRef = doc(db, 'posTransactions', selectedTx.id);
        const currentEmailedCount = (selectedTx as any).receipt?.emailedCount || 0;
        await updateDoc(txRef, {
          'receipt.emailedCount': currentEmailedCount + 1,
          'receipt.lastEmailedAt': Date.now()
        });
        setSelectedTx(prev => {
          if (!prev) return null;
          return {
            ...prev,
            receipt: {
              ...((prev as any).receipt || {}),
              emailedCount: currentEmailedCount + 1,
              lastEmailedAt: Date.now()
            }
          } as any;
        });
      } catch (err2) {
        console.warn("receipt count update err", err2);
      }

      // Audit log
      await logAuditAction('email_queued', 'Email Receipt Queued', null, emailInput, `Digital receipt queued to: ${emailInput}`);

      setEmailSuccess(true);
      setTimeout(() => {
        setEmailSuccess(false);
        setShowEmailPrompt(false);
        setEmailInput('');
      }, 1500);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'receiptEmailHistory');
    }
  };

  // Triggering actions which prompt custom local select dialog overlays (To bypass iframe window.prompt)
  const promptVoid = () => {
    setActionModal({
      isOpen: true,
      type: 'void',
      reason: '',
      selectedItems: {},
      correctedMethod: 'cash',
      refundType: 'full'
    });
  };

  const promptRefund = () => {
    setActionModal({
      isOpen: true,
      type: 'refund',
      reason: '',
      selectedItems: {},
      correctedMethod: 'cash',
      refundType: 'full'
    });
  };

  const promptPaymentMethodCorrection = () => {
    setActionModal({
      isOpen: true,
      type: 'correct',
      reason: '',
      selectedItems: {},
      correctedMethod: 'cash',
      refundType: 'full'
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-14rem)] overflow-hidden">
      {/* List Column */}
      <div className="lg:col-span-7 flex flex-col space-y-6 h-full overflow-hidden">
        
        {/* Filters Panel */}
        <div className="bg-bg-card border border-white/5 rounded-[2rem] p-6 space-y-4 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-text-muted" />
              </span>
              <input
                type="text"
                placeholder="Search ticket #, table..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-xl bg-white/5 text-[10px] font-black uppercase text-white tracking-widest focus:border-brand-primary placeholder:text-text-muted transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-text-muted" />
              </span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-xl bg-white/5 text-[10px] font-black uppercase text-white tracking-widest focus:border-brand-primary appearance-none transition-all cursor-pointer"
              >
                <option value="all" className="text-slate-950 bg-white">ANY STATUS</option>
                <option value="paid" className="text-slate-950 bg-white">PAID & COMPLETED</option>
                <option value="corrected" className="text-slate-950 bg-white">AMENDED / CORRECTED</option>
                <option value="refunded" className="text-slate-950 bg-white">REFUNDED</option>
                <option value="voided" className="text-slate-950 bg-white">VOIDED</option>
              </select>
            </div>

            {/* Method Filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Calculator className="h-4 w-4 text-text-muted" />
              </span>
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-xl bg-white/5 text-[10px] font-black uppercase text-white tracking-widest focus:border-brand-primary appearance-none transition-all cursor-pointer"
              >
                <option value="all" className="text-slate-950 bg-white">ANY PAYMENT</option>
                <option value="cash" className="text-slate-950 bg-white">CASH</option>
                <option value="card" className="text-slate-950 bg-white">CARD / CHIPPIN</option>
                <option value="voucher" className="text-slate-950 bg-white">COUPON / CODES</option>
              </select>
            </div>

            {/* Date Preset Filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Clock className="h-4 w-4 text-text-muted" />
              </span>
              <select
                value={datePreset}
                onChange={e => handlePresetChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-xl bg-white/5 text-[10px] font-black uppercase text-white tracking-widest focus:border-brand-primary appearance-none transition-all cursor-pointer"
              >
                <option value="all" className="text-slate-950 bg-white">ALL TIME</option>
                <option value="today" className="text-slate-950 bg-white">TODAY</option>
                <option value="yesterday" className="text-slate-950 bg-white">YESTERDAY</option>
                <option value="last7" className="text-slate-950 bg-white">LAST 7 DAYS</option>
                <option value="last30" className="text-slate-950 bg-white">LAST 30 DAYS</option>
                <option value="custom" className="text-slate-950 bg-white">CUSTOM RANGE</option>
              </select>
            </div>

          </div>

          {/* Expanded Custom Date Picker Inputs */}
          {datePreset === 'custom' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center gap-4"
            >
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 w-full sm:w-auto">
                <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">FROM:</span>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black text-white outline-none uppercase cursor-pointer"
                />
              </div>
              <span className="text-[10px] font-black text-white/20 hidden sm:inline">TO</span>
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 w-full sm:w-auto">
                <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">TO:</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-[10px] font-black text-white outline-none uppercase cursor-pointer"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Tickets scroll area */}
        <div className="flex-1 overflow-y-auto rounded-[2rem] border border-white/5 bg-bg-card/40 shadow-inner no-scrollbar">
          {filteredTxs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
              <FileText className="w-12 h-12 text-white/10 animate-bounce" />
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                No matching archive entries found
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredTxs.map(tx => (
                <div
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className={`p-5 flex items-center justify-between transition-all cursor-pointer ${
                    selectedTx?.id === tx.id ? 'bg-brand-primary/10 border-l-4 border-brand-primary' : 'hover:bg-white/5 border-l-4 border-transparent'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white font-mono">{tx.ticketNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${
                        tx.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                        tx.status === 'corrected' ? 'bg-amber-500/10 text-amber-500' :
                        tx.status === 'refunded' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-black uppercase text-text-secondary tracking-widest">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setSelectedTx(tx); 
                        }}
                        className="text-brand-primary hover:underline font-mono bg-white/5 px-2 py-0.5 rounded text-[8px] border border-brand-primary/20 hover:border-brand-primary/50 transition-all font-black uppercase inline-flex items-center gap-1"
                        title="Click to load invoice receipt template"
                      >
                        ORD #{tx.orderId ? tx.orderId.replace('ord_', '') : tx.id.slice(-6)}
                      </button>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(tx.paidAt, 'HH:mm')}</span>
                      <span>Table {tx.tableName}</span>
                      <span>By {tx.staffName}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <p className="text-xs font-black text-white font-mono">{PricingEngine.formatCurrency(tx.totalGross)}</p>
                    <p className="text-[8px] text-text-muted font-black uppercase tracking-widest">
                      {tx.payments.cash > 0 ? 'CASH' : tx.payments.card > 0 ? 'CARD' : 'MOBILE CODE'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details/Action Panel (Right) */}
      <div className="lg:col-span-5 h-full overflow-hidden flex flex-col bg-bg-card border border-white/5 rounded-[2.5rem] shadow-2xl relative">
        {selectedTx ? (
          <div className="flex flex-col h-full overflow-hidden">
            
            {/* Detail Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Ticket Information</p>
                <h3 className="text-sm font-black text-white font-mono">{selectedTx.ticketNumber}</h3>
              </div>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-1 px-3 bg-white/5 text-[9px] font-black uppercase text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                Close
              </button>
            </div>

            {/* Scrollable details wrapper */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              
              {/* Core summary specs */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3">
                  <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest">Server</p>
                  <p className="text-[10px] font-black text-white uppercase mt-1 truncate">{selectedTx.staffName}</p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3">
                  <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest">Location</p>
                  <p className="text-[10px] font-black text-brand-primary uppercase mt-1">{selectedTx.tableName}</p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-3">
                  <p className="text-[8px] font-black text-text-secondary uppercase tracking-widest font-mono">Service Time</p>
                  <p className="text-[10px] font-black text-white uppercase mt-1">{format(selectedTx.paidAt, 'dd/MM HH:mm')}</p>
                </div>
              </div>

              {/* Thermal Print mimic display - using active customize receipt templates */}
              {previewTemplate && (
                <div className="bg-white rounded-3xl p-6 text-slate-800 shadow-md border-2 border-slate-200 overflow-x-auto max-w-full">
                  <ReceiptPreview
                    template={previewTemplate}
                    order={previewOrder}
                    staffList={staffList}
                    watermark={
                      selectedTx.status === 'voided' ? 'nosale' :
                      selectedTx.status === 'refunded' ? 'nosale' :
                      null
                    }
                  />
                </div>
              )}

              {/* Print and Email Log lists */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-white/50 tracking-widest flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" /> Receipts Distribution Logs
                </h4>
                
                <div className="bg-white/5 rounded-2xl p-4 space-y-3 divide-y divide-white/5 border border-white/5">
                  <div>
                    <p className="text-[8px] font-black uppercase text-text-secondary tracking-wider mb-2">Printouts Audit</p>
                    {printHistory.length === 0 ? (
                      <p className="text-[9px] font-bold uppercase text-text-muted">No physical reprints recorded</p>
                    ) : (
                      <div className="space-y-1.5">
                        {printHistory.map((pr, i) => (
                          <div key={i} className="flex justify-between text-[9px] font-mono text-white/80">
                            <span>{format(pr.timestamp, 'dd/MM HH:mm')} - Printed by {pr.staffName}</span>
                            <span className="text-brand-primary uppercase text-[8px] font-black">Success</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3">
                    <p className="text-[8px] font-black uppercase text-text-secondary tracking-wider mb-2">Email Dispatches</p>
                    {emailHistory.length === 0 ? (
                      <p className="text-[9px] font-bold uppercase text-text-muted">No digital emails sent</p>
                    ) : (
                      <div className="space-y-1.5">
                        {emailHistory.map((em, i) => (
                          <div key={i} className="flex justify-between text-[9px] font-mono text-white/80">
                            <span className="truncate max-w-[70%]">{format(em.timestamp, 'dd/MM HH:mm')} - Sent to {em.emailAddress}</span>
                            <span className="text-emerald-500 uppercase text-[8px] font-black">Dispatched</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {adjustments.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[8px] font-black uppercase text-red-400 tracking-wider mb-2">Invoice Amendments / Voids Audit</p>
                      <div className="space-y-2">
                        {adjustments.map((ad, i) => (
                          <div key={i} className="text-[9px] bg-white/5 border border-white/5 rounded-lg p-2 font-mono text-white/75 relative">
                            <CornerDownRight className="w-3 h-3 text-red-400 absolute left-2 top-2" />
                            <div className="pl-5 space-y-1">
                              <p className="font-extrabold text-white text-[10px] uppercase">{ad.type}</p>
                              <p className="text-[8px] text-text-secondary">BY {ad.staffName} on {format(ad.timestamp, 'dd/MM HH:mm')}</p>
                              <p className="text-[8px] italic text-brand-primary">Reason: "{ad.reason}"</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Floating operational actions toolbar */}
            <div className="p-6 border-t border-white/5 gap-3 grid grid-cols-2 bg-white/5">
              
              {/* Copy Print */}
              <button
                onClick={handleReprint}
                className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all border border-white/10"
              >
                <Printer className="w-3.5 h-3.5 text-brand-primary" />
                Reprint Ticket
              </button>

              {/* Email Receipt */}
              <button
                onClick={() => setShowEmailPrompt(true)}
                className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all border border-white/10"
              >
                <Mail className="w-3.5 h-3.5 text-brand-primary" />
                Email Receipt
              </button>

              {/* Change payment method */}
              <button
                disabled={['voided', 'refunded'].includes(selectedTx.status)}
                onClick={promptPaymentMethodCorrection}
                className="col-span-2 flex items-center justify-center gap-2 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 disabled:opacity-20 font-black uppercase text-[10px] tracking-widest rounded-xl border border-amber-500/20 transition-all font-mono"
              >
                <Calculator className="w-3.5 h-3.5" />
                Amend Payment Mode
              </button>

              {selectedTx.status !== 'voided' && selectedTx.status !== 'refunded' && (
                <>
                  <button
                    onClick={promptVoid}
                    className="flex justify-center items-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black uppercase text-[10px] tracking-widest rounded-xl border border-red-500/20 transition-all font-mono"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Void Bill
                  </button>
                  <button
                    onClick={promptRefund}
                    className="flex justify-center items-center gap-2 py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-black uppercase text-[10px] tracking-widest rounded-xl border border-orange-500/20 transition-all font-mono"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Refund Bill
                  </button>
                </>
              )}

            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
            <Layers className="w-16 h-16 text-white/5 animate-pulse" />
            <div>
              <h3 className="text-sm font-black text-white/40 uppercase tracking-widest">Select physical check</h3>
              <p className="text-[10px] uppercase font-bold text-text-muted mt-1 tracking-widest">To configure, refund, correct payment, or reprint</p>
            </div>
          </div>
        )}

        {/* Email receipt drawer */}
        <AnimatePresence>
          {showEmailPrompt && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-x-0 bottom-0 bg-bg-card border-t border-white/10 rounded-t-[2.5rem] p-6 space-y-4 shadow-2xl z-20"
            >
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black uppercase text-white tracking-widest">Email Digital Check Copy</h4>
                <button onClick={() => setShowEmailPrompt(false)} className="p-1 text-text-muted hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {emailSuccess ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-bounce">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Email Dispatched Successfully</p>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <input
                    required
                    type="email"
                    placeholder="Enter customer email address"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    className="w-full px-4 py-3 border border-white/10 rounded-xl bg-white/5 text-[10px] font-black text-white focus:border-brand-primary placeholder:text-text-muted"
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-brand-primary text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.01] transition-all"
                  >
                    Dispatch Now
                  </button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Actions overlay (void, refund, correct) to bypass window.prompt */}
        <AnimatePresence>
          {actionModal.isOpen && selectedTx && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center z-30 p-6 backdrop-blur-sm"
            >
              <div className="bg-bg-card border border-white/10 rounded-[2rem] p-6 max-w-md w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
                
                {/* Header */}
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Layers className="w-4 h-4" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-white">
                      {actionModal.type === 'void' && 'Void Current Invoice'}
                      {actionModal.type === 'refund' && 'Process Customer Refund'}
                      {actionModal.type === 'correct' && 'Amend Payment Method'}
                    </h4>
                  </div>
                  <button 
                    onClick={() => setActionModal(prev => ({ ...prev, isOpen: false }))} 
                    className="p-1 text-text-muted hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body Content */}
                <div className="space-y-4">
                  {/* VOID INPUTS */}
                  {actionModal.type === 'void' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Select Void Reason</label>
                        <select 
                          value={actionModal.reason}
                          onChange={e => setActionModal(p => ({ ...p, reason: e.target.value }))}
                          className="w-full mt-1.5 px-4 py-2 text-[10px] bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-primary cursor-pointer font-black uppercase"
                        >
                          <option value="" className="text-slate-800">Choose custom reason...</option>
                          <option value="Billing Error / Double Charge" className="text-slate-800">Billing Error / Double Charge</option>
                          <option value="Customer Dissatisfaction" className="text-slate-800">Customer Dissatisfaction</option>
                          <option value="Wrong Entry / Clerical Slip" className="text-slate-800">Wrong Entry / Clerical Slip</option>
                          <option value="Training / Testing invoice" className="text-slate-800">Training / Testing Invoice</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Custom Reason Notes</label>
                        <textarea
                          placeholder="Provide specific notes and reasons for the void request..."
                          value={actionModal.reason.startsWith("Billing") || actionModal.reason.startsWith("Customer") || actionModal.reason.startsWith("Wrong") || actionModal.reason.startsWith("Training") ? "" : actionModal.reason}
                          onChange={e => setActionModal(p => ({ ...p, reason: e.target.value }))}
                          className="w-full mt-1.5 p-3 h-20 text-[10px] bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-primary font-bold placeholder:text-text-muted"
                        />
                      </div>
                    </div>
                  )}

                  {/* REFUND INPUTS */}
                  {actionModal.type === 'refund' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Refund Operation Type</label>
                        <div className="grid grid-cols-2 gap-2 mt-1.5">
                          <button
                            type="button"
                            onClick={() => setActionModal(p => ({ ...p, refundType: 'full' }))}
                            className={`py-2 text-[9px] font-black tracking-wider uppercase rounded-xl transition-all border ${
                              actionModal.refundType === 'full' 
                                ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' 
                                : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                            }`}
                          >
                            Full Invoice Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionModal(p => ({ ...p, refundType: 'partial' }))}
                            className={`py-2 text-[9px] font-black tracking-wider uppercase rounded-xl transition-all border ${
                              actionModal.refundType === 'partial' 
                                ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' 
                                : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                            }`}
                          >
                            Select Items Refund
                          </button>
                        </div>
                      </div>

                      {/* Partial refund item selection */}
                      {actionModal.refundType === 'partial' && (
                        <div className="bg-white/5 border border-white/5 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5">
                          <p className="text-[8px] font-black uppercase text-amber-500/80 mb-1">Check items to mark for partial refund:</p>
                          {snapshot?.orderData?.items && snapshot.orderData.items.length > 0 ? (
                            snapshot.orderData.items.map((it: any) => (
                              <label key={it.uuid} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-white/5 rounded px-1 group">
                                <input
                                  type="checkbox"
                                  checked={!!actionModal.selectedItems[it.uuid]}
                                  onChange={e => setActionModal(p => ({
                                    ...p,
                                    selectedItems: { ...p.selectedItems, [it.uuid]: e.target.checked }
                                  }))}
                                  className="rounded bg-white/10 border-white/15 text-amber-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="text-[10px] text-white/80 group-hover:text-white truncate font-black">
                                  {it.quantity}x {it.snapshot?.name || 'Item'}
                                </span>
                              </label>
                            ))
                          ) : (
                            <p className="text-[9px] font-bold uppercase text-text-muted italic">No items available to check (fallback snapshot mode)</p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Adjustment Reason Justification</label>
                        <select 
                          value={actionModal.reason}
                          onChange={e => setActionModal(p => ({ ...p, reason: e.target.value }))}
                          className="w-full mt-1.5 px-4 py-2 text-[10px] bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-primary cursor-pointer font-black uppercase"
                        >
                          <option value="" className="text-slate-800">Select reason option...</option>
                          <option value="Returned Item / Defective Selection" className="text-slate-800">Returned Item / Defective Selection</option>
                          <option value="Overcharged Client Error" className="text-slate-800">Overcharged Client Error</option>
                          <option value="Customer Goodwill / Complaints resolution" className="text-slate-800">Customer Goodwill / Complaints Resolution</option>
                          <option value="Order cancelled before delivery" className="text-slate-800">Order cancelled before delivery</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Custom Notes</label>
                        <textarea
                          placeholder="Enter refund reason notes..."
                          value={actionModal.reason.startsWith("Returned") || actionModal.reason.startsWith("Overcharged") || actionModal.reason.startsWith("Customer") || actionModal.reason.startsWith("Order") ? "" : actionModal.reason}
                          onChange={e => setActionModal(p => ({ ...p, reason: e.target.value }))}
                          className="w-full mt-1.5 p-3 h-16 text-[10px] bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-primary font-bold placeholder:text-text-muted"
                        />
                      </div>
                    </div>
                  )}

                  {/* PAYMENT METHOD CORRECTION */}
                  {actionModal.type === 'correct' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Select Corrected payment Method</label>
                        <select
                          value={actionModal.correctedMethod}
                          onChange={e => setActionModal(p => ({ ...p, correctedMethod: e.target.value as any }))}
                          className="w-full mt-1.5 px-4 py-2 text-[10px] bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-primary cursor-pointer font-black uppercase"
                        >
                          <option value="cash" className="text-slate-800">CASH BILLING</option>
                          <option value="card" className="text-slate-800">CREDIT / DEBIT CARD</option>
                          <option value="voucher" className="text-slate-800">GIFT CARD / VOUCHER CODES</option>
                          <option value="complimentary" className="text-slate-800">COMPLIMENTARY WRITEOFF</option>
                          <option value="staff_meal" className="text-slate-800">STAFF INTERNAL MEAL</option>
                          <option value="bank_transfer" className="text-slate-800">DIRECT INSTANT BANK TRANSFER</option>
                          <option value="other" className="text-slate-800">OTHER SPLIT OR COMBINED METHODS</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Correction Reason Description</label>
                        <select 
                          value={actionModal.reason}
                          onChange={e => setActionModal(p => ({ ...p, reason: e.target.value }))}
                          className="w-full mt-1.5 px-4 py-2 text-[10px] bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-primary cursor-pointer font-black uppercase"
                        >
                          <option value="" className="text-slate-800">Select correction excuse...</option>
                          <option value="Server pressed wrong payment button" className="text-slate-800">Server pressed wrong payment button</option>
                          <option value="Card terminal malfunction, cash swap" className="text-slate-800">Card terminal malfunction, cash swap</option>
                          <option value="Voucher details checked and verified later" className="text-slate-800">Voucher details checked / verified later</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[8px] font-black uppercase tracking-wider text-text-secondary">Custom Explanation Notes</label>
                        <textarea
                          placeholder="Enter correction notes..."
                          value={actionModal.reason.startsWith("Server") || actionModal.reason.startsWith("Card") || actionModal.reason.startsWith("Voucher") ? "" : actionModal.reason}
                          onChange={e => setActionModal(p => ({ ...p, reason: e.target.value }))}
                          className="w-full mt-1.5 p-3 h-16 text-[10px] bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-primary font-bold placeholder:text-text-muted"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer submit block */}
                <div className="pt-2">
                  <button
                    type="button"
                    disabled={!actionModal.reason.trim()}
                    onClick={() => {
                      setActionModal(prev => ({ ...prev, isOpen: false }));
                      // Routinely trigger PIN Modal now!
                      setPinModal({
                        isOpen: true,
                        type: actionModal.type!,
                        requiredRole: actionModal.type === 'correct' ? 'supervisor' : 'manager',
                        data: {
                          reason: actionModal.reason || `${actionModal.type} authorized override`,
                          items: actionModal.type === 'refund' && actionModal.refundType === 'partial' ? 
                            Object.keys(actionModal.selectedItems).filter(uuid => actionModal.selectedItems[uuid]).map(uuid => ({ uuid, quantity: 1 })) : 
                            undefined,
                          newMethod: actionModal.correctedMethod
                        }
                      });
                    }}
                    className="w-full py-3 bg-brand-primary disabled:opacity-20 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg hover:scale-[1.01] active:scale-95 transition-all text-center"
                  >
                    Proceed to Security PIN Clearance
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pin Verification overlay banner */}
        <AnimatePresence>
          {pinModal.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center z-30 p-6 backdrop-blur-sm"
            >
              <div className="bg-bg-card border border-white/10 rounded-[2rem] p-6 max-w-sm w-full space-y-6 shadow-2xl">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Lock className="w-4 h-4" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Secured Security Clearance</h4>
                  </div>
                  <button 
                    onClick={() => {
                      setPinModal({ isOpen: false, type: 'void', requiredRole: 'manager' });
                      setPinInput('');
                    }} 
                    className="p-1 text-text-muted hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-xs font-black text-white uppercase">{pinModal.type} transaction authorize</p>
                  <p className="text-[8px] text-text-muted font-bold uppercase tracking-wider">
                    Insert standard 4 digit supervisor/manager PIN below
                  </p>
                </div>

                {pinError && (
                  <p className="p-3 bg-red-500/10 border border-red-500/15 rounded-xl text-[9px] font-black text-red-400 uppercase text-center tracking-wider">
                    {pinError}
                  </p>
                )}

                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`w-10 h-12 border-2 rounded-xl flex items-center justify-center text-lg font-black ${
                          pinInput.length > i ? 'border-brand-primary bg-brand-primary/10 text-white' : 'border-white/10 text-transparent'
                        }`}
                      >
                        {pinInput[i] || '*'}
                      </div>
                    ))}
                  </div>

                  {/* Virtual Numeric Pad */}
                  <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => pinInput.length < 4 && setPinInput(p => p + num)}
                        className="h-10 border border-white/5 bg-white/5 hover:bg-white/10 active:scale-95 text-white font-mono text-[11px] font-bold uppercase rounded-lg transition-all"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPinInput('')}
                      className="h-10 border border-white/5 bg-white/5 text-red-400 font-bold text-[8px] tracking-wider uppercase rounded-lg"
                    >
                      CLEAR
                    </button>
                    <button
                      type="button"
                      onClick={() => pinInput.length < 4 && setPinInput(p => p + '0')}
                      className="h-10 border border-white/5 bg-white/5 text-white font-mono text-[11px] font-bold rounded-lg"
                    >
                      0
                    </button>
                    <button
                      type="submit"
                      disabled={pinInput.length < 4}
                      className="h-10 bg-brand-primary text-white font-bold text-[8px] tracking-widest uppercase rounded-lg disabled:opacity-20 transition-all flex items-center justify-center gap-1"
                    >
                      OK <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
