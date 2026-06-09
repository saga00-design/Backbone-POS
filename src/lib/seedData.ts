import { db } from './firebase';
import { collection, getDocs, writeBatch, doc, query, where } from 'firebase/firestore';

const LOCATION_ID = 'loc_camden';

export const seedData = {
  staffProfiles: [
    { 
      id: 'waiter1', 
      name: 'Test Waiter', 
      pin: '1234', 
      role: 'waiter', 
      locationId: LOCATION_ID,
      permissions: {
        canVoid: false,
        canDiscount: false,
        canRefund: false,
        canManageFloor: true
      }
    }
  ],
  menuCategories: [
    { id: 'drinks', name: 'Drinks', locationId: LOCATION_ID },
    { id: 'starters', name: 'Starters', locationId: LOCATION_ID },
    { id: 'tacos', name: 'Tacos', locationId: LOCATION_ID },
    { id: 'mains', name: 'Mains', locationId: LOCATION_ID },
    { id: 'desserts', name: 'Desserts', locationId: LOCATION_ID },
    { id: 'extras', name: 'Extras', locationId: LOCATION_ID }
  ],
  menuItems: [
    { id: 'margarita', name: 'Margarita', categoryId: 'drinks', station: 'bar', priceGross: 800, vatRate: 20, isDrink: true, isAlcoholic: true, locationId: LOCATION_ID },
    { id: 'paloma', name: 'Paloma', categoryId: 'drinks', station: 'bar', priceGross: 900, vatRate: 20, isDrink: true, isAlcoholic: true, locationId: LOCATION_ID },
    { id: 'mexican-cola', name: 'Mexican Cola', categoryId: 'drinks', station: 'bar', priceGross: 350, vatRate: 20, isDrink: true, isAlcoholic: false, locationId: LOCATION_ID },
    { id: 'guac', name: 'Guacamole', categoryId: 'starters', station: 'cold', priceGross: 500, vatRate: 20, isDrink: false, ingredients: ['Avocado', 'Lime', 'Cilantro', 'Onion', 'Salt', 'Salsa Verde'], allergies: [], imageUrl: 'https://images.unsplash.com/photo-1541288097308-7b8e3f58c4c6?q=80&w=800&auto=format&fit=crop', locationId: LOCATION_ID },
    { id: 'short-rib', name: 'Short Rib Taco', categoryId: 'tacos', station: 'grill', priceGross: 450, vatRate: 20, isDrink: false, ingredients: ['Short Rib', 'Pickled Onions', 'Cilantro', 'Crema', 'Salsa'], allergies: ['Dairy'], imageUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?q=80&w=800&auto=format&fit=crop', locationId: LOCATION_ID },
    { id: 'baja-fish', name: 'Baja Fish Taco', categoryId: 'tacos', station: 'grill', priceGross: 400, vatRate: 20, isDrink: false, ingredients: ['Tempura Cod', 'Cabbage Slaw', 'Chipotle Mayo', 'Lime'], allergies: ['Fish', 'Gluten', 'Eggs'], imageUrl: 'https://images.unsplash.com/photo-1512838243191-e81e8f66f1fd?q=80&w=800&auto=format&fit=crop', locationId: LOCATION_ID },
    { id: 'enchiladas', name: 'Enchiladas Caras', categoryId: 'mains', station: 'grill', priceGross: 1450, vatRate: 20, isDrink: false, ingredients: ['Corn Tortillas', 'Shredded Chicken', 'Enchilada Sauce', 'Beans', 'Rice', 'Sour Cream'], allergies: ['Dairy', 'Gluten'], locationId: LOCATION_ID },
    { id: 'churros', name: 'Churros', categoryId: 'desserts', station: 'dessert', priceGross: 600, vatRate: 20, isDrink: false, ingredients: ['Dough', 'Cinnamon Sugar', 'Chocolate Sauce'], allergies: ['Gluten', 'Dairy'], imageUrl: 'https://images.unsplash.com/photo-1549590143-d5855148a9d5?q=80&w=800&auto=format&fit=crop', locationId: LOCATION_ID },
    { id: 'extra-salsa', name: 'Extra Salsa Roja', categoryId: 'extras', station: 'cold', priceGross: 150, vatRate: 20, isDrink: false, locationId: LOCATION_ID },
    { id: 'extra-tortillas', name: 'Extra Corn Tortillas', categoryId: 'extras', station: 'grill', priceGross: 100, vatRate: 20, isDrink: false, locationId: LOCATION_ID }
  ],
  tables: [
    { id: 'T1', name: 'T1', locationId: LOCATION_ID, zoneId: 'main-room', x: 100, y: 100, width: 120, height: 120, status: 'available', guestCount: 0 },
    { id: 'T2', name: 'T2', locationId: LOCATION_ID, zoneId: 'main-room', x: 250, y: 100, width: 120, height: 120, status: 'available', guestCount: 0 },
    { id: 'T3', name: 'T3', locationId: LOCATION_ID, zoneId: 'main-room', x: 100, y: 250, width: 120, height: 120, status: 'available', guestCount: 0 },
    { id: 'T4', name: 'T4', locationId: LOCATION_ID, zoneId: 'main-room', x: 250, y: 250, width: 120, height: 120, status: 'available', guestCount: 0 }
  ],
  zones: [
    { id: 'main-room', name: 'Main Room', locationId: LOCATION_ID }
  ],
  shiftBriefings: [
    {
      id: 'briefing_1',
      date: new Date().toISOString().split('T')[0],
      locationId: LOCATION_ID,
      focusOfDay: 'Upsell premium cocktails & push the new Sea Bass special',
      message: 'Happy Sunday team! We are expecting a busy lunch service with 45 covers booked between 12 and 2pm. Focus on table turnaround and ensuring drinks are delivered within 4 minutes. Let\'s have a great shift!',
      items86: ['Avocado Toast', 'Craft IPA'],
      specials: ['Pan-Seared Sea Bass with Asparagus', 'Watermelon & Raspberry Mojito'],
      challenges: ['Highest cocktail sales wins a bottle of wine', 'Fastest ticket ready time in Kitchen wins a free staff meal'],
      managerAlerts: ['VIP Table 4 at 1pm', 'Check allergy folder for Gluten-Free options'],
      targets: {
        individual: { salesTarget: 40000, dessertTarget: 8, cocktailTarget: 12 },
        floor: { totalSalesTarget: 250000, dessertTarget: 50 },
        bar: { cocktailTarget: 80, premiumDrinkTarget: 100 },
        kitchen: { avgPrepTimeTarget: 12 }
      },
      active: true,
      createdAt: Date.now()
    }
  ],
  posAlerts: [
    {
      id: 'alert_1',
      locationId: LOCATION_ID,
      message: 'Running low on Palomas at the bar - please inform guests.',
      priority: 'warning',
      targetRole: 'waiter',
      active: true,
      createdAt: Date.now()
    },
    {
      id: 'alert_2',
      locationId: LOCATION_ID,
      message: 'VIP Guest seated at Table 12 - check and welcome.',
      priority: 'urgent',
      targetRole: 'manager',
      active: true,
      createdAt: Date.now()
    }
  ],
  posOrders: [
    {
      id: 'h_order_1',
      locationId: LOCATION_ID,
      staffId: 'waiter1',
      tableId: 'T1',
      status: 'paid',
      subtotalGross: 450,
      totalGross: 540, // 20% SC
      vatTotal: 75,
      serviceCharge: 90,
      paymentMethod: 'card',
      createdAt: Date.now() - (25 * 60 * 60 * 1000), // ~25 hours ago (Yesterday)
      paidAt: Date.now() - (24.5 * 60 * 60 * 1000),
      items: [
        { uuid: 'h_i_1', menuItemId: 'short-rib', quantity: 1, totalPrice: 450, status: 'served', course: 'mains' }
      ]
    },
    {
      id: 'h_order_2',
      locationId: LOCATION_ID,
      staffId: 'waiter1',
      tableId: 'T2',
      status: 'paid',
      subtotalGross: 1250,
      totalGross: 1500,
      vatTotal: 200,
      serviceCharge: 250,
      paymentMethod: 'card',
      createdAt: Date.now() - (26 * 60 * 60 * 1000),
      paidAt: Date.now() - (25.5 * 60 * 60 * 1000),
      items: [
        { uuid: 'h_i_2', menuItemId: 'baja-fish', quantity: 2, totalPrice: 800, status: 'served', course: 'mains' },
        { uuid: 'h_i_3', menuItemId: 'margarita', quantity: 1, totalPrice: 450, status: 'served', course: 'drinks' }
      ]
    }
  ],
  posTransactions: [
    {
      id: 'h_order_1',
      ticketNumber: 'CAM-2026-000001',
      orderId: 'h_order_1',
      locationId: LOCATION_ID,
      siteId: LOCATION_ID,
      businessId: 'biz_backbone',
      tableId: 'T1',
      tableName: 'T1',
      staffId: 'waiter1',
      staffName: 'Test Waiter',
      staffRole: 'waiter',
      covers: 2,
      status: 'paid',
      subtotalGross: 450,
      vatTotal: 75,
      serviceCharge: 90,
      discountAmount: 0,
      totalGross: 540,
      amountPaid: 540,
      changeGiven: 0,
      tipsAmount: 0,
      payments: {
        cash: 0,
        card: 540,
        deposit: 0,
        voucher: 0
      },
      createdAt: Date.now() - (25 * 60 * 60 * 1000),
      paidAt: Date.now() - (24.5 * 60 * 60 * 1000),
      isLocked: false,
      snapshotId: 'SNAP-h_order_1'
    },
    {
      id: 'h_order_2',
      ticketNumber: 'CAM-2026-000002',
      orderId: 'h_order_2',
      locationId: LOCATION_ID,
      siteId: LOCATION_ID,
      businessId: 'biz_backbone',
      tableId: 'T2',
      tableName: 'T2',
      staffId: 'waiter1',
      staffName: 'Test Waiter',
      staffRole: 'waiter',
      covers: 4,
      status: 'paid',
      subtotalGross: 1250,
      vatTotal: 200,
      serviceCharge: 250,
      discountAmount: 0,
      totalGross: 1500,
      amountPaid: 1500,
      changeGiven: 0,
      tipsAmount: 0,
      payments: {
        cash: 0,
        card: 1500,
        deposit: 0,
        voucher: 0
      },
      createdAt: Date.now() - (26 * 60 * 60 * 1000),
      paidAt: Date.now() - (25.5 * 60 * 60 * 1000),
      isLocked: false,
      snapshotId: 'SNAP-h_order_2'
    }
  ],
  ticketSnapshots: [
    {
      id: 'SNAP-h_order_1',
      locationId: LOCATION_ID,
      siteId: LOCATION_ID,
      businessId: 'biz_backbone',
      createdAt: Date.now() - (24.5 * 60 * 60 * 1000),
      orderData: {
        id: 'h_order_1',
        locationId: LOCATION_ID,
        staffId: 'waiter1',
        tableId: 'T1',
        status: 'paid',
        subtotalGross: 450,
        totalGross: 540,
        vatTotal: 75,
        serviceCharge: 90,
        paymentMethod: 'card',
        createdAt: Date.now() - (25 * 60 * 60 * 1000),
        paidAt: Date.now() - (24.5 * 60 * 60 * 1000),
        items: [
          {
            uuid: 'h_i_1',
            menuItemId: 'short-rib',
            quantity: 1,
            totalPrice: 450,
            status: 'served',
            course: 'mains',
            snapshot: {
              id: 'short-rib',
              name: 'Short Rib Taco',
              priceGross: 450
            }
          }
        ]
      },
      receiptTemplateData: {
        header: {
          businessName: 'XOLO CAMDEN',
          customHeaderText: 'THE BEST TACOS IN TOWN',
          addressLines: ['123 Camden High St', 'London, NW1 8QL'],
          vatNumber: 'GB 123 4567 89',
          companyNumber: '01234567'
        },
        orderDetails: {
          showServer: true,
          showStaffRole: true,
          showTableNumber: true,
          showGuestCount: true
        },
        totals: {
          showSubtotal: true,
          showGrandTotal: true,
          showServiceCharge: true,
          showVat: true,
          showTips: true,
          showDiscounts: true
        },
        items: {
          showModifiers: true,
          showNotes: true,
          showAllergens: true,
          showVoidedItems: false
        },
        footer: {
          thankYouMessage: 'Thank you for dining with us!',
          wifiDetails: 'XOLO-GUEST / taco-time'
        }
      }
    },
    {
      id: 'SNAP-h_order_2',
      locationId: LOCATION_ID,
      siteId: LOCATION_ID,
      businessId: 'biz_backbone',
      createdAt: Date.now() - (25.5 * 60 * 60 * 1000),
      orderData: {
        id: 'h_order_2',
        locationId: LOCATION_ID,
        staffId: 'waiter1',
        tableId: 'T2',
        status: 'paid',
        subtotalGross: 1250,
        totalGross: 1500,
        vatTotal: 200,
        serviceCharge: 250,
        paymentMethod: 'card',
        createdAt: Date.now() - (26 * 60 * 60 * 1000),
        paidAt: Date.now() - (25.5 * 60 * 60 * 1000),
        items: [
          {
            uuid: 'h_i_2',
            menuItemId: 'baja-fish',
            quantity: 2,
            totalPrice: 800,
            status: 'served',
            course: 'mains',
            snapshot: {
              id: 'baja-fish',
              name: 'Baja Fish Taco',
              priceGross: 400
            }
          },
          {
            uuid: 'h_i_3',
            menuItemId: 'margarita',
            quantity: 1,
            totalPrice: 450,
            status: 'served',
            course: 'drinks',
            snapshot: {
              id: 'margarita',
              name: 'Margarita',
              priceGross: 450
            }
          }
        ]
      },
      receiptTemplateData: {
        header: {
          businessName: 'XOLO CAMDEN',
          customHeaderText: 'THE BEST TACOS IN TOWN',
          addressLines: ['123 Camden High St', 'London, NW1 8QL'],
          vatNumber: 'GB 123 4567 89',
          companyNumber: '01234567'
        },
        orderDetails: {
          showServer: true,
          showStaffRole: true,
          showTableNumber: true,
          showGuestCount: true
        },
        totals: {
          showSubtotal: true,
          showGrandTotal: true,
          showServiceCharge: true,
          showVat: true,
          showTips: true,
          showDiscounts: true
        },
        items: {
          showModifiers: true,
          showNotes: true,
          showAllergens: true,
          showVoidedItems: false
        },
        footer: {
          thankYouMessage: 'Thank you for dining with us!',
          wifiDetails: 'XOLO-GUEST / taco-time'
        }
      }
    }
  ]
};

export const initializeDatabase = async () => {
  console.log('initializeDatabase: Checking collections...');
  const collections = [
    'staffProfiles', 'menuCategories', 'menuItems', 'tables', 'zones', 
    'shiftBriefings', 'posAlerts', 'posOrders', 'posTransactions', 'ticketSnapshots'
  ];
  
  for (const colName of collections) {
    try {
      const colRef = collection(db, colName);
      const q = query(colRef, where('locationId', '==', LOCATION_ID));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log(`Seeding collection: ${colName}`);
        const batch = writeBatch(db);
        const data = (seedData as any)[colName];
        
        if (data && Array.isArray(data)) {
          for (const item of data) {
            batch.set(doc(db, colName, item.id), item);
          }
          await batch.commit();
          console.log(`Successfully seeded ${colName}`);
        }
      } else {
        console.log(`Collection ${colName} already has data for ${LOCATION_ID}`);
      }
    } catch (err) {
      console.error(`Error checking/seeding ${colName}:`, err);
    }
  }
};
