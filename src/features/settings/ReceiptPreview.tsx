import React from 'react';
import { ReceiptTemplate } from '../../types/receipt';
import { POSOrder, StaffProfile } from '../../types/pos';
import { cn } from '../../lib/utils';
import { usePOSStore } from '../../app/store';

interface ReceiptPreviewProps {
  template: ReceiptTemplate;
  order: POSOrder | null;
  staffList?: StaffProfile[];
  watermark?: 'reprint' | 'training' | 'nosale' | null;
  splitCustomerIndex?: number; // for split bill preview
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  template,
  order,
  staffList = [],
  watermark = null,
  splitCustomerIndex
}) => {
  const { currentStaff, tables = [] } = usePOSStore();
  
  // Resolve server name & role
  const orderStaff = React.useMemo(() => {
    if (!order) return { name: currentStaff?.name || 'Stefy I', role: currentStaff?.role || 'Waiter' };
    const found = staffList.find(s => s.id === order.staffId);
    return found 
      ? { name: found.name, role: found.role }
      : { name: 'Stefy I', role: 'waiter' };
  }, [order, staffList, currentStaff]);

  // Resolve table name
  const tableName = React.useMemo(() => {
    if (!order) return 'Table 10';
    const found = tables.find(t => t.id === order.tableId);
    return found ? found.name : `Table ${order.tableId.replace('tbl_', '')}`;
  }, [order, tables]);

  // Calculations for Order display
  const subtotal = order ? (order.subtotalGross || 0) / 100 : 77.85;
  const serviceChargeAmount = order ? (order.serviceCharge || 0) / 100 : 9.73;
  const discountAmount = order ? (order.discountAmount || 0) / 100 : 0.00;
  const vatTotal = order ? (order.vatTotal || 0) / 100 : 12.98;
  const total = order ? (order.totalGross || 0) / 100 : 87.58;
  const amountPaid = order ? (order.amountPaid || 0) / 100 : 87.58;
  const changeDue = Math.max(0, amountPaid - total);

  // Formatting currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(val);
  };

  // Safe formatting of timestamps
  const formatDate = (ts: number | undefined) => {
    if (!ts) return '04/05/2024';
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (ts: number | undefined) => {
    if (!ts) return '4:48 pm';
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Generate QR value based on settings
  const qrCodeUrl = React.useMemo(() => {
    if (!template.qrCode.enabled) return '';
    const baseUrl = template.qrCode.customUrl || 'https://xolofood.co.uk';
    switch (template.qrCode.qrType) {
      case 'payment_link':
        return order ? `https://pay.backbonepos.com/${order.id}` : baseUrl;
      case 'review_link':
        return 'https://g.page/r/backbone-review/review';
      case 'loyalty_signup':
        return 'https://loyalty.xolofood.co.uk/signup';
      case 'menu':
        return 'https://xolofood.co.uk/menu';
      case 'feedback':
        return 'https://feedback.xolofood.co.uk/pos';
      case 'custom':
      default:
        return baseUrl;
    }
  }, [template.qrCode, order]);

  // Adjust paper styling classes
  const sizeClasses = {
    '58mm': 'w-[280px] max-w-full text-[11px]',
    '80mm': 'w-[380px] max-w-full text-xs',
    'A4': 'w-[794px] max-w-full p-16 text-sm min-h-[1123px]'
  };

  const lineSpacingClasses = {
    'compact': 'leading-tight py-[1px]',
    'normal': 'leading-normal py-[3px]',
    'spacious': 'leading-relaxed py-[6px]'
  };

  const fontStyleClasses = {
    'small': 'text-[10px]' + (template.paperSize === 'A4' ? ' text-xs' : ''),
    'medium': 'text-xs' + (template.paperSize === 'A4' ? ' text-sm' : ''),
    'large': 'text-sm' + (template.paperSize === 'A4' ? ' text-base' : '')
  };

  // Render items based on settings
  const renderItemsList = () => {
    const rawItems = order ? order.items : [];
    if (rawItems.length === 0) {
      // Fallback preview placeholders
      return (
        <tr className="border-b border-dashed border-gray-300">
          <td className="text-left py-1">Sample Dinner Item</td>
          <td className="text-center">1</td>
          <td className="text-right">£15.00</td>
        </tr>
      );
    }

    // Filter out voided items if set to hide
    const itemsToRender = rawItems.filter(item => {
      if (item.status === 'voided' && !template.items.showVoidedItems) return false;
      return true;
    });

    return itemsToRender.map((item, idx) => {
      const pGross = (item.totalPrice || 0) / 100;
      const unitPrice = (item.snapshot?.priceGross || 0) / 100;
      const displayCalories = template.items.showCalories ? ' (320 kcal)' : '';
      const displayEcoScore = template.items.showSustainabilityScore ? ' [Eco: A]' : '';

      return (
        <React.Fragment key={item.uuid || idx}>
          <tr className={cn("align-top border-b border-dotted border-gray-200", lineSpacingClasses[template.lineSpacing])}>
            <td className="text-left font-mono">
              <div className="font-bold flex items-center gap-1">
                {template.items.showQuantity && (
                  <span className="text-brand-primary font-black mr-1">{item.quantity}x</span>
                )}
                {template.items.showItemName && (
                  <span>{item.snapshot?.name || 'Menu Item'}</span>
                )}
                {item.status === 'voided' && (
                  <span className="text-[10px] bg-rose-500/10 text-rose-500 px-1 py-[1px] uppercase tracking-wider rounded">Void</span>
                )}
              </div>
              
              {/* Modifiers */}
              {template.items.showModifiers && item.modifiers && item.modifiers.length > 0 && (
                <div className="text-[10px] text-gray-500 pl-4">
                  {item.modifiers.map(m => `+ ${m.name}`).join(', ')}
                </div>
              )}

              {/* Notes */}
              {template.items.showNotes && item.notes && (
                <div className="text-[10px] italic text-brand-primary-light pl-4 font-sans">
                  Note: {item.notes}
                </div>
              )}

              {/* Allergens warning */}
              {template.items.showAllergens && item.snapshot?.allergies && item.snapshot.allergies.length > 0 && (
                <div className={cn(
                  "text-[9px] pl-4 flex flex-wrap gap-1 mt-0.5",
                  template.allergensAndNotes.highlightAllergenWarnings ? "text-amber-600 font-bold" : "text-gray-500"
                )}>
                  <span>ALLERGENS:</span>
                  {item.snapshot.allergies.map(a => (
                    <span key={a} className={cn(
                      "px-1 py-[2px] bg-amber-500/5 rounded font-mono border border-amber-500/10",
                      template.allergensAndNotes.allergensInUppercase ? "uppercase" : ""
                    )}>
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {/* Course name / Category */}
              {(template.items.showCourseName && item.snapshot?.course) && (
                <div className="text-[9px] text-gray-400 uppercase tracking-widest pl-4">
                  {item.snapshot.course}
                </div>
              )}

              <div className="text-[9px] text-gray-400 pl-4 font-sans">
                {displayCalories}{displayEcoScore}
              </div>
            </td>
            
            {template.items.showPrice && (
              <td className="text-right font-mono align-middle font-bold text-gray-800">
                {formatCurrency(pGross)}
              </td>
            )}
          </tr>
        </React.Fragment>
      );
    });
  };

  return (
    <div className={cn(
      "relative font-mono transition-colors shadow-2xl p-6 mx-auto select-none border border-gray-200/50 rounded-lg",
      template.themeMode === 'dark' ? 'bg-[#18181b] text-zinc-100 border-zinc-800' : 'bg-white text-zinc-900 border-gray-200'
    )}>
      
      {/* Watermarks */}
      {watermark === 'reprint' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10 select-none">
          <div className="text-5xl font-black font-sans uppercase text-rose-500/10 border-4 border-rose-500/10 rounded-2xl px-6 py-3 -rotate-12 tracking-widest scale-125">
            REPRINT COPY
          </div>
        </div>
      )}

      {watermark === 'training' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10 select-none">
          <div className="text-4xl font-black font-sans uppercase text-yellow-500/10 border-4 border-yellow-500/10 rounded-2xl px-6 py-3 -rotate-12 tracking-widest text-center">
            TRAINING MODE<br/>
            <span className="text-xl">NOT A VALID RECEIPT</span>
          </div>
        </div>
      )}

      {watermark === 'nosale' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10 select-none">
          <div className="text-5xl font-black font-sans uppercase text-sky-500/10 border-4 border-sky-500/10 rounded-2xl px-6 py-3 -rotate-12 tracking-widest">
            NO SALE AUDIT
          </div>
        </div>
      )}

      <div className={cn("mx-auto", sizeClasses[template.paperSize], fontStyleClasses[template.fontSize])}>
        
        {/* ----------------- HEADER SECTION ----------------- */}
        <div className="text-center mb-4 space-y-1">
          {/* Logo */}
          {template.header.showLogo && template.header.logoUrl && (
            <div className={cn(
              "flex mb-3 justify-center",
              template.header.logoAlign === 'left' && "justify-start",
              template.header.logoAlign === 'right' && "justify-end"
            )}>
              <img 
                src={template.header.logoUrl} 
                alt="Business Logo" 
                referrerPolicy="no-referrer"
                style={{ width: '1800px', height: '90px' }}
                className={cn(
                  "object-cover rounded-xl filter grayscale contrast-125"
                )}
              />
            </div>
          )}

          {/* Business Name */}
          {template.header.showBusinessName && (
            <h2 className={cn(
              "font-black tracking-tight",
              template.header.businessNameFontSize === 'sm' && "text-sm",
              template.header.businessNameFontSize === 'md' && "text-base",
              template.header.businessNameFontSize === 'lg' && "text-xl",
              template.header.businessNameFontSize === 'xl' && "text-2xl"
            )}>
              {template.header.businessName || 'BACKBONE REVENUE'}
            </h2>
          )}

          {/* Address lines */}
          {template.header.addressLines.map((line, index) => (
            <p key={index} className="text-zinc-500 font-sans tracking-tight text-[11px] leading-tight">
              {line}
            </p>
          ))}

          {/* Socials / Contacts */}
          <div className="text-zinc-500 font-sans text-[10px] leading-tight flex flex-wrap justify-center gap-x-2 mt-1">
            {template.header.phone && <span>Tel: {template.header.phone}</span>}
            {template.header.email && <span>Email: {template.header.email}</span>}
          </div>

          <div className="text-zinc-500 font-sans text-[10px] leading-tight flex flex-wrap justify-center gap-x-2">
            {template.header.vatNumber && <span>VAT No: {template.header.vatNumber}</span>}
            {template.header.companyNumber && <span>Company No: {template.header.companyNumber}</span>}
          </div>

          {template.header.customHeaderText && (
            <p className="text-zinc-400 italic text-[11px] mt-2 border-y border-dashed border-zinc-200 dark:border-zinc-800 py-1 font-sans">
              "{template.header.customHeaderText}"
            </p>
          )}
        </div>

        {/* ----------------- ORDER DETAILS ----------------- */}
        <div className="border-b border-dashed border-zinc-300 dark:border-zinc-800 pb-3 mb-3 text-[11px] space-y-0.5 text-zinc-500 font-sans">
          <div className="flex justify-between">
            {template.orderDetails.showDate && (
              <span>Date: {formatDate(order?.createdAt)}</span>
            )}
            {template.orderDetails.showTime && (
              <span>Time: {formatTime(order?.createdAt)}</span>
            )}
          </div>
          
          <div className="flex justify-between">
            {template.orderDetails.showServer && (
              <span>
                Server: {orderStaff.name} 
                {template.orderDetails.showStaffRole && ` (${orderStaff.role})`}
              </span>
            )}
            {template.orderDetails.showTableNumber && (
              <span className="font-bold text-zinc-900 dark:text-white">Zone: {tableName}</span>
            )}
          </div>

          <div className="flex justify-between">
            {template.orderDetails.showCheckNumber && (
              <span>Check: #{order?.id.replace('ord_', '') || '93'}</span>
            )}
            {template.orderDetails.showGuestCount && (
              <span>Guests: {order?.covers || 4}</span>
            )}
          </div>

          {template.orderDetails.showOrderType && (
            <div className="flex justify-between">
              <span>Type: Dine-In</span>
              {template.orderDetails.showTillName && (
                <span>Till: Register A</span>
              )}
            </div>
          )}

          {template.orderDetails.showCustomerName && order?.tableId && (
            <div className="text-zinc-700 dark:text-zinc-300 font-semibold text-[10px] pt-1">
              Customer copy: Walk-in Client
            </div>
          )}
        </div>

        {/* ----------------- ITEMS LIST ----------------- */}
        <table className="w-full text-left mb-4">
          <thead>
            <tr className="border-b-2 border-dashed border-zinc-300 dark:border-zinc-700 text-xs text-zinc-400 font-bold">
              <th className="py-1 text-left font-mono uppercase tracking-wider">Item Details</th>
              <th className="py-1 text-right font-mono uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {renderItemsList()}
          </tbody>
        </table>

        {/* ----------------- TOTALS SECTION ----------------- */}
        <div className="border-t border-dashed border-zinc-300 dark:border-zinc-800 pt-3 space-y-1 text-xs">
          
          {template.totals.showSubtotal && (
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-sans">
              <span>{template.totals.labelOverrides.subtotal || 'Subtotal'}</span>
              <span className="font-mono">{formatCurrency(subtotal)}</span>
            </div>
          )}

          {template.totals.showDiscounts && discountAmount > 0 && (
            <div className="flex justify-between text-rose-500 font-sans">
              <span>Discount</span>
              <span className="font-mono">-{formatCurrency(discountAmount)}</span>
            </div>
          )}

          {template.totals.showServiceCharge && template.serviceCharge.enabled && (
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-sans">
              <span>
                {template.totals.labelOverrides.serviceCharge || 'Service Charge'} ({template.serviceCharge.percentage}%)
              </span>
              <span className="font-mono">{formatCurrency(serviceChargeAmount)}</span>
            </div>
          )}

          {template.totals.showVat && (
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400 font-sans">
              <span>{template.totals.labelOverrides.vat || 'VAT Total'} included</span>
              <span className="font-mono">{formatCurrency(vatTotal)}</span>
            </div>
          )}

          {template.totals.showGrandTotal && (
            <div className="flex justify-between text-base font-black border-y-2 border-zinc-900 border-double dark:border-white py-1.5 mt-2">
              <span className="uppercase tracking-widest">{template.totals.labelOverrides.grandTotal || 'GRAND TOTAL'}</span>
              <span className="font-mono">{formatCurrency(total)}</span>
            </div>
          )}

          {template.totals.showAmountPaid && (
            <div className="flex justify-between text-emerald-500 font-sans pt-1">
              <span>Paid Card Transaction</span>
              <span className="font-mono">{formatCurrency(amountPaid)}</span>
            </div>
          )}

          {changeDue > 0 && template.totals.showChangeDue && (
            <div className="flex justify-between text-blue-500 font-sans">
              <span>Change Returned</span>
              <span className="font-mono">{formatCurrency(changeDue)}</span>
            </div>
          )}
        </div>

        {/* ----------------- VAT BRIEF BREKADOWN ----------------- */}
        {template.vat.showVatSummary && template.vat.showVatBreakdown && (
          <div className="my-4 p-2 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1 font-bold">VAT Summary Table</div>
            <table className="w-full text-[10px] text-zinc-500">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 text-left font-bold">
                  <th>Rate</th>
                  <th>Net</th>
                  <th>VAT Amt</th>
                  <th className="text-right">Gross</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr>
                  <td>20.0%</td>
                  <td>{formatCurrency(subtotal - vatTotal)}</td>
                  <td>{formatCurrency(vatTotal)}</td>
                  <td className="text-right">{formatCurrency(subtotal)}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-[9px] text-zinc-400 italic text-center mt-1.5 font-sans">
              {template.vat.vatMessage || 'VAT included where applicable.'}
            </div>
          </div>
        )}

        {/* Service Charge Disclaimer */}
        {template.serviceCharge.enabled && template.serviceCharge.showDisclaimer && (
          <p className="text-[9px] text-zinc-400 text-center leading-relaxed font-sans px-2 mb-4">
            {template.serviceCharge.disclaimerText}
          </p>
        )}

        {/* ----------------- QR CODE SECTION ----------------- */}
        {template.qrCode.enabled && qrCodeUrl && (
          <div className="flex flex-col items-center justify-center border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-4 mb-4">
            <p className="text-[11px] font-black tracking-tight text-zinc-900 dark:text-white uppercase mb-1">
              {template.qrCode.title || 'View check & pay online'}
            </p>
            <p className="text-[9px] text-zinc-400 text-center leading-tight mb-2 font-sans">
              {template.qrCode.subtitle || 'Scan with smartphone camera to pay'}
            </p>
            
            {/* Generate high contrast micro QR image of the static/dynamic URL */}
            <div className="bg-white p-2 rounded-2xl shadow-md border border-gray-100 flex items-center justify-center">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCodeUrl)}`} 
                alt="Receipt QR Code"
                referrerPolicy="no-referrer"
                className="w-24 h-24 object-contain"
              />
            </div>
            
            {template.qrCode.showPaymentLogos && (
              <div className="flex gap-2 items-center justify-center mt-2.5 opacity-60 text-xs">
                <span className="font-bold text-[9px] text-zinc-400">ACCEPTED:</span>
                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[8px] font-sans font-extrabold text-zinc-500">APPLE PAY</span>
                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[8px] font-sans font-extrabold text-zinc-500">G_PAY</span>
                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[8px] font-sans font-extrabold text-zinc-500">VISA</span>
                <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[8px] font-sans font-extrabold text-zinc-500">MC</span>
              </div>
            )}
          </div>
        )}

        {/* ----------------- FOOTER BLOCK ----------------- */}
        <div className="text-center font-sans space-y-1.5 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-[10px] text-zinc-500 leading-tight">
          {template.footer.thankYouMessage && (
            <p className="font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">{template.footer.thankYouMessage}</p>
          )}
          {template.footer.reviewMessage && (
            <p className="italic text-zinc-500 font-medium font-sans">"{template.footer.reviewMessage}"</p>
          )}
          
          <div className="space-y-0.5 text-zinc-400 font-mono text-[9px]">
            {template.footer.socialMessage && <p>{template.footer.socialMessage}</p>}
            {template.footer.wifiDetails && <p className="font-bold text-zinc-500">WiFi: {template.footer.wifiDetails}</p>}
            {template.footer.charityMessage && <p className="italic">{template.footer.charityMessage}</p>}
          </div>

          {template.footer.refundPolicy && (
            <p className="text-[8px] text-zinc-400 leading-relaxed pt-2 border-t border-dashed border-zinc-100 dark:border-zinc-800/20">
              {template.footer.refundPolicy}
            </p>
          )}

          {/* Promo offer banners */}
          {template.promoBanner.enabled && template.promoBanner.text && (
            <div className="bg-brand-primary/10 text-brand-primary p-2.5 rounded-xl border border-brand-primary/20 text-center font-black mt-4 animate-pulse">
              🔥 SPECIAL OFFER 🔥<br/>
              <span className="text-[10px] leading-snug">{template.promoBanner.text}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
