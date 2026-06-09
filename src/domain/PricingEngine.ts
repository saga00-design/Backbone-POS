import { POSOrderItem, ModifierSelection } from '../types/pos';
import { POS_CONFIG } from '../app/config';

export const PricingEngine = {
  /**
   * Calculates the total for a single item including modifiers and discounts
   */
  calculateItemTotal: (basePrice: number, modifiers: ModifierSelection[], quantity: number, discountType?: 'percentage' | 'fixed', discountValue?: number): { totalPrice: number, discountAmount: number } => {
    const modsTotal = modifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const subtotal = (basePrice + modsTotal) * quantity;
    
    let discountAmount = 0;
    if (discountType === 'percentage' && discountValue) {
      discountAmount = Math.round(subtotal * (discountValue / 100));
    } else if (discountType === 'fixed' && discountValue) {
      discountAmount = discountValue;
    }
    
    return { 
      totalPrice: Math.max(0, subtotal - discountAmount), 
      discountAmount 
    };
  },

  /**
   * Extracts VAT from a gross amount (UK 20% standard)
   */
  extractVat: (gross: number): number => {
    const rate = POS_CONFIG.DEFAULT_VAT_RATE;
    return Math.round(gross - (gross / (1 + rate / 100)));
  },

  /**
   * Formats pence into GBP string
   */
  formatCurrency: (pence: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(pence / 100);
  },

  /**
   * Calculates gross total for a single line item
   */
  calculateItemGross: (base: number, modifierTotal: number, qty: number): number => {
    return (base + modifierTotal) * qty;
  },

  /**
   * Calculates order subtotal from line totals
   */
  calculateOrderSubtotalGross: (lineTotals: number[]): number => {
    return lineTotals.reduce((sum, val) => sum + val, 0);
  },

  /**
   * Calculates total VAT for the order
   */
  calculateOrderVatTotal: (lineTotals: number[], vatRates: number[]): number => {
    return lineTotals.reduce((sum, gross, idx) => {
      const rate = vatRates[idx] || 20;
      // VAT = Gross - (Gross / (1 + rate/100))
      return sum + Math.round(gross - (gross / (1 + rate / 100)));
    }, 0);
  },

  /**
   * Calculates service charge (12.5%)
   */
  calculateServiceCharge: (subtotalGross: number, isApplied: boolean): number => {
    return isApplied ? Math.round(subtotalGross * POS_CONFIG.SERVICE_CHARGE_RATE) : 0;
  },

  /**
   * Calculates grand total
   */
  calculateGrandTotalGross: (subtotalGross: number, serviceCharge: number): number => {
    return subtotalGross + serviceCharge;
  },

  /**
   * Calculates comprehensive order totals
   */
  calculateOrderTotals: (items: POSOrderItem[], orderDiscountType?: 'percentage' | 'fixed', orderDiscountValue?: number) => {
    const activeItems = items.filter(i => i.status !== 'voided');
    
    // 1. Gross Subtotal: sum of all items at original menu price (incl. modifiers)
    const grossSubtotal = activeItems.reduce((acc, i) => {
      const dbPrice = i.snapshot.priceGross || 0;
      const modifiersDelta = i.modifiers.reduce((sum, m) => sum + m.priceDelta, 0);
      return acc + (dbPrice + modifiersDelta) * i.quantity;
    }, 0);

    // 2. Item-level discounts
    const itemDiscounts = activeItems.reduce((acc, i) => acc + (i.discountAmount || 0), 0);
    const amountAfterItemDiscounts = Math.max(0, grossSubtotal - itemDiscounts);

    // 3. Order-level discount (calculated on the remainder)
    let orderDiscountAmount = 0;
    if (orderDiscountType === 'percentage' && orderDiscountValue) {
      orderDiscountAmount = Math.round(amountAfterItemDiscounts * (orderDiscountValue / 100));
    } else if (orderDiscountType === 'fixed' && orderDiscountValue) {
      orderDiscountAmount = orderDiscountValue;
    }

    // 4. Final Totals
    const totalDiscounts = itemDiscounts + orderDiscountAmount;
    const netSubtotal = Math.max(0, grossSubtotal - totalDiscounts);
    
    // 5. VAT (calculated on the net price)
    const vatTotal = activeItems.reduce((acc, i) => {
      const rate = i.snapshot.vatRate || POS_CONFIG.DEFAULT_VAT_RATE;
      const itemGross = (i.snapshot.priceGross + i.modifiers.reduce((s, m) => s + m.priceDelta, 0)) * i.quantity;
      const itemDiscount = i.discountAmount || 0;
      // Pro-rate order discount across items for accurate VAT?
      // Simplifying: use the ratio of (netSubtotal / grossSubtotal) to get rough VAT
      const ratio = grossSubtotal > 0 ? (netSubtotal / grossSubtotal) : 0;
      const itemNetTotal = itemGross * ratio;
      return acc + (itemNetTotal * (rate / (100 + rate)));
    }, 0);

    const serviceCharge = Math.round(netSubtotal * POS_CONFIG.SERVICE_CHARGE_RATE);
    const totalGross = netSubtotal + serviceCharge;

    // 6. Cost Calculation (COGS)
    const totalCost = activeItems.reduce((acc, i) => {
      const baseCost = i.snapshot.cost || 0;
      const modifiersCost = i.modifiers.reduce((sum, m) => sum + (m.cost || 0), 0);
      return acc + (baseCost + modifiersCost) * i.quantity;
    }, 0);

    return {
      subtotalGross: grossSubtotal - vatTotal, // Showing Exc. VAT Subtotal as per user UI
      vatTotal,
      discountAmount: totalDiscounts,
      serviceCharge,
      totalGross,
      totalCost
    };
  },

  /**
   * Calculates theoretical stock usage based on recipes and adjustments
   */
  calculateStockDeductions: (items: POSOrderItem[]) => {
    const deductions: Record<string, { name: string, quantity: number, unit: string }> = {};
    const activeItems = items.filter(i => i.status !== 'voided');

    activeItems.forEach(item => {
      // 1. Base Item Requirements
      item.snapshot.stockRequirements?.forEach(req => {
        const adjustment = item.ingredientAdjustments?.[req.name] || 'standard';
        let multiplier = 1;
        
        if (adjustment === 'no') multiplier = 0;
        else if (adjustment === 'extra') multiplier = 2;
        // 'side' or 'standard' stays at 1 for deduction purposes usually, 
        // unless you want to track containers for 'side'.

        const key = `${req.name}_${req.unit}`;
        if (!deductions[key]) {
          deductions[key] = { name: req.name, quantity: 0, unit: req.unit };
        }
        deductions[key].quantity += (req.quantity * multiplier) * item.quantity;
      });

      // 2. Modifier Requirements
      item.modifiers.forEach(sel => {
        // Find modifier definition in snapshot to get its specific stock needs
        const modDef = item.snapshot.modifierGroups
          ?.flatMap(g => g.modifiers)
          .find(m => m.id === sel.id);
        
        modDef?.stockRequirements?.forEach(req => {
          const key = `${req.name}_${req.unit}`;
          if (!deductions[key]) {
            deductions[key] = { name: req.name, quantity: 0, unit: req.unit };
          }
          deductions[key].quantity += req.quantity * item.quantity;
        });
      });
    });

    return Object.values(deductions);
  },

  /**
   * Calculates balance remaining
   */
  calculateBalanceRemaining: (totalGross: number, amountPaid: number): number => {
    return Math.max(0, totalGross - amountPaid);
  }
};
