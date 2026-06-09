import { create } from 'zustand';
import { StaffProfile, POSOrder, Table, POSOrderItem, MenuItemSnapshot, Zone, PaymentMethod, POSOrderItemStatus, TableShape, PaymentRecord, ZReport, Course, ModifierGroup, KDSTicket, KDSTicketItem, ShiftBriefing, BriefingAcknowledgement, POSAlert, CancelledSession, StockMovement } from '../types/pos';
import { POSTransaction } from '../types/transactions';
import { PricingEngine } from '../domain/PricingEngine';
import { db, auth } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, addDoc, getDoc, writeBatch, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { sanitizeForFirestore } from '../lib/utils';
import { POS_CONFIG } from './config';
import { getDefaultReceiptTemplate } from '../features/settings/receiptDefaults';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ServerAlert {
  id: string;
  type: 'READY' | 'DELAY_DRINKS' | 'DELAY_FOOD' | 'PACING';
  message: string;
  tableId: string;
  tableName: string;
  createdAt: number;
  orderId: string;
}

export interface POSState {
  // Auth
  currentStaff: StaffProfile | null;
  setStaff: (staff: StaffProfile | null) => void;
  
  // Alerts
  activeAlerts: ServerAlert[];
  dismissAlert: (alertId: string) => void;
  posAlerts: POSAlert[];
  setPOSAlerts: (alerts: POSAlert[]) => void;
  
  // Briefings
  activeBriefing: ShiftBriefing | null;
  setActiveBriefing: (briefing: ShiftBriefing | null) => void;
  acknowledgements: BriefingAcknowledgement[];
  setAcknowledgements: (acks: BriefingAcknowledgement[]) => void;
  acknowledgeBriefing: (briefingId: string) => Promise<void>;
  isBriefingAcknowledged: (briefingId: string, staffId: string) => boolean;

  // Navigation
  activeScreen: 'floor' | 'order' | 'kds' | 'kds_dual' | 'kitchen_kds' | 'bar_kds' | 'expo' | 'payments' | 'settings' | 'reporting' | 'menu' | 'performance';
  setActiveScreen: (screen: POSState['activeScreen']) => void;
  
  // Master Data (Synced from Firestore)
  menuItems: MenuItemSnapshot[];
  setMenuItems: (items: MenuItemSnapshot[]) => void;
  categories: { id: string; name: string; order: number }[];
  setCategories: (categories: { id: string; name: string; order: number }[]) => void;
  zones: Zone[];
  setZones: (zones: Zone[]) => void;
  addZone: (name: string) => Promise<void>;
  tables: Table[];
  setTables: (tables: Table[]) => void;
  modifierGroups: ModifierGroup[];
  setModifierGroups: (groups: ModifierGroup[]) => void;
  staffList: StaffProfile[];
  setStaffList: (staff: StaffProfile[]) => void;
  addStaff: (staff: Omit<StaffProfile, 'id'>) => Promise<void>;
  updateStaff: (id: string, updates: Partial<StaffProfile>) => Promise<void>;
  clockIn: (staffId: string) => Promise<void>;
  clockOut: (staffId: string) => Promise<void>;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  
  // Historical Data for Reporting
  allOrders: POSOrder[];
  setAllOrders: (orders: POSOrder[]) => void;
  kdsHistory: any[];
  setKdsHistory: (history: any[]) => void;
  kdsTickets: KDSTicket[];
  setKdsTickets: (tickets: KDSTicket[]) => void;
  barKdsTickets: KDSTicket[];
  setBarKdsTickets: (tickets: KDSTicket[]) => void;
  
  // Active Context
  activeTable: Table | null;
  setActiveTable: (table: Table | null) => void;
  activeOrder: POSOrder | null;
  setActiveOrder: (order: POSOrder | null) => void;
  
  // Order Actions
  addItem: (item: Omit<POSOrderItem, 'uuid' | 'totalPrice'>) => Promise<void>;
  removeItem: (uuid: string) => Promise<void>;
  updateQuantity: (uuid: string, delta: number) => Promise<void>;
  updateItemInOrder: (uuid: string, updates: Partial<POSOrderItem>) => Promise<void>;
  applyOrderDiscount: (discountType: 'percentage' | 'fixed' | null, discountValue: number) => Promise<void>;
  voidItem: (uuid: string, reason: string) => Promise<void>;
  transferItem: (uuid: string, targetTableId: string) => Promise<void>;
  sendOrder: () => Promise<void>;
  cancelSession: (reason: string) => Promise<void>;
  
  // Payment Actions
  processPayment: (amount: number, method: PaymentMethod) => Promise<void>;
  
  // KDS Actions
  updateKdsTicketStatus: (ticketId: string, station: 'kitchen' | 'bar', status: 'pending' | 'preparing' | 'ready' | 'served' | 'bumped') => Promise<void>;
  updateKdsItemStatus: (ticketId: string, station: 'kitchen' | 'bar', itemUuid: string, status: 'pending' | 'preparing' | 'ready' | 'served' | 'bumped') => Promise<void>;
  fireCourse: (orderId: string, course: Course) => Promise<void>;
  serveOrder: (orderId: string) => Promise<void>;
  
  // Floor Plan Editor Actions
  addTable: (zoneId: string, shape?: TableShape) => Promise<void>;
  copyTable: (tableId: string) => Promise<void>;
  updateTable: (tableId: string, updates: Partial<Table>) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
  seatTable: (tableId: string, covers: number) => Promise<void>;
  toggleDesignMode: () => void;
  isDesignMode: boolean;
  syncFromHub: () => Promise<void>;
  performEndOfDay: () => Promise<ZReport | null>;
  
  // Performance
  getPersonalStats: (staffId: string) => any;
  getLeaderboards: () => any;
  
  // Multi-Location
  currentLocationId: string;
  setCurrentLocationId: (id: string) => void;

  // New Audit & Stock state
  cancelledSessions: CancelledSession[];
  setCancelledSessions: (sessions: CancelledSession[]) => void;
  stockMovements: StockMovement[];
  setStockMovements: (movements: StockMovement[]) => void;
  quizSubmissions: any[];
  setQuizSubmissions: (submissions: any[]) => void;

  // Transaction System State & Actions
  allTransactions: POSTransaction[];
  setAllTransactions: (transactions: POSTransaction[]) => void;
  refundTransaction: (transactionId: string, staffId: string, reason: string, refundItems?: { uuid: string; quantity: number }[]) => Promise<void>;
  voidTransaction: (transactionId: string, staffId: string, reason: string) => Promise<void>;
  correctPaymentMethod: (transactionId: string, staffId: string, newMethod: 'cash' | 'card' | 'code', reason: string) => Promise<void>;
}

export const resolveCourseForItem = (item: MenuItemSnapshot | undefined, categoriesList: any[] = []): Course => {
  if (!item) return 'mains';
  
  // Try checking itemType or isExtra
  if ((item as any).itemType === 'extra' || (item as any).isExtra) return 'extras';

  const catId = item.categoryId || '';
  const categoryDoc = categoriesList.find(c => c.id === catId);
  const catName = (item as any).categoryName || categoryDoc?.name || catId || '';
  
  const fieldsToCheck = [
    catName,
    (item as any).courseName || '',
    (item as any).menuSection || '',
    catId
  ];

  const matchCourse = (text: string): Course | null => {
    const t = text.toLowerCase();
    if (t.includes('drink')) return 'drinks';
    if (t.includes('starter')) return 'starters';
    if (t.includes('taco')) return 'tacos';
    if (t.includes('main')) return 'mains';
    if (t.includes('dessert')) return 'desserts';
    if (t.includes('side')) return 'sides';
    if (t.includes('extra')) return 'extras';
    return null;
  };

  for (const field of fieldsToCheck) {
    const matched = matchCourse(field);
    if (matched) return matched;
  }

  if (item.isDrink) return 'drinks';
  
  return 'mains';
};

