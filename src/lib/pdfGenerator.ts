import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { POSTransaction, TicketSnapshot } from '../types/transactions';
import { PricingEngine } from '../domain/PricingEngine';

export const generateReceiptPDF = (
  transaction: POSTransaction,
  snapshot: TicketSnapshot,
  isReprint = false,
  watermarkText: string | null = null
) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 297] // 80mm thermal roll format, height can expand as needed
  });

  const { orderData, receiptTemplateData } = snapshot;
  const header = receiptTemplateData.header;
  const totals = receiptTemplateData.totals;
  const itemsCfg = receiptTemplateData.items;
  const footerCfg = receiptTemplateData.footer;

  let y = 10;
  const margin = 5;
  const width = 70; // Printable area width
  const center = 40;

  doc.setFont('courier', 'normal');

  // Add Reprint Watermark Header
  if (isReprint || watermarkText) {
    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    doc.text(`*** ${watermarkText || 'REPRINT COPY'} ***`, center, y, { align: 'center' });
    y += 6;
  }

  // Business Name
  if (header.showBusinessName && header.businessName) {
    doc.setFontSize(12);
    doc.setFont('courier', 'bold');
    doc.text(header.businessName.toUpperCase(), center, y, { align: 'center' });
    y += 6;
  }

  doc.setFontSize(7);
  doc.setFont('courier', 'normal');

  // Custom Header Text
  if (header.customHeaderText) {
    const splitHeader = doc.splitTextToSize(header.customHeaderText, width);
    splitHeader.forEach((line: string) => {
      doc.text(line, center, y, { align: 'center' });
      y += 3.5;
    });
    y += 1.5;
  }

  // Address Lines
  if (header.addressLines && header.addressLines.length > 0) {
    header.addressLines.forEach((line: string) => {
      doc.text(line, center, y, { align: 'center' });
      y += 3.5;
    });
  }

  // VAT & Company details
  if (header.vatNumber) {
    doc.text(`VAT: ${header.vatNumber}`, center, y, { align: 'center' });
    y += 3.5;
  }
  if (header.companyNumber) {
    doc.text(`Co. Reg: ${header.companyNumber}`, center, y, { align: 'center' });
    y += 3.5;
  }

  y += 3;
  // Dotted Line Separator
  doc.text('-'.repeat(38), margin, y);
  y += 4;

  // Metadata Block
  doc.setFont('courier', 'bold');
  doc.text(`TICKET #: ${transaction.ticketNumber}`, margin, y);
  y += 3.5;
  doc.setFont('courier', 'normal');

  if (receiptTemplateData.orderDetails.showServer) {
    const roleLabel = receiptTemplateData.orderDetails.showStaffRole ? ` (${transaction.staffRole.toUpperCase()})` : '';
    doc.text(`SERVER   : ${transaction.staffName}${roleLabel}`, margin, y);
    y += 3.5;
  }

  if (receiptTemplateData.orderDetails.showTableNumber) {
    doc.text(`TABLE    : ${transaction.tableName}`, margin, y);
    y += 3.5;
  }

  if (receiptTemplateData.orderDetails.showGuestCount) {
    doc.text(`GUESTS   : ${transaction.covers}`, margin, y);
    y += 3.5;
  }

  const dateStr = format(new Date(transaction.paidAt), 'dd/MM/yyyy');
  const timeStr = format(new Date(transaction.paidAt), 'HH:mm:ss');
  doc.text(`DATE/TIME: ${dateStr} ${timeStr}`, margin, y);
  y += 4;

  // Header separator
  doc.text('-'.repeat(38), margin, y);
  y += 4;

  // Items Header
  doc.setFont('courier', 'bold');
  doc.text('ITEM', margin, y);
  doc.text('QTY', margin + 44, y);
  doc.text('PRICE', margin + 56, y, { align: 'center' });
  doc.text('TOTAL', margin + 70, y, { align: 'right' });
  y += 3.5;
  doc.text('='.repeat(38), margin, y);
  y += 4;
  doc.setFont('courier', 'normal');

  // Items List
  const itemsToRender = orderData.items || [];
  itemsToRender.forEach((item) => {
    if (item.status === 'voided' && !itemsCfg.showVoidedItems) return;

    const name = item.snapshot?.name || 'Unknown Item';
    const statusPrefix = item.status === 'voided' ? '[VOIDED] ' : '';
    const cleanName = `${statusPrefix}${name}`.toUpperCase();

    // Check line wrapping for item name
    const splitName = doc.splitTextToSize(cleanName, 42);
    const lineCount = splitName.length;

    // Item line content
    const qty = String(item.quantity);
    const unitPrice = PricingEngine.formatCurrency(item.status === 'voided' ? 0 : item.totalPrice / item.quantity);
    const itemTotal = PricingEngine.formatCurrency(item.status === 'voided' ? 0 : item.totalPrice);

    splitName.forEach((line: string, index: number) => {
      doc.text(line, margin, y);
      if (index === 0) {
        doc.text(qty, margin + 44, y);
        doc.text(unitPrice, margin + 56, y, { align: 'center' });
        doc.text(itemTotal, margin + 70, y, { align: 'right' });
      }
      y += 3.5;
    });

    // Modifiers & Add-ons
    if (itemsCfg.showModifiers && item.modifiers && item.modifiers.length > 0) {
      item.modifiers.forEach((mod) => {
        const modName = ` + ${mod.name}`.toUpperCase();
        const modPrice = PricingEngine.formatCurrency(mod.priceDelta || 0);
        doc.text(modName, margin + 2, y);
        doc.text(modPrice, margin + 70, y, { align: 'right' });
        y += 3.5;
      });
    }

    // Allergens details
    if (itemsCfg.showAllergens && item.snapshot?.allergies && item.snapshot.allergies.length > 0) {
      const allergenLabel = ` * ALLERGENS: ${item.snapshot.allergies.join(', ').toUpperCase()}`;
      const splitAllergen = doc.splitTextToSize(allergenLabel, width - 4);
      splitAllergen.forEach((line: string) => {
        doc.text(line, margin + 2, y);
        y += 3.5;
      });
    }

    // Item notes or kitchen warnings
    if (itemsCfg.showNotes && item.notes) {
      const noteLabel = ` * NOTE: "${item.notes}"`;
      const splitNote = doc.splitTextToSize(noteLabel, width - 4);
      splitNote.forEach((line: string) => {
        doc.text(line, margin + 2, y);
        y += 3.5;
      });
    }
    
    y += 1.5;
  });

  // Totals Divider
  doc.text('-'.repeat(38), margin, y);
  y += 4;

  // Subtotal
  if (totals.showSubtotal) {
    doc.text(totals.labelOverrides?.subtotal || 'SUBTOTAL', margin, y);
    doc.text(PricingEngine.formatCurrency(transaction.subtotalGross), margin + 70, y, { align: 'right' });
    y += 3.5;
  }

  // Discounts
  if (totals.showDiscounts && transaction.discountAmount > 0) {
    doc.text('DISCOUNTS', margin, y);
    doc.text(`-${PricingEngine.formatCurrency(transaction.discountAmount)}`, margin + 70, y, { align: 'right' });
    y += 3.5;
  }

  // Service Charge
  if (totals.showServiceCharge && transaction.serviceCharge > 0) {
    doc.text(totals.labelOverrides?.serviceCharge || 'SERVICE CHARGE', margin, y);
    doc.text(PricingEngine.formatCurrency(transaction.serviceCharge), margin + 70, y, { align: 'right' });
    y += 3.5;
  }

  // Tips Amount
  if (totals.showTips && transaction.tipsAmount > 0) {
    doc.text('TIPS RECEIVED', margin, y);
    doc.text(PricingEngine.formatCurrency(transaction.tipsAmount), margin + 70, y, { align: 'right' });
    y += 3.5;
  }

  // Grand Total
  if (totals.showGrandTotal) {
    doc.setFont('courier', 'bold');
    doc.text(totals.labelOverrides?.grandTotal || 'GRAND TOTAL', margin, y);
    doc.text(PricingEngine.formatCurrency(transaction.totalGross), margin + 70, y, { align: 'right' });
    doc.setFont('courier', 'normal');
    y += 4.5;
  }

  // Divider
  doc.text('-'.repeat(38), margin, y);
  y += 4;

  // VAT Table Explanation
  if (totals.showVat) {
    doc.setFont('courier', 'bold');
    doc.text('VAT BREAKDOWN', margin, y);
    y += 3.5;
    doc.setFont('courier', 'normal');
    doc.text('RATE       NET         VAT        GROSS', margin, y);
    y += 3.5;

    // Calculate rates
    const standardVat = transaction.vatTotal;
    const vatRate = 20; // Default VAT tax rate
    const vatNet = transaction.subtotalGross / (1 + vatRate / 100);
    const vatCalculated = transaction.subtotalGross - vatNet;

    doc.text(`${vatRate}%        ${PricingEngine.formatCurrency(vatNet)}   ${PricingEngine.formatCurrency(vatCalculated)}   ${PricingEngine.formatCurrency(transaction.subtotalGross)}`, margin, y);
    y += 4;
    doc.text('-'.repeat(38), margin, y);
    y += 4;
  }

  // Payment Breakdown
  doc.text('PAYMENTS RECEIVED:', margin, y);
  y += 3.5;
  if (transaction.payments.cash > 0) {
    doc.text(` * CASH PAYMENT:`, margin + 2, y);
    doc.text(PricingEngine.formatCurrency(transaction.payments.cash), margin + 70, y, { align: 'right' });
    y += 3.5;
  }
  if (transaction.payments.card > 0) {
    doc.text(` * CARD CARD   :`, margin + 2, y);
    doc.text(PricingEngine.formatCurrency(transaction.payments.card), margin + 70, y, { align: 'right' });
    y += 3.5;
  }
  if (transaction.payments.voucher > 0) {
    doc.text(` * DIGITAL CORE:`, margin + 2, y);
    doc.text(PricingEngine.formatCurrency(transaction.payments.voucher), margin + 70, y, { align: 'right' });
    y += 3.5;
  }
  if (transaction.changeGiven > 0) {
    doc.text(` * CHANGE RETURNED:`, margin + 2, y);
    doc.text(PricingEngine.formatCurrency(transaction.changeGiven), margin + 70, y, { align: 'right' });
    y += 3.5;
  }

  y += 4;
  doc.text('='.repeat(38), margin, y);
  y += 4.5;

  // Footer messages
  if (footerCfg.thankYouMessage) {
    const splitThank = doc.splitTextToSize(footerCfg.thankYouMessage, width);
    splitThank.forEach((line: string) => {
      doc.text(line, center, y, { align: 'center' });
      y += 3.5;
    });
  }

  if (footerCfg.reviewMessage) {
    const splitReview = doc.splitTextToSize(footerCfg.reviewMessage, width);
    splitReview.forEach((line: string) => {
      doc.text(line, center, y, { align: 'center' });
      y += 3.5;
    });
  }

  if (footerCfg.socialMessage) {
    const splitSocial = doc.splitTextToSize(footerCfg.socialMessage, width);
    splitSocial.forEach((line: string) => {
      doc.text(line, center, y, { align: 'center' });
      y += 3.5;
    });
  }

  if (footerCfg.wifiDetails) {
    doc.text(`WiFi ID/PWD: ${footerCfg.wifiDetails}`, center, y, { align: 'center' });
    y += 3.5;
  }

  if (footerCfg.refundPolicy) {
    y += 2;
    const splitPolicy = doc.splitTextToSize(footerCfg.refundPolicy, width);
    splitPolicy.forEach((line: string) => {
      doc.text(line, center, y, { align: 'center' });
      y += 3.5;
    });
  }

  doc.text('-'.repeat(38), margin, y);
  y += 3.5;
  doc.text(`*** END OF RECEIPT ***`, center, y, { align: 'center' });

  doc.save(`RECEIPT_${transaction.ticketNumber}.pdf`);
};
