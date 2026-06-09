export type TableStatus = 'available' | 'seated' | 'ordering' | 'fired' | 'served' | 'payment_pending' | 'closed' | 'cleaning';
export type POSOrderStatus = 'draft' | 'open' | 'sent' | 'partially_paid' | 'paid' | 'cancelled' | 'refunded';
export type POSOrderItemStatus = 'draft' | 'held' | 'fired' | 'preparing' | 'ready' | 'served' | 'voided';
export type Station = 'grill' | 'cold' | 'dessert' | 'bar' | 'pass';
export type Course = 'drinks' | 'starters' | 'tacos' | 'mains' | 'desserts' | 'sides' | 'extras';
export type PaymentMethod = 'cash' | 'card' | 'code';

export interface PaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  timestamp: number;
  staffId: string;
}

export interface StaffProfile {
  id: string;
  name: string;
  pin: string;
  role: 'waiter' | 'chef' | 'bartender' | 'supervisor' | 'manager' | 'admin';
  permissions: {
    canVoid: boolean;
    canDiscount: boolean;
    canRefund: boolean;
    canManageFloor: boolean;
  };
  isClockedIn?: boolean;
  lastClockIn?: number;
  lastClockOut?: number;
}

export interface StockRequirement {
  name: string;
  quantity: number;
  unit: string;
  cost: number; // pence
}

export interface Modifier {
  id: string;
  name: string;
  priceDelta: number;
  cost?: number; // pence
  stockRequirements?: StockRequirement[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  modifiers: Modifier[];
}

export interface MenuItemSnapshot {
  id: string;
  name: string;
  priceGross: number; // pence
  vatRate: number;
  station: Station;
  course?: Course;
  categoryId: string;
  isDrink: boolean;
  isAlcoholic?: boolean;
  modifierGroups?: ModifierGroup[];
  ingredients?: string[]; // Legacy - for UI display
  allergies?: string[];
  imageUrl?: string;
  description?: string;
  stockRequirements?: StockRequirement[]; // New - for Hub inventory tracking
  cost?: number; // Total theoretical cost (pence)
  locationId: string;
}

export type IngredientAction = 'standard' | 'no' | 'extra' | 'side';

export interface ModifierSelection {
  id: string;
  name: string;
  priceDelta: number;
  cost?: number; // pence
}

export interface CancelledSession {
  id: string;
  orderId: string;
  tableId: string;
  staffId: string;
  cancelledAt: number;
  reason: string;
  originalItemCount: number;
  originalValue: number;
  locationId: string;
}

export interface StockMovement {
  id: string;
  orderId: string;
  locationId: string;
  timestamp: number;
  items: {
    id: string;
    name: string;
    quantity: number;
  }[];
}

export interface AllergyCustomisation {
  allergen: string;
  type: 'Allergic' | 'Intolerant';
  crossContaminationOk: boolean;
}

export interface POSOrderItem {
  uuid: string;
  menuItemId: string;
  snapshot: MenuItemSnapshot;
  modifiers: ModifierSelection[];
  ingredientAdjustments?: Record<string, IngredientAction>;
  notes?: string;
  course?: Course;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number; // Calculated amount in pence
  status: POSOrderItemStatus;
  voidReason?: string;
  quantity: number;
  totalPrice: number;
  staffId: string;
  sentAt?: number;
  firedAt?: number;
  reassigned?: boolean;
  allergyCustomisations?: AllergyCustomisation[];
}

export interface POSOrder {
  id: string;
  tableId: string;
  status: POSOrderStatus;
  items: POSOrderItem[];
  subtotalGross: number;
  vatTotal: number;
  serviceCharge: number;
  totalGross: number;
  totalCost?: number; // Total COGS for the order
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  amountPaid: number;
  payments: PaymentRecord[];
  staffId: string;
  createdAt: number;
  seatedAt?: number;
  lastOrderedAt?: number;
  covers?: number;
  locationId: string;
  paidAt?: number;
  cancelledAt?: number;
  cancelledBy?: string;
  cancelReason?: string;
  firstOrderSentAt?: number;
  mainsFiredAt?: number;
  dessertsFiredAt?: number;
  paymentMethod?: PaymentMethod;
  zReportId?: string; // Links order to a specific End of Day report
  shift?: 'lunch' | 'dinner';
  lastCourseAt?: number;
  currentCourse?: Course;
}

export interface ZReportShift {
  name: 'lunch' | 'dinner';
  netSales: number;
  grossSales: number;
  covers: number;
  transactions: number;
  serviceCharge: number;
}

export interface ZReport {
  id: string;
  timestamp: number;
  staffId: string;
  staffName: string;
  netSales: number;
  grossSales: number;
  vatTotal: number;
  serviceChargeTotal: number;
  discountTotal: number;
  covers: number;
  transactions: number;
  
  payments: {
    cash: number;
    card: number;
    code: number;
  };
  
  shifts: {
    lunch: ZReportShift;
    dinner: ZReportShift;
  };

  foodSales: number;
  drinkSales: {
    alcoholic: number;
    nonAlcoholic: number;
  };
  
  topItems: {
    name: string;
    quantity: number;
    revenue: number;
  }[];

  staffPerformance: {
    [staffId: string]: {
      name: string;
      sales: number;
      serviceCharge: number;
      itemLeaderboard: { [itemName: string]: number };
    }
  };

  locationId: string;
}

export interface KDSTicketItem {
  uuid: string;
  name: string;
  quantity: number;
  modifiers: ModifierSelection[];
  notes?: string;
  course?: Course;
  status: 'held' | 'pending' | 'preparing' | 'ready' | 'served';
  startedAt?: number;
  completedAt?: number;
  priority?: boolean;
  allergyCustomisations?: AllergyCustomisation[];
}

export interface KDSTicket {
  id: string;
  orderId: string;
  tableId: string;
  tableName?: string;
  station: 'kitchen' | 'bar';
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'bumped';
  items: KDSTicketItem[];
  priority?: boolean;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  bumpedAt?: number;
  locationId: string;
}

export type TableShape = 'square' | 'round' | 'booth';

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  currentOrderId?: string;
  guestCount: number;
  zoneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: TableShape;
  seatedAt?: number;
  locationId: string;
}

export interface Zone {
  id: string;
  name: string;
}

export interface ShiftBriefing {
  id: string;
  date: string;
  locationId: string;
  focusOfDay: string;
  message: string;
  items86: string[];
  specials: string[];
  challenges: string[];
  managerAlerts: string[];
  targets: {
    individual: {
      salesTarget: number;
      dessertTarget: number;
      cocktailTarget: number;
    };
    floor: {
      totalSalesTarget: number;
      dessertTarget: number;
    };
    bar: {
      cocktailTarget: number;
      premiumDrinkTarget: number;
    };
    kitchen: {
      avgPrepTimeTarget: number;
    };
  };
  active: boolean;
  createdAt: number;
}

export interface BriefingAcknowledgement {
  id: string;
  staffId: string;
  staffName: string;
  role: string;
  briefingId: string;
  acknowledgedAt: number;
  locationId: string;
}

export interface POSAlert {
  id: string;
  locationId: string;
  message: string;
  priority: 'info' | 'warning' | 'urgent';
  targetRole: 'all' | 'waiter' | 'bartender' | 'chef' | 'manager';
  active: boolean;
  createdAt: number;
}
