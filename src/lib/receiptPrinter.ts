import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ReceiptTemplate } from '../types/receipt';
import { POSOrder } from '../types/pos';

export interface PrintHistoryRecord {
  printedAt: number;
  printedBy: string;
  orderId: string;
  templateId: string;
  copyType: string;
}

/**
 * Triggers the browser print modal with optimized styles for receipt widths (58mm, 80mm, or A4).
 */
export const printCustomerReceipt = async (
  orderId: string,
  template: ReceiptTemplate,
  order: POSOrder,
  currentUserId: string,
  copyType: string = 'customer_copy'
) => {
  try {
    // 1. Compile simple printable HTML layout style depending on paper size
    const paperWidth = template.paperSize === '58mm' ? '58mm' : template.paperSize === '80mm' ? '80mm' : '210mm';
    const padding = template.paperSize === 'A4' ? '1.5in' : '5mm';
    const bodyClass = template.themeMode === 'dark' ? 'bg-[#18181b] text-white' : 'bg-white text-zinc-900';
    
    // Build receipt layout HTML content matching current selections
    const addressLinesHtml = template.header.addressLines
      .map(line => `<div style="font-size: 11px; color: #666;">${line}</div>`)
      .join('');
      
    const formattedDate = new Date(order.createdAt).toLocaleDateString('en-GB');
    const formattedTime = new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    
    const itemsHtml = order.items
      .map(item => {
        const unitPrice = (item.totalPrice / 100).toFixed(2);
        const allergens = template.items.showAllergens && item.snapshot?.allergies && item.snapshot.allergies.length > 0
          ? `<div style="font-size: 9px; color: #b45309; margin-left: 10px;">ALLERGENS: ${item.snapshot.allergies.map(a => a.toUpperCase()).join(', ')}</div>`
          : '';
        const modifiers = template.items.showModifiers && item.modifiers && item.modifiers.length > 0
          ? `<div style="font-size: 9px; color: #555; margin-left: 10px;">${item.modifiers.map(m => `+ ${m.name}`).join(', ')}</div>`
          : '';
        return `
          <tr style="border-bottom: 1px dotted #ccc;">
            <td style="padding: 4px 0;">
              <strong style="color: #ea580c;">${item.quantity}x</strong> ${item.snapshot?.name || 'Item'}
              ${modifiers}
              ${allergens}
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: bold;">£${unitPrice}</td>
          </tr>
        `;
      })
      .join('');

    const subtotal = (order.subtotalGross / 100).toFixed(2);
    const serviceCharge = (order.serviceCharge / 100).toFixed(2);
    const total = (order.totalGross / 100).toFixed(2);
    const vatTotal = (order.vatTotal / 100).toFixed(2);
    const amountPaid = (order.amountPaid / 100).toFixed(2);

    const printWindowHtml = `
      <html>
        <head>
          <title>Receipt - Check #${orderId.replace('ord_', '')}</title>
          <style>
            @page {
              size: ${paperWidth} auto;
              margin: 0;
            }
            body {
              font-family: monospace;
              width: ${paperWidth};
              margin: 0 auto;
              padding: ${padding};
              font-size: ${template.fontSize === 'small' ? '10px' : template.fontSize === 'medium' ? '12px' : '14px'};
              line-height: ${template.lineSpacing === 'compact' ? '1.1' : template.lineSpacing === 'normal' ? '1.4' : '1.7'};
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .dotted-divider { border-top: 1px dashed #666; margin: 8px 0; }
            .double-divider { border-top: 3px double #333; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body class="${bodyClass}">
          <div class="center" style="margin-bottom: 10px;">
            ${template.header.showLogo && template.header.logoUrl ? `<img src="${template.header.logoUrl}" style="max-width: 100px; max-height: 100px; -webkit-filter: grayscale(100%); filter: grayscale(100%)" />` : ''}
            ${template.header.showBusinessName ? `<h2 style="margin: 5px 0;">${template.header.businessName}</h2>` : ''}
            ${addressLinesHtml}
            ${template.header.phone ? `<p style="font-size: 10px; margin: 2px 0;">Tel: ${template.header.phone}</p>` : ''}
            ${template.header.email ? `<p style="font-size: 10px; margin: 2px 0;">Email: ${template.header.email}</p>` : ''}
            ${template.header.vatNumber ? `<p style="font-size: 10px; margin: 2px 0;">VAT: ${template.header.vatNumber}</p>` : ''}
          </div>
          
          <div style="font-size: 11px;">
            <div>Date: ${formattedDate} &nbsp; Time: ${formattedTime}</div>
            <div>Bill Type: ${copyType.toUpperCase().replace('_', ' ')}</div>
            <div>Order ID: #${orderId.replace('ord_', '')}</div>
          </div>
          
          <div class="dotted-divider"></div>
          
          <table>
            <thead>
              <tr style="border-bottom: 2px dashed #000;">
                <th style="text-align: left;">Item</th>
                <th style="text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="dotted-divider"></div>
          
          <div style="font-size: 12px; margin-top: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Subtotal:</span>
              <span>£${subtotal}</span>
            </div>
            ${order.serviceCharge > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Service Charge (${template.serviceCharge.percentage}%):</span>
              <span>£${serviceCharge}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between;">
              <span>VAT included:</span>
              <span>£${vatTotal}</span>
            </div>
            
            <div class="double-divider"></div>
            
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
              <span>TOTALPAY:</span>
              <span>£${total}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: green; margin-top: 4px;">
              <span>Card Pay:</span>
              <span>£${amountPaid}</span>
            </div>
          </div>
          
          <div class="dotted-divider"></div>
          
          ${template.qrCode.enabled ? `
            <div class="center" style="margin: 15px 0;">
              <strong>${template.qrCode.title}</strong>
              <div style="font-size: 10px; color: #555; margin-bottom: 5px;">${template.qrCode.subtitle}</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(template.qrCode.customUrl || 'https://xolofood.co.uk')}" style="width: 100px; height: 100px;" />
            </div>
          ` : ''}
          
          <div class="center" style="font-size: 10px; margin-top: 15px; color: #555;">
            <p>${template.footer.thankYouMessage}</p>
            ${template.footer.reviewMessage ? `<p>${template.footer.reviewMessage}</p>` : ''}
            ${template.promoBanner.enabled ? `<p style="padding: 10px; background-color: #f3f4f6; font-weight: bold; color: black; border-radius: 4px;">${template.promoBanner.text}</p>` : ''}
            <p style="font-size: 8px; margin-top: 15px; border-top: 1px dotted #ccc; padding-top: 5px;">Powered by Backbone POS | ${copyType.toUpperCase()}</p>
          </div>
        </body>
      </html>
    `;

    // 2. Open popup blank window and write
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (printWindow) {
      printWindow.document.write(printWindowHtml);
      printWindow.document.close();
      printWindow.focus();
      // Delay slightly for render/image load
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } else {
      alert('Pop-up blocker is preventing receipt browser printing. Please enable pop-ups for Backbone POS.');
    }

    // 3. Track in Firestore under 'receiptPrintHistory'
    const record: PrintHistoryRecord = {
      printedAt: Date.now(),
      printedBy: currentUserId,
      orderId,
      templateId: template.id || 'default',
      copyType
    };
    await addDoc(collection(db, 'receiptPrintHistory'), record);

  } catch (error) {
    console.error('Failed to trigger browser printing of receipt:', error);
  }
};