export const usePOSStore = create<POSState>((set, get) => ({
  currentLocationId: POS_CONFIG.LOCATION_ID,
  setCurrentLocationId: (id) => set({ currentLocationId: id }),
  cancelledSessions: [],
  setCancelledSessions: (cancelledSessions) => set({ cancelledSessions }),
  stockMovements: [],
  setStockMovements: (stockMovements) => set({ stockMovements }),
  quizSubmissions: [],
  setQuizSubmissions: (quizSubmissions) => set({ quizSubmissions }),
  allTransactions: [],
  setAllTransactions: (allTransactions) => set({ allTransactions }),
  activeAlerts: [],
  dismissAlert: (alertId) => {
    set(state => ({ activeAlerts: state.activeAlerts.filter(a => a.id !== alertId) }));
  },
  posAlerts: [],
  setPOSAlerts: (posAlerts) => set({ posAlerts }),

  activeBriefing: null,
  setActiveBriefing: (activeBriefing) => set({ activeBriefing }),
  acknowledgements: [],
  setAcknowledgements: (acknowledgements) => set({ acknowledgements }),
  acknowledgeBriefing: async (briefingId) => {
    const state = get();
    if (!state.currentStaff || !briefingId) return;
    
    const ack: Omit<BriefingAcknowledgement, 'id'> = {
      staffId: state.currentStaff.id,
      staffName: state.currentStaff.name,
      role: state.currentStaff.role,
      briefingId,
      acknowledgedAt: Date.now(),
      locationId: POS_CONFIG.LOCATION_ID
    };

    try {
      await addDoc(collection(db, 'briefingAcknowledgements'), sanitizeForFirestore(ack));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'briefingAcknowledgements');
    }
  },
  isBriefingAcknowledged: (briefingId, staffId) => {
    const state = get();
    const staff = state.staffList.find(s => s.id === staffId);
    const briefing = state.activeBriefing;
    
    // If no briefing or no staff, not acknowledged
    if (!briefing || !staff) return false;

    const lastClockIn = staff?.lastClockIn || 0;
    const briefingCreatedAt = briefing?.createdAt || 0;
    
    // An acknowledgement is valid if:
    // 1. It matches briefing/staff
    // 2. It happened AFTER the current briefing was created
    // 3. It happened AFTER the user clocked in (this shift)
    return state.acknowledgements.some(a => 
      a.briefingId === briefingId && 
      a.staffId === staffId && 
      a.acknowledgedAt > briefingCreatedAt &&
      a.acknowledgedAt > lastClockIn
    );
  },
  
  currentStaff: null,
  setStaff: (staff) => set({ currentStaff: staff }),
  
  activeScreen: 'floor',
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  
  menuItems: [],
  setMenuItems: (items) => set({ menuItems: items }),
  categories: [],
  setCategories: (categories) => set({ categories }),
  zones: [],
  setZones: (zones) => set({ zones }),
  addZone: async (name) => {
    try {
      await addDoc(collection(db, 'zones'), sanitizeForFirestore({ name, locationId: POS_CONFIG.LOCATION_ID }));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'zones');
    }
  },
  tables: [],
  setTables: (tables) => set({ tables }),
  modifierGroups: [],
  setModifierGroups: (modifierGroups) => set({ modifierGroups }),
  staffList: [],
  setStaffList: (staffList) => set({ staffList }),
  addStaff: async (staffData) => {
    try {
      const id = `staff_${Math.random().toString(36).substring(7)}`;
      const newStaff = { ...staffData, id };
      await setDoc(doc(db, 'staffProfiles', id), sanitizeForFirestore(newStaff));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'staffProfiles');
    }
  },
  updateStaff: async (id, updates) => {
    try {
      await updateDoc(doc(db, 'staffProfiles', id), sanitizeForFirestore(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staffProfiles/${id}`);
    }
  },
  clockIn: async (staffId) => {
    try {
      const staff = get().staffList.find(s => s.id === staffId);
      if (!staff) return;
      
      const updates = { 
        isClockedIn: true, 
        lastClockIn: Date.now() 
      };
      
      await updateDoc(doc(db, 'staffProfiles', staffId), sanitizeForFirestore(updates));
      
      // Update local state immediately
      const updatedStaffList = get().staffList.map(s => s.id === staffId ? { ...s, ...updates } : s);
      set({ staffList: updatedStaffList });
      
      const currentStaff = get().currentStaff;
      if (currentStaff && currentStaff.id === staffId) {
        set({ currentStaff: { ...currentStaff, ...updates } });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staffProfiles/${staffId}/clock-in`);
    }
  },
  clockOut: async (staffId) => {
    try {
      const updates = { 
        isClockedIn: false, 
        lastClockOut: Date.now() 
      };
      
      await updateDoc(doc(db, 'staffProfiles', staffId), sanitizeForFirestore(updates));
      
      // Update local state immediately
      const updatedStaffList = get().staffList.map(s => s.id === staffId ? { ...s, ...updates } : s);
      set({ staffList: updatedStaffList });
      
      const currentStaff = get().currentStaff;
      if (currentStaff && currentStaff.id === staffId) {
        set({ currentStaff: null });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `staffProfiles/${staffId}/clock-out`);
    }
  },
  isOnline: typeof window !== 'undefined' ? window.navigator.onLine : true,
  setIsOnline: (isOnline) => set({ isOnline }),
  
  allOrders: [],
  setAllOrders: (allOrders) => set({ allOrders }),
  kdsHistory: [],
  setKdsHistory: (kdsHistory) => set({ kdsHistory }),
  kdsTickets: [],
  setKdsTickets: (kdsTickets) => set({ kdsTickets }),
  barKdsTickets: [],
  setBarKdsTickets: (barKdsTickets) => set({ barKdsTickets }),
  
  activeTable: null,
  setActiveTable: (table) => {
    if (!table) {
      set({ activeTable: null, activeOrder: null });
      return;
    }

    const state = get();
    // Try to find the active order for this table
    const existingOrder = state.allOrders.find(o => 
      o.tableId === table.id && 
      ['open', 'sent', 'partially_paid', 'ordering', 'fired', 'served', 'payment_pending'].includes(o.status)
    );

    if (existingOrder) {
      set({ activeTable: table, activeOrder: existingOrder });
    } else {
      // If table is seated but no order found locally (unlikely but possible during sync), 
      // stay on floor or create a ghost order. 
      // Most of the time, seatTable will be called first.
      set({ activeTable: table, activeOrder: null });
    }
  },
  activeOrder: null,
  setActiveOrder: (order) => set({ activeOrder: order }),

  isDesignMode: false,
  toggleDesignMode: () => set((state) => ({ isDesignMode: !state.isDesignMode })),

  syncFromHub: async () => {
    const { syncAllFromHub } = await import('../lib/backboneHub');
    let { menuItems, categories, modifierGroups, users, zones, tables, briefing } = await syncAllFromHub();
    
    // Fallback to local seedData if hub is essentially empty
    if (!menuItems && !categories && !users) {
      console.warn('Hub sync failed or returned no data. Falling back to local seedData...');
      const { seedData } = await import('../lib/seedData');
      menuItems = seedData.menuItems as any;
      categories = seedData.menuCategories as any;
      users = seedData.staffProfiles as any;
      zones = seedData.zones as any;
      tables = seedData.tables as any;
      briefing = seedData.shiftBriefings?.[0] as any;
      modifierGroups = [];
      
      if (!menuItems && !categories && !users) {
        throw new Error('No data could be fetched from the hub or local seed data.');
      }
    }

    try {
      const { writeBatch } = await import('firebase/firestore');
      let batch = writeBatch(db);
      let count = 0;
      let totalCount = 0;

      const commitBatch = async () => {
        if (count > 0) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      };

      if (categories) {
        for (const cat of categories) {
          const sanitizedCat = { ...cat, locationId: POS_CONFIG.LOCATION_ID };
          batch.set(doc(db, 'menuCategories', cat.id), sanitizeForFirestore(sanitizedCat));
          count++;
          totalCount++;
          if (count >= 400) await commitBatch();
        }
      }
      if (modifierGroups) {
        for (const group of modifierGroups) {
          const sanitizedGroup = { ...group, locationId: POS_CONFIG.LOCATION_ID };
          batch.set(doc(db, 'modifierGroups', group.id), sanitizeForFirestore(sanitizedGroup));
          count++;
          totalCount++;
          if (count >= 400) await commitBatch();
        }
      }
      if (menuItems) {
        for (const item of menuItems) {
          const sanitizedItem = { ...item, locationId: POS_CONFIG.LOCATION_ID };
          batch.set(doc(db, 'menuItems', item.id), sanitizeForFirestore(sanitizedItem));
          count++;
          totalCount++;
          if (count >= 400) await commitBatch();
        }
      }
      if (users) {
        for (const user of users) {
          const sanitizedUser = {
            ...user,
            pin: String(user.pin),
            locationId: POS_CONFIG.LOCATION_ID
          };
          batch.set(doc(db, 'staffProfiles', sanitizedUser.id), sanitizeForFirestore(sanitizedUser));
          count++;
          totalCount++;
          if (count >= 400) await commitBatch();
        }
      }
      if (zones) {
        for (const zone of zones) {
          const sanitizedZone = { ...zone, locationId: POS_CONFIG.LOCATION_ID };
          batch.set(doc(db, 'zones', sanitizedZone.id), sanitizeForFirestore(sanitizedZone));
          count++;
          totalCount++;
          if (count >= 400) await commitBatch();
        }
      }
      if (tables) {
        for (const table of tables) {
          const sanitizedTable = { ...table, locationId: POS_CONFIG.LOCATION_ID };
          batch.set(doc(db, 'tables', sanitizedTable.id), sanitizeForFirestore(sanitizedTable));
          count++;
          totalCount++;
          if (count >= 400) await commitBatch();
        }
      }

      if (briefing) {
        try {
          const q = query(collection(db, 'shiftBriefings'), where('locationId', '==', POS_CONFIG.LOCATION_ID), where('active', '==', true));
          const activeDocs = await getDocs(q);
          activeDocs.forEach(docSnap => {
            batch.update(doc(db, 'shiftBriefings', docSnap.id), { active: false });
          });
        } catch (err) {
          console.error('Failed to deactivate old briefings:', err);
        }

        const sanitizedBriefing = { 
          ...briefing, 
          locationId: POS_CONFIG.LOCATION_ID,
          active: true,
          createdAt: Date.now()
        };
        const briefingId = briefing.id || `brf_${Date.now()}`;
        batch.set(doc(db, 'shiftBriefings', briefingId), sanitizeForFirestore(sanitizedBriefing));
        count++;
        totalCount++;
        if (count >= 400) await commitBatch();
      }
      
      await commitBatch();
      console.log(`Sync completed. Updated ${totalCount} documents.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'hub-sync');
    }
  },

  addItem: async (item) => {
    const state = get();
    if (!state.activeOrder) return;
    
    // Update table status to ordering if it was seated
    if (state.activeTable && state.activeTable.status === 'seated') {
      await updateDoc(doc(db, 'tables', state.activeTable.id), sanitizeForFirestore({ status: 'ordering' }));
    }
    
    const uuid = Math.random().toString(36).substring(7);
    const totalPrice = ((item.snapshot?.priceGross || 0) + item.modifiers.reduce((acc, m) => acc + m.priceDelta, 0)) * item.quantity;
    
    // Auto-assign course from snapshot if not provided
    const newItem: POSOrderItem = { 
      ...item, 
      uuid, 
      totalPrice, 
      status: 'draft',
      course: item.course || resolveCourseForItem(item.snapshot, state.categories)
    };
    const newItems = [...state.activeOrder.items, newItem];
    
    const totals = PricingEngine.calculateOrderTotals(
      newItems,
      state.activeOrder.discountType,
      state.activeOrder.discountValue
    );
    
    const updatedOrder: POSOrder = {
      ...state.activeOrder,
      items: newItems,
      ...totals
    };

    try {
      await setDoc(doc(db, 'posOrders', updatedOrder.id), sanitizeForFirestore(updatedOrder));
      set({ activeOrder: updatedOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${updatedOrder.id}`);
    }
  },

  removeItem: async (uuid) => {
    const state = get();
    if (!state.activeOrder) return;
    const newItems = state.activeOrder.items.filter(i => i.uuid !== uuid);
    
    const totals = PricingEngine.calculateOrderTotals(
      newItems,
      state.activeOrder.discountType,
      state.activeOrder.discountValue
    );

    const updatedOrder: POSOrder = {
      ...state.activeOrder,
      items: newItems,
      ...totals
    };

    try {
      await setDoc(doc(db, 'posOrders', updatedOrder.id), sanitizeForFirestore(updatedOrder));
      set({ activeOrder: updatedOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${updatedOrder.id}`);
    }
  },

  updateQuantity: async (uuid, delta) => {
    const state = get();
    if (!state.activeOrder) return;
    const newItems = state.activeOrder.items.map(i => {
      if (i.uuid === uuid) {
        const newQty = Math.max(1, i.quantity + delta);
        const { totalPrice, discountAmount } = PricingEngine.calculateItemTotal(
          i.snapshot?.priceGross || 0, 
          i.modifiers, 
          newQty,
          i.discountType,
          i.discountValue
        );
        return { ...i, quantity: newQty, totalPrice, discountAmount };
      }
      return i;
    });
    
    const totals = PricingEngine.calculateOrderTotals(
      newItems,
      state.activeOrder.discountType,
      state.activeOrder.discountValue
    );

    const updatedOrder: POSOrder = {
      ...state.activeOrder,
      items: newItems,
      ...totals
    };

    try {
      await setDoc(doc(db, 'posOrders', updatedOrder.id), sanitizeForFirestore(updatedOrder));
      set({ activeOrder: updatedOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${updatedOrder.id}`);
    }
  },

  updateItemInOrder: async (uuid, updates) => {
    const state = get();
    if (!state.activeOrder) return;

    const newItems = state.activeOrder.items.map(i => {
      if (i.uuid === uuid) {
        const merged = { ...i, ...updates };
        const { totalPrice, discountAmount } = PricingEngine.calculateItemTotal(
          merged.snapshot?.priceGross || 0,
          merged.modifiers,
          merged.quantity,
          merged.discountType,
          merged.discountValue
        );
        return { ...merged, totalPrice, discountAmount };
      }
      return i;
    });

    const totals = PricingEngine.calculateOrderTotals(
      newItems,
      state.activeOrder.discountType,
      state.activeOrder.discountValue
    );

    const updatedOrder: POSOrder = {
      ...state.activeOrder,
      items: newItems,
      ...totals
    };

    try {
      await setDoc(doc(db, 'posOrders', updatedOrder.id), sanitizeForFirestore(updatedOrder));
      set({ activeOrder: updatedOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${updatedOrder.id}`);
    }
  },

  applyOrderDiscount: async (discountType, discountValue) => {
    const state = get();
    if (!state.activeOrder) return;

    const totals = PricingEngine.calculateOrderTotals(
      state.activeOrder.items,
      discountType || undefined,
      discountValue
    );

    const updatedOrder: POSOrder = {
      ...state.activeOrder,
      discountType: discountType || undefined,
      discountValue: discountValue,
      ...totals
    };

    try {
      await setDoc(doc(db, 'posOrders', updatedOrder.id), sanitizeForFirestore(updatedOrder));
      set({ activeOrder: updatedOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${updatedOrder.id}`);
    }
  },

  voidItem: async (uuid, reason) => {
    const state = get();
    if (!state.activeOrder) return;

    const newItems = state.activeOrder.items.map(i => {
      if (i.uuid === uuid) {
        return { 
          ...i, 
          status: 'voided' as const, 
          voidReason: reason,
          notes: `${i.notes ? i.notes + ' ' : ''}[VOID: ${reason}]` 
        };
      }
      return i;
    });

    const totals = PricingEngine.calculateOrderTotals(
      newItems,
      state.activeOrder.discountType,
      state.activeOrder.discountValue
    );

    const updatedOrder: POSOrder = {
      ...state.activeOrder,
      items: newItems,
      ...totals
    };

    try {
      await setDoc(doc(db, 'posOrders', updatedOrder.id), sanitizeForFirestore(updatedOrder));
      set({ activeOrder: updatedOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${updatedOrder.id}`);
    }
  },

  transferItem: async (uuid, targetTableId) => {
    const state = get();
    if (!state.activeOrder || !targetTableId) return;

    const itemToTransfer = state.activeOrder.items.find(i => i.uuid === uuid);
    if (!itemToTransfer) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Remove from source order
      const remainingItems = state.activeOrder.items.filter(i => i.uuid !== uuid);
      const sourceTotals = PricingEngine.calculateOrderTotals(
        remainingItems,
        state.activeOrder.discountType,
        state.activeOrder.discountValue
      );
      const updatedSourceOrder: POSOrder = {
        ...state.activeOrder,
        items: remainingItems,
        ...sourceTotals
      };
      batch.set(doc(db, 'posOrders', updatedSourceOrder.id), sanitizeForFirestore(updatedSourceOrder));

      // 2. Find or create target order
      const targetTable = state.tables.find(t => t.id === targetTableId);
      let targetOrder = state.allOrders.find(o => o.id === targetTable?.currentOrderId && o.status === 'open');
      
      if (!targetOrder && targetTable?.currentOrderId) {
        // Fetch it if not in allOrders (though it should be)
        // For now assume logic below
      }

      if (targetOrder) {
        const newTargetItems = [...targetOrder.items, itemToTransfer];
        const targetTotals = PricingEngine.calculateOrderTotals(
          newTargetItems,
          targetOrder.discountType,
          targetOrder.discountValue
        );
        const updatedTargetOrder: POSOrder = {
          ...targetOrder,
          items: newTargetItems,
          ...targetTotals
        };
        batch.set(doc(db, 'posOrders', targetOrder.id), sanitizeForFirestore(updatedTargetOrder));
      } else {
        // Create new order for target table if none exists
        const newOrderId = `ord_${Math.random().toString(36).substring(7)}`;
        const targetTotals = PricingEngine.calculateOrderTotals([itemToTransfer]);
        const newTargetOrder: POSOrder = {
          id: newOrderId,
          tableId: targetTableId,
          status: 'open',
          items: [itemToTransfer],
          ...targetTotals,
          amountPaid: 0,
          payments: [],
          staffId: state.currentStaff?.id || 'unknown',
          createdAt: Date.now(),
          locationId: POS_CONFIG.LOCATION_ID
        };
        batch.set(doc(db, 'posOrders', newOrderId), sanitizeForFirestore(newTargetOrder));
        batch.update(doc(db, 'tables', targetTableId), sanitizeForFirestore({ currentOrderId: newOrderId, status: 'ordering' }));
      }

      await batch.commit();
      set({ activeOrder: updatedSourceOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `transfer-item/${uuid}`);
    }
  },

  sendOrder: async () => {
    const state = get();
    if (!state.activeOrder) return;

    // Implementation of coursing logic
    const itemsWithCoursing = state.activeOrder.items.map(item => {
      let updatedItem = { ...item };
      if (updatedItem.status === 'draft') {
        const isImmediate = updatedItem.course === 'drinks' || updatedItem.course === 'starters';
        updatedItem.status = isImmediate ? 'fired' : 'held';
        if (isImmediate) updatedItem.firedAt = Date.now();
      }
      return updatedItem;
    });

    const sentOrder: POSOrder = { 
      ...state.activeOrder, 
      items: itemsWithCoursing,
      status: 'sent', 
      lastOrderedAt: Date.now(),
      firstOrderSentAt: state.activeOrder.firstOrderSentAt || Date.now(),
      currentCourse: 'starters',
      lastCourseAt: Date.now()
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'posOrders', sentOrder.id), sanitizeForFirestore(sentOrder));

      // Update table status to fired when order is sent
      if (state.activeTable) {
        batch.update(doc(db, 'tables', state.activeTable.id), sanitizeForFirestore({ 
          status: 'fired',
          seatedAt: state.activeTable.seatedAt || Date.now()
        }));
      }

      // 1. Split items that WERE draft by station
      const newDraftItems = state.activeOrder.items.filter(i => i.status === 'draft');
      const kitchenItems = newDraftItems.filter(i => i.snapshot?.station !== 'bar');
      const barItems = newDraftItems.filter(i => i.snapshot?.station === 'bar');

      const tableName = state.tables.find(t => t.id === sentOrder.tableId)?.name || sentOrder.tableId;

      const createTicket = (stationItems: POSOrderItem[], station: 'kitchen' | 'bar') => {
        if (stationItems.length === 0) return;

        const ticketId = `tkt_${Math.random().toString(36).substring(7)}`;
        const kdsTicket = {
          id: ticketId,
          orderId: sentOrder.id,
          tableId: sentOrder.tableId,
          tableName,
          station,
          status: 'pending',
          items: stationItems.map(i => {
             const isImmediate = i.course === 'drinks' || i.course === 'starters';
             return {
                uuid: i.uuid,
                name: i.snapshot?.name || 'Unknown Item',
                quantity: i.quantity,
                modifiers: i.modifiers,
                notes: i.notes,
                course: i.course,
                status: isImmediate ? 'pending' : 'held'
             };
          }),
          createdAt: Date.now(),
          locationId: sentOrder.locationId,
          priority: stationItems.some(i => (i.course === 'starters' || i.notes?.toLowerCase().includes('priority')))
        };

        const collectionName = station === 'bar' ? 'barKdsTickets' : 'kdsTickets';
        batch.set(doc(db, collectionName, ticketId), sanitizeForFirestore(kdsTicket));
      };

      createTicket(kitchenItems, 'kitchen');
      createTicket(barItems, 'bar');

      await batch.commit();
      set({ activeOrder: sentOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posOrders/${sentOrder.id}`);
    }
  },
  
  cancelSession: async (reason) => {
    const state = get();
    const order = state.activeOrder;
    const table = state.activeTable;
    const staff = state.currentStaff;

    if (!order || !table || !staff) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Update Order Status
      const cancelledOrder: POSOrder = {
        ...order,
        status: 'cancelled',
        cancelledAt: Date.now(),
        cancelledBy: staff.id,
        cancelReason: reason,
        covers: 0 // Explicitly set to 0 as per requirements
      };
      
      batch.set(doc(db, 'posOrders', order.id), sanitizeForFirestore(cancelledOrder));

      // 2. Clear Table
      batch.update(doc(db, 'tables', table.id), sanitizeForFirestore({
        status: 'available',
        currentOrderId: null,
        seatedAt: null,
        guestCount: 0
      }));

      // 3. Create Audit Trail
      const auditId = `audit_${Math.random().toString(36).substring(7)}`;
      const auditRecord = {
        orderId: order.id,
        tableId: table.id,
        staffId: staff.id,
        cancelledAt: Date.now(),
        reason,
        originalItemCount: order.items.length,
        originalValue: order.totalGross,
        locationId: order.locationId || POS_CONFIG.LOCATION_ID
      };
      
      batch.set(doc(db, 'cancelledSessions', auditId), sanitizeForFirestore(auditRecord));

      await batch.commit();
      
      // Clear active state
      set({ activeOrder: null, activeTable: null, activeScreen: 'floor' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `cancelSession/${order.id}`);
    }
  },

  processPayment: async (amount, method) => {
    const state = get();
    const order = state.activeOrder;
    const staff = state.currentStaff;
    const table = state.activeTable;

    if (!order || !staff) return;

    const paymentId = Math.random().toString(36).substring(7);

    // Re-calculate or use stored order-level discount
    const itemDiscounts = order.items.reduce((acc, i) => acc + (Number(i.discountAmount) || 0), 0);
    const totals = PricingEngine.calculateOrderTotals(order.items, order.discountType, order.discountValue);
    const discountTotal = totals.discountAmount;

    // Create Internal Payment Record
    const paymentRecord: PaymentRecord = {
      id: paymentId,
      orderId: order.id,
      amount,
      method,
      timestamp: Date.now(),
      staffId: staff.id
    };

    const newAmountPaid = order.amountPaid + amount;
    const newPayments = [...(order.payments || []), paymentRecord];
    const isFullyPaid = newAmountPaid >= order.totalGross;
    
    // Order Update document
    const updatedOrder: POSOrder = {
      ...order,
      amountPaid: newAmountPaid,
      payments: newPayments,
      status: isFullyPaid ? 'paid' : 'partially_paid',
      ...(isFullyPaid ? { paidAt: Date.now(), paymentMethod: method } : {})
    };

    try {
      console.log('[POS Payment] Writing posPayments record...');
      
      const posPaymentDoc = {
        id: paymentId,
        orderId: order.id,
        locationId: order.locationId || POS_CONFIG.LOCATION_ID,
        tableId: order.tableId,
        tableName: table?.name || 'Unknown',
        paymentMethod: method,
        amountPaid: Number(amount) || 0,
        currency: 'GBP',
        paidAt: Date.now(),
        createdAt: order.createdAt,
        status: 'paid',
        
        // Hub Schema alignment
        grossSales: Number(totals.totalGross) || 0,
        netSales: Number(totals.subtotalGross) || 0,
        vatTotal: Number(totals.vatTotal) || 0,
        serviceChargeTotal: Number(totals.serviceCharge) || 0,
        discountTotal: discountTotal,
        totalPaid: Number(amount) || 0,
        totalCost: Number(totals.totalCost) || 0,

        // Items for Hub Inventory/Reporting
        items: order.items.map(i => ({
          uuid: i.uuid,
          id: i.snapshot?.id || i.menuItemId,
          name: i.snapshot?.name || 'Unknown Item',
          quantity: Number(i.quantity) || 0,
          priceGross: Number(i.snapshot?.priceGross) || 0,
          totalPrice: Number(i.totalPrice) || 0,
          discountAmount: Number(i.discountAmount) || 0,
          vatRate: Number(i.snapshot?.vatRate) || 0,
          modifiers: i.modifiers.map(m => ({ name: m.name, priceDelta: m.priceDelta, cost: m.cost })),
          notes: i.notes || '',
          status: i.status
        }))
      };

      // 1. Write the payment ledger record
      await setDoc(doc(db, 'posPayments', paymentId), sanitizeForFirestore(posPaymentDoc));
      console.log('[POS Payment] posPayments saved');

      // 1.5. Log Stock Movements (Theoretical Deduction)
      if (isFullyPaid) {
        try {
          const stockDeductions = PricingEngine.calculateStockDeductions(order.items);
          if (stockDeductions.length > 0) {
            const movementDoc = {
              orderId: order.id,
              locationId: order.locationId || POS_CONFIG.LOCATION_ID,
              timestamp: Date.now(),
              items: stockDeductions
            };
            await addDoc(collection(db, 'stockMovements'), sanitizeForFirestore(movementDoc));
            console.log('[POS Stock] Theoretical deductions logged');
          }
        } catch (stockErr) {
          console.error('[POS Stock] Failed to log theoretical deductions', stockErr);
          // Non-blocking: We don't want to fail the payment if stock logging fails
        }
      }

      // 2. Update the order with same accurate totals
      const orderUpdate = {
        ...updatedOrder,
        grossSales: posPaymentDoc.grossSales,
        netSales: posPaymentDoc.netSales,
        vatTotal: posPaymentDoc.vatTotal,
        serviceChargeTotal: posPaymentDoc.serviceChargeTotal,
        discountTotal: posPaymentDoc.discountTotal,
        totalPaid: newAmountPaid,
        totalCost: posPaymentDoc.totalCost
      };

      await setDoc(doc(db, 'posOrders', order.id), sanitizeForFirestore(orderUpdate));
      console.log('[POS Payment] posOrder updated');

      // 2.5 Archive complete immutable transaction & ticket snapshot if fully paid
      if (isFullyPaid) {
        try {
          const year = new Date().getFullYear();
          const latestTxNum = state.allTransactions.reduce((max, t) => {
            const match = t.ticketNumber.match(/CAM-\d+-(\d+)/);
            if (match) return Math.max(max, parseInt(match[1]));
            return max;
          }, 0);
          const nextNum = latestTxNum + 1;
          const ticketNumber = `CAM-${year}-${String(nextNum).padStart(6, '0')}`;
          
          let templateData;
          try {
            const tplSnap = await getDoc(doc(db, 'receiptTemplates', order.locationId || POS_CONFIG.LOCATION_ID));
            if (tplSnap.exists()) {
              templateData = tplSnap.data();
            } else {
              templateData = getDefaultReceiptTemplate(order.locationId || POS_CONFIG.LOCATION_ID);
            }
          } catch (err) {
            console.warn('Could not fetch template for transaction, using default outline', err);
            templateData = getDefaultReceiptTemplate(order.locationId || POS_CONFIG.LOCATION_ID);
          }

          const snapshotId = `SNAP-${order.id}`;
          const snapshotDoc = {
            id: snapshotId,
            locationId: order.locationId || POS_CONFIG.LOCATION_ID,
            siteId: order.locationId || POS_CONFIG.LOCATION_ID,
            businessId: templateData?.businessId || 'biz_backbone',
            orderData: orderUpdate,
            receiptTemplateData: templateData,
            createdAt: Date.now()
          };
          await setDoc(doc(db, 'ticketSnapshots', snapshotId), sanitizeForFirestore(snapshotDoc));
          console.log('[POS Transaction] Ticket snapshot written');

          const txDoc = {
            id: order.id,
            transactionId: order.id,
            ticketNumber,
            orderId: order.id,
            locationId: order.locationId || POS_CONFIG.LOCATION_ID,
            siteId: order.locationId || POS_CONFIG.LOCATION_ID,
            businessId: templateData?.businessId || 'biz_backbone',
            tableId: order.tableId,
            tableName: table?.name || 'Unknown',
            tableNumber: table?.name || 'Unknown',
            staffId: staff.id,
            staffName: staff.name,
            staffRole: staff.role,
            covers: Number(order.covers) || 0,
            status: 'paid',
            
            items: orderUpdate.items || [],
            subtotal: Number(totals.subtotalGross) || 0,
            serviceChargeTotal: Number(totals.serviceCharge) || 0,
            vatTotal: Number(totals.vatTotal) || 0,
            discountTotal: Number(discountTotal) || 0,
            tipTotal: 0,
            grandTotal: Number(totals.totalGross) || 0,
            
            paymentStatus: 'paid',
            transactionStatus: 'completed',
            transactionType: 'sale',
            
            paymentSummary: {
              primaryPaymentMethod: method,
              paymentMethods: [method],
              isSplitPayment: false
            },
            
            receipt: {
              receiptTemplateId: templateData?.id || order.locationId || POS_CONFIG.LOCATION_ID,
              receiptSnapshotId: snapshotId,
              printedCount: 1,
              emailedCount: 0
            },

            subtotalGross: Number(totals.subtotalGross) || 0,
            serviceCharge: Number(totals.serviceCharge) || 0,
            discountAmount: Number(discountTotal) || 0,
            totalGross: Number(totals.totalGross) || 0,
            amountPaid: Number(newAmountPaid) || 0,
            changeGiven: Number(newAmountPaid - totals.totalGross) > 0 ? Number(newAmountPaid - totals.totalGross) : 0,
            tipsAmount: 0,
            payments: {
              cash: method === 'cash' ? Number(totals.totalGross) : 0,
              card: method === 'card' ? Number(totals.totalGross) : 0,
              deposit: 0,
              voucher: method === 'code' ? Number(totals.totalGross) : 0
            },
            createdAt: order.createdAt,
            paidAt: Date.now(),
            businessDate: new Date().toISOString().split('T')[0],
            isLocked: false,
            snapshotId
          };
          await setDoc(doc(db, 'posTransactions', order.id), sanitizeForFirestore(txDoc));
          console.log('[POS Transaction] Complete transaction written');
        } catch (txErr) {
          console.error('[POS Transaction] Failed to record transaction archive', txErr);
        }
      }
      
      // 3. Clear table if fully paid
      if (isFullyPaid && table) {
        await updateDoc(doc(db, 'tables', table.id), sanitizeForFirestore({
          status: 'available',
          currentOrderId: null,
          seatedAt: null,
          guestCount: 0
        }));
        set({ activeOrder: null, activeTable: null });
      } else if (table) {
        // Update table to payment_pending if partially paid or just starting to pay
        await updateDoc(doc(db, 'tables', table.id), sanitizeForFirestore({ status: 'payment_pending' }));
        set({ activeOrder: updatedOrder });
      } else {
        set({ activeOrder: updatedOrder });
      }
    } catch (err) {
      console.error('[POS Payment] failure', err);
      handleFirestoreError(err, OperationType.WRITE, `posPayments/${paymentId}`);
    }
  },

  addTable: async (zoneId, shape = 'square') => {
    const state = get();
    // More robust naming
    const maxNum = state.tables.reduce((max, t) => {
      const match = t.name.match(/T(\d+)/);
      if (match) return Math.max(max, parseInt(match[1]));
      return max;
    }, 0);
    const newTable: Omit<Table, 'id'> = {
      name: `T${maxNum + 1}`,
      status: 'available',
      zoneId,
      x: 150,
      y: 150,
      width: 120,
      height: 120,
      shape,
      guestCount: 0,
      locationId: POS_CONFIG.LOCATION_ID
    };
    try {
      await addDoc(collection(db, 'tables'), sanitizeForFirestore(newTable));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tables');
    }
  },

  copyTable: async (tableId) => {
    const state = get();
    const tableToCopy = state.tables.find(t => t.id === tableId);
    if (!tableToCopy) return;
    
    const newTable: Omit<Table, 'id'> = {
      ...tableToCopy,
      name: `${tableToCopy.name} Copy`,
      x: tableToCopy.x + 20,
      y: tableToCopy.y + 20,
      status: 'available',
      guestCount: 0,
      seatedAt: undefined,
      currentOrderId: undefined,
      locationId: POS_CONFIG.LOCATION_ID
    };
    try {
      await addDoc(collection(db, 'tables'), sanitizeForFirestore(newTable));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tables');
    }
  },

  updateTable: async (tableId, updates) => {
    try {
      await updateDoc(doc(db, 'tables', tableId), sanitizeForFirestore(updates));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tables/${tableId}`);
    }
  },

  deleteTable: async (tableId) => {
    try {
      await deleteDoc(doc(db, 'tables', tableId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tables/${tableId}`);
    }
  },

  seatTable: async (tableId, covers) => {
    const state = get();
    const table = state.tables.find(t => t.id === tableId);
    if (!table) return;

    const orderId = `ord_${Date.now()}`;
    const newOrder: POSOrder = {
      id: orderId,
      tableId: tableId,
      status: 'open',
      items: [],
      subtotalGross: 0,
      vatTotal: 0,
      serviceCharge: 0,
      totalGross: 0,
      amountPaid: 0,
      payments: [],
      staffId: state.currentStaff?.id || 'unknown',
      createdAt: Date.now(),
      seatedAt: Date.now(),
      covers: covers,
      locationId: POS_CONFIG.LOCATION_ID
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'posOrders', orderId), sanitizeForFirestore(newOrder));
      batch.update(doc(db, 'tables', tableId), sanitizeForFirestore({
        status: 'seated',
        currentOrderId: orderId,
        guestCount: covers,
        seatedAt: Date.now()
      }));
      await batch.commit();
      
      set({ activeTable: { ...table, status: 'seated', currentOrderId: orderId, guestCount: covers, seatedAt: Date.now() }, activeOrder: newOrder });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `seatTable/${tableId}`);
    }
  },

  fireCourse: async (orderId, course) => {
    const state = get();
    try {
      const batch = writeBatch(db);
      
      // 1. Update POS Order
      const order = state.allOrders.find(o => o.id === orderId);
      if (order) {
        const now = Date.now();
        const newItems = order.items.map(i => {
          const itemCourse = i.course || 'mains';
          return itemCourse === course && i.status === 'held' ? { ...i, status: 'fired' as const, firedAt: now } : i;
        });
        const orderUpdates: any = { 
          items: newItems,
          currentCourse: course,
          lastCourseAt: now
        };

        if (course === 'mains' && !order.mainsFiredAt) {
          orderUpdates.mainsFiredAt = now;
        } else if (course === 'desserts' && !order.dessertsFiredAt) {
          orderUpdates.dessertsFiredAt = now;
        }

        batch.update(doc(db, 'posOrders', orderId), sanitizeForFirestore(orderUpdates));

        // Update local state immediately for snappy UI
        const updatedOrder = { ...order, ...orderUpdates };
        const newAllOrders = state.allOrders.map(o => o.id === orderId ? updatedOrder : o);
        
        const nextState: any = { allOrders: newAllOrders };
        if (state.activeOrder?.id === orderId) {
          nextState.activeOrder = updatedOrder;
        }
        set(nextState);
      }

      // 2. Update KDS Tickets
      const kitchenTkts = state.kdsTickets.filter(t => t.orderId === orderId);
      const barTkts = state.barKdsTickets.filter(t => t.orderId === orderId);

      kitchenTkts.forEach(t => {
        const hItems = t.items.filter(i => (i.course || 'mains') === course && i.status === 'held');
        if (hItems.length === 0) return;

        const newItems = t.items.map(i => {
          const itemCourse = i.course || 'mains';
          return itemCourse === course && i.status === 'held' ? { ...i, status: 'pending' as const } : i;
        });
        
        const updates: any = { items: newItems };
        // If ticket was bumped or ready, reset it to pending
        if (t.status === 'bumped' || t.status === 'ready' || t.status === 'served') {
          updates.status = 'pending';
        }
        batch.update(doc(db, 'kdsTickets', t.id), sanitizeForFirestore(updates));
      });
      barTkts.forEach(t => {
        const hItems = t.items.filter(i => (i.course || 'mains') === course && i.status === 'held');
        if (hItems.length === 0) return;

        const newItems = t.items.map(i => {
          const itemCourse = i.course || 'mains';
          return itemCourse === course && i.status === 'held' ? { ...i, status: 'pending' as const } : i;
        });

        const updates: any = { items: newItems };
        if (t.status === 'bumped' || t.status === 'ready' || t.status === 'served') {
          updates.status = 'pending';
        }
        batch.update(doc(db, 'barKdsTickets', t.id), sanitizeForFirestore(updates));
      });

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `fireCourse/${orderId}/${course}`);
    }
  },

  serveOrder: async (orderId) => {
    const state = get();
    try {
      const batch = writeBatch(db);
      
      // 1. Mark tickets as served in both collections
      const kitchenTkts = state.kdsTickets.filter(t => t.orderId === orderId);
      const barTkts = state.barKdsTickets.filter(t => t.orderId === orderId);
      
      kitchenTkts.forEach(t => {
        batch.update(doc(db, 'kdsTickets', t.id), sanitizeForFirestore({ status: 'served', bumpedAt: Date.now() }));
      });
      barTkts.forEach(t => {
        batch.update(doc(db, 'barKdsTickets', t.id), sanitizeForFirestore({ status: 'served', bumpedAt: Date.now() }));
      });

      // 2. Mark order items as served
      const order = state.allOrders.find(o => o.id === orderId);
      if (order) {
        const newItems = order.items.map(i => i.status !== 'voided' ? { ...i, status: 'served' as const } : i);
        const orderUpdates = { items: newItems };
        batch.update(doc(db, 'posOrders', orderId), sanitizeForFirestore(orderUpdates));

        if (state.activeOrder?.id === orderId) {
          set({ activeOrder: { ...state.activeOrder, ...orderUpdates } });
        }
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `serveOrder/${orderId}`);
    }
  },

  updateKdsTicketStatus: async (ticketId, station, status) => {
    const state = get();
    const collectionName = station === 'bar' ? 'barKdsTickets' : 'kdsTickets';
    try {
      const updates: any = { status };
      if (status === 'preparing') updates.startedAt = Date.now();
      if (status === 'ready') updates.completedAt = Date.now();
      if (status === 'served' || status === 'bumped') updates.bumpedAt = Date.now();

      await updateDoc(doc(db, collectionName, ticketId), sanitizeForFirestore(updates));
      
      // EXPO LOGIC: If a ticket transitions to 'ready', check if the ENTIRE order is now ready
      if (status === 'ready') {
        const ticket = (station === 'bar' ? state.barKdsTickets : state.kdsTickets).find(t => t.id === ticketId);
        if (ticket) {
          const otherStation = station === 'bar' ? 'kitchen' : 'bar';
          const otherCollection = otherStation === 'bar' ?'barKdsTickets' : 'kdsTickets';
          const otherTickets = (otherStation === 'bar' ? state.barKdsTickets : state.kdsTickets).filter(t => t.orderId === ticket.orderId && (t.status as string) !== 'bumped' && (t.status as string) !== 'served');
          
          const selfTickets = (station === 'bar' ? state.barKdsTickets : state.kdsTickets).filter(t => t.orderId === ticket.orderId && t.id !== ticketId && (t.status as string) !== 'bumped' && (t.status as string) !== 'served');
          
          const allOthersReady = otherTickets.every(t => t.status === 'ready') && selfTickets.every(t => t.status === 'ready');
          
          if (allOthersReady) {
            // Signal global readiness
            const { playOrderReadySound } = await import('../lib/notifications');
            playOrderReadySound();
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${ticketId}`);
    }
  },

  updateKdsItemStatus: async (ticketId, station, itemUuid, status) => {
    const state = get();
    const collectionName = station === 'bar' ? 'barKdsTickets' : 'kdsTickets';
    try {
      // This is trickier as we need to update an item in an array in Firestore
      // For simplicity, let's just use the current order status update for now
      // and I'll revisit this if we have a real need to update individual KDS items specifically.
      // Actually, professional KDS should track item status.
      // I'll skip individual item status update in the array for now to avoid complexity
      // and focus on whole ticket status which is more common.
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${ticketId}`);
    }
  },
  
  updateItemStatus: async (orderId, itemUuid, status) => {
    const state = get();
    try {
      const order = state.allOrders.find(o => o.id === orderId) || (state.activeOrder?.id === orderId ? state.activeOrder : null);
      if (order) {
        const newItems = order.items.map(i => i.uuid === itemUuid ? { ...i, status } : i);
        
        // If all items in the order are ready, we could potentially mark the whole order as ready
        // but for now we just update the items.
        await updateDoc(doc(db, 'posOrders', orderId), sanitizeForFirestore({ items: newItems }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posOrders/${orderId}`);
    }
  },

  reassignItemStation: async (orderId, itemUuid, newStation) => {
    const state = get();
    try {
      const order = state.allOrders.find(o => o.id === orderId) || (state.activeOrder?.id === orderId ? state.activeOrder : null);
      if (order) {
        const newItems = order.items.map(i => {
          if (i.uuid === itemUuid) {
            return {
              ...i,
              reassigned: true,
              snapshot: {
                ...i.snapshot,
                station: newStation as any
              }
            };
          }
          return i;
        });
        await updateDoc(doc(db, 'posOrders', orderId), sanitizeForFirestore({ items: newItems }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posOrders/${orderId}`);
    }
  },

  bumpOrder: async (orderId, station) => {
    const state = get();
    try {
      const order = state.allOrders.find(o => o.id === orderId) || (state.activeOrder?.id === orderId ? state.activeOrder : null);
      if (!order) return;

      const stationItems = order.items.filter(item => {
        const itemStation = item.snapshot?.station;
        return station === 'bar' ? itemStation === 'bar' : itemStation !== 'bar';
      });

      const newItems = order.items.map(i => {
        const itemStation = i.snapshot?.station;
        const isStationItem = station === 'bar' 
          ? itemStation === 'bar'
          : itemStation !== 'bar';
        
        if (isStationItem) {
          return { ...i, status: 'ready' as const };
        }
        return i;
      });

      // Update the order items
      await updateDoc(doc(db, 'posOrders', orderId), sanitizeForFirestore({ items: newItems }));

      // Update table to served
      await updateDoc(doc(db, 'tables', order.tableId), sanitizeForFirestore({ status: 'served' }));

      // Save to history
      const historyRecord = {
        orderId,
        tableId: order.tableId,
        station,
        bumpedAt: Date.now(),
        items: stationItems.map(i => ({
          name: i.snapshot?.name || 'Unknown Item',
          quantity: i.quantity,
          modifiers: i.modifiers,
          notes: i.notes
        })),
        locationId: order.locationId
      };

      await addDoc(collection(db, 'kdsHistory'), sanitizeForFirestore(historyRecord));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'kdsHistory');
    }
  },
  
  performEndOfDay: async () => {
    const state = get();
    const staff = state.currentStaff;
    if (!staff) return null;

    // 1. Get all paid orders without a zReportId
    const pendingOrders = state.allOrders.filter(o => o.status === 'paid' && !o.zReportId);
    
    if (pendingOrders.length === 0) {
      console.warn('No pending orders to include in Z-Report');
    }

    const zId = `Z-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const getShift = (timestamp: number): 'lunch' | 'dinner' => {
      const h = new Date(timestamp).getHours();
      if (h >= 11 && h < 16) return 'lunch';
      return 'dinner';
    };

    const initialShift = (name: 'lunch' | 'dinner') => ({
      name, netSales: 0, grossSales: 0, covers: 0, transactions: 0, serviceCharge: 0
    });

    const report: ZReport = {
      id: zId,
      timestamp: Date.now(),
      staffId: staff.id,
      staffName: staff.name,
      netSales: 0,
      grossSales: 0,
      vatTotal: 0,
      serviceChargeTotal: 0,
      discountTotal: 0,
      covers: 0,
      transactions: pendingOrders.length,
      payments: { cash: 0, card: 0, code: 0 },
      shifts: {
        lunch: initialShift('lunch'),
        dinner: initialShift('dinner')
      },
      foodSales: 0,
      drinkSales: { alcoholic: 0, nonAlcoholic: 0 },
      topItems: [],
      staffPerformance: {},
      locationId: POS_CONFIG.LOCATION_ID
    };

    const itemRevenue: Record<string, { name: string, quantity: number, revenue: number }> = {};

    pendingOrders.forEach(order => {
      const shift = getShift(order.paidAt || order.createdAt);
      
      const gross = Number(order.totalGross) || 0;
      const net = Number(order.subtotalGross) || 0;
      const vat = Number(order.vatTotal) || 0;
      const sc = Number(order.serviceCharge) || 0;

      report.netSales += net;
      report.grossSales += gross;
      report.vatTotal += vat;
      report.serviceChargeTotal += sc;
      
      const orderDiscount = order.items.reduce((acc, i) => acc + (Number(i.discountAmount) || 0), 0);
      report.discountTotal += orderDiscount;
      
      // Guest count (covers)
      const covers = Number(order.covers || 0);
      report.covers += covers;

      // Shift metrics
      const s = report.shifts[shift];
      s.netSales += order.subtotalGross;
      s.grossSales += order.totalGross;
      s.covers += covers;
      s.transactions += 1;

      // Payment Methods
      if (order.paymentMethod) {
        report.payments[order.paymentMethod] += order.totalGross;
      }

      // Item Performance
      order.items.forEach(item => {
        if (item.status === 'voided') return;
        const id = item.snapshot?.id || item.menuItemId;
        if (!itemRevenue[id]) {
          itemRevenue[id] = { name: item.snapshot?.name || 'Unknown Item', quantity: 0, revenue: 0 };
        }
        itemRevenue[id].quantity += item.quantity;
        itemRevenue[id].revenue += item.totalPrice;
      });
    });

    // Sort and take top 10 items
    report.topItems = Object.values(itemRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    try {
      const batch = writeBatch(db);
      
      // Save Z-Report
      batch.set(doc(db, 'zReports', zId), sanitizeForFirestore(report));
      
      // Mark orders as Z-processed
      pendingOrders.forEach(o => {
        batch.update(doc(db, 'posOrders', o.id), sanitizeForFirestore({ zReportId: zId }));
      });

      // Clear any remaining active tables (force reset day)
      state.tables.forEach(t => {
        if (t.status !== 'available') {
          batch.update(doc(db, 'tables', t.id), sanitizeForFirestore({
            status: 'available',
            currentOrderId: null,
            seatedAt: null,
            guestCount: 0
          }));
        }
      });

      await batch.commit();
      
      // 4. Push to HUB
      const { uploadHubData } = await import('../lib/backboneHub');
      await uploadHubData(`reports/Z_REPORT_${zId}.json`, report);
      
      return report;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'zReport');
      return null;
    }
  },

  getPersonalStats: (staffId) => {
    const state = get();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();
    
    const staffOrders = state.allOrders.filter(o => o.staffId === staffId && o.createdAt >= today);
    const paidOrders = staffOrders.filter(o => o.status === 'paid');
    
    const totalSales = paidOrders.reduce((acc, o) => acc + (o.totalGross || 0), 0);
    const ordersServed = paidOrders.length;
    const avgTicket = ordersServed > 0 ? totalSales / ordersServed : 0;
    
    let upsells = 0;
    paidOrders.forEach(o => {
      o.items.forEach(i => {
        if (i.course === 'desserts' || i.course === 'drinks') upsells += i.quantity;
      });
    });

    // Historical Comparisons
    const yesterdayStart = today - (24 * 60 * 60 * 1000);
    const yesterdayOrders = state.allOrders.filter(o => o.staffId === staffId && o.createdAt >= yesterdayStart && o.createdAt < today && o.status === 'paid');
    const yesterdaySales = yesterdayOrders.reduce((acc, o) => acc + (o.totalGross || 0), 0);
    
    const salesTrend = yesterdaySales > 0 ? ((totalSales - yesterdaySales) / yesterdaySales) * 100 : 0;
    const avgTicketTrend = yesterdayOrders.length > 0 ? ((avgTicket - (yesterdaySales / yesterdayOrders.length)) / (yesterdaySales / yesterdayOrders.length)) * 100 : 0;

    return {
      totalSales,
      ordersServed,
      avgTicket,
      upsells,
      performanceScore: Math.min(100, Math.round((totalSales / 1000) * 10)),
      trends: {
        sales: salesTrend,
        avgTicket: avgTicketTrend
      }
    };
  },

  getLeaderboards: () => {
    const state = get();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();
    
    // Aggregate Individual Stats
    const staffSales: Record<string, { id: string, name: string, sales: number, orders: number, role: string }> = {};
    
    state.allOrders.filter(o => o.createdAt >= today && o.status === 'paid').forEach(o => {
      const sId = o.staffId || 'unknown';
      if (!staffSales[sId]) {
        const staff = state.staffList.find(s => s.id === sId);
        staffSales[sId] = { id: sId, name: staff?.name || 'Unknown', sales: 0, orders: 0, role: staff?.role || 'waiter' };
      }
      staffSales[sId].sales += (o.totalGross || 0);
      staffSales[sId].orders += 1;
    });

    const floor = Object.values(staffSales)
      .filter(s => s.role === 'waiter' || s.role === 'supervisor')
      .sort((a, b) => b.sales - a.sales);

    const bar = Object.values(staffSales)
      .filter(s => s.role === 'bartender')
      .sort((a, b) => b.sales - a.sales);

    // Aggregate Kitchen Stats
    const chefStats: Record<string, { name: string, tickets: number, totalTime: number }> = {};
    state.kdsHistory.filter(h => h.bumpedAt >= today).forEach(h => {
      const name = h.chefName || 'Chef';
      if (!chefStats[name]) chefStats[name] = { name, tickets: 0, totalTime: 0 };
      chefStats[name].tickets += 1;
      chefStats[name].totalTime += (h.prepTime || 15);
    });

    const kitchen = Object.values(chefStats).map(s => ({
      name: s.name,
      orders: s.tickets,
      avgTime: Math.round(s.totalTime / s.tickets)
    })).sort((a, b) => a.avgTime - b.avgTime);
    
    return { floor, bar, kitchen };
  },

  voidTransaction: async (transactionId, staffId, reason) => {
    const state = get();
    const staff = state.staffList.find(s => s.id === staffId);
    try {
      const txRef = doc(db, 'posTransactions', transactionId);
      const txSnap = await getDoc(txRef);
      if (!txSnap.exists()) throw new Error('Transaction not found');
      const transactionData = txSnap.data() as POSTransaction;

      await updateDoc(txRef, {
        status: 'voided',
        voidedAt: Date.now()
      });

      const adjId = `ADJ-${Math.random().toString(36).substring(7)}`;
      const adjustment = {
        id: adjId,
        transactionId,
        locationId: transactionData.locationId,
        timestamp: Date.now(),
        type: 'void',
        reason,
        staffId,
        staffName: staff?.name || 'Manager',
        originalData: { status: transactionData.status },
        adjustedData: { status: 'voided' }
      };

      await setDoc(doc(db, 'transactionAdjustments', adjId), sanitizeForFirestore(adjustment));
      console.log('[Transaction System] Void processed and logged');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posTransactions/${transactionId}`);
    }
  },

  refundTransaction: async (transactionId, staffId, reason, refundItems) => {
    const state = get();
    const staff = state.staffList.find(s => s.id === staffId);
    try {
      const txRef = doc(db, 'posTransactions', transactionId);
      const txSnap = await getDoc(txRef);
      if (!txSnap.exists()) throw new Error('Transaction not found');
      const transactionData = txSnap.data() as POSTransaction;

      const isPartial = refundItems && refundItems.length > 0;

      await updateDoc(txRef, {
        status: 'refunded',
        refundedAt: Date.now()
      });

      const adjId = `ADJ-${Math.random().toString(36).substring(7)}`;
      const adjustment = {
        id: adjId,
        transactionId,
        locationId: transactionData.locationId,
        timestamp: Date.now(),
        type: isPartial ? 'partial_refund' : 'full_refund',
        reason,
        staffId,
        staffName: staff?.name || 'Manager',
        originalData: { status: transactionData.status },
        adjustedData: { status: 'refunded', refundItems: refundItems || null }
      };

      await setDoc(doc(db, 'transactionAdjustments', adjId), sanitizeForFirestore(adjustment));
      console.log('[Transaction System] Refund processed and logged');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posTransactions/${transactionId}`);
    }
  },

  correctPaymentMethod: async (transactionId, staffId, newMethod, reason) => {
    const state = get();
    const staff = state.staffList.find(s => s.id === staffId);
    try {
      const txRef = doc(db, 'posTransactions', transactionId);
      const txSnap = await getDoc(txRef);
      if (!txSnap.exists()) throw new Error('Transaction not found');
      const transactionData = txSnap.data() as POSTransaction;

      const updatedPayments = {
        cash: newMethod === 'cash' ? transactionData.totalGross : 0,
        card: newMethod === 'card' ? transactionData.totalGross : 0,
        deposit: 0,
        voucher: newMethod === 'code' ? transactionData.totalGross : 0
      };

      await updateDoc(txRef, {
        status: 'corrected',
        correctedAt: Date.now(),
        payments: updatedPayments
      });

      const adjId = `ADJ-${Math.random().toString(36).substring(7)}`;
      const adjustment = {
        id: adjId,
        transactionId,
        locationId: transactionData.locationId,
        timestamp: Date.now(),
        type: 'payment_correction',
        reason,
        staffId,
        staffName: staff?.name || 'Manager',
        originalData: { payments: transactionData.payments, status: transactionData.status },
        adjustedData: { payments: updatedPayments, status: 'corrected' }
      };

      await setDoc(doc(db, 'transactionAdjustments', adjId), sanitizeForFirestore(adjustment));
      console.log('[Transaction System] Payment method corrected and logged');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `posTransactions/${transactionId}`);
    }
  },
}));
