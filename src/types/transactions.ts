import { POSOrder } from './pos';
import { ReceiptTemplate } from './receipt';

export interface POSTransaction {
  id: string;
  ticketNumber: string; // e.g. CAM-2026-000001
  orderId: string;
  locationId: string;
  tableId: string;
  tableName: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  covers: number;
  status: 'paid' | 'corrected' | 'refunded' | 'voided';
  
  // Values in pence
  subtotalGross: number;
  vatTotal: number;
  serviceCharge: number;
  discountAmount: number;
  totalGross: number;
  amountPaid: number;
  changeGiven: number;
  tipsAmount: number;
  payments: {
    cash: number;
    card: number;
    deposit: number;
    voucher: number;
  };
  
  createdAt: number;
  paidAt: number;
  correctedAt?: number;
  refundedAt?: number;
  voidedAt?: number;
  zReportId?: string;
  
  isLocked: boolean; // Locked after Z-report / end of day
  snapshotId: string; // Points to TicketSnapshot
}

export interface TicketSnapshot {
  id: string;
  locationId: string;
  orderData: POSOrder;
  receiptTemplateData: ReceiptTemplate;
  createdAt: number;
}

export interface TransactionAdjustment {
  id: string;
  transactionId: string;
  locationId: string;
  timestamp: number;
  type: 'payment_correction' | 'full_refund' | 'partial_refund' | 'void';
  reason: string;
  staffId: string;
  staffName: string;
  originalData: any;
  adjustedData: any;
}

export interface ReceiptPrintHistory {
  id: string;
  transactionId: string;
  locationId: string;
  timestamp: number;
  staffId: string;
  staffName: string;
  type: 'original' | 'reprint';
  watermark: string | null;
}

export interface ReceiptEmailHistory {
  id: string;
  transactionId: string;
  locationId: string;
  timestamp: number;
  staffId: string;
  staffName: string;
  emailAddress: string;
}

export interface DailyClosureHistory {
  id: string;
  locationId: string;
  timestamp: number;
  staffId: string;
  staffName: string;
  grossSales: number;
  netSales: number;
  vatTotal: number;
  serviceChargeTotal: number;
  discountTotal: number;
  transactionsCount: number;
  coversCount: number;
}
