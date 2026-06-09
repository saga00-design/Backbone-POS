import { ReceiptTemplate } from '../../types/receipt';
import { POSOrder } from '../../types/pos';

export const getDefaultReceiptTemplate = (locationId: string): ReceiptTemplate => ({
  id: locationId,
  businessId: 'biz_backbone',
  siteId: locationId,
  templateName: 'Default Customer Receipt',
  isDefault: true,

  paperSize: '80mm',
  fontSize: 'medium',
  lineSpacing: 'normal',
  themeMode: 'light',

  header: {
    showLogo: true,
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3', // High quality pizza restaurant photo
    logoSize: 'medium',
    logoAlign: 'center',
    showBusinessName: true,
    businessName: 'XOLO FOOD CO.',
    businessNameFontSize: 'xl',
    addressLines: [
      '123 Union Street',
      'Aberdeen, AB11 6BH',
      'Phone: 01224 555666'
    ],
    phone: '01224 555666',
    email: 'hello@xolofood.co.uk',
    website: 'www.xolofood.co.uk',
    vatNumber: 'GB 123 4567 89',
    companyNumber: 'SC 987654',
    customHeaderText: 'Welcome to XOLO - Sizzling Flatbreads & Tacos!'
  },

  orderDetails: {
    showServer: true,
    showStaffRole: true,
    showCheckNumber: true,
    showOrderNumber: true,
    showTableNumber: true,
    showGuestCount: true,
    showDate: true,
    showTime: true,
    showOrderType: true,
    showCustomerName: true,
    showCustomerPhone: false,
    showCustomerEmail: false,
    showTillName: true,
    showPaymentMethod: true,
    showPaidTime: true
  },

  items: {
    showQuantity: true,
    showItemName: true,
    showPrice: true,
    showModifiers: true,
    showNotes: true,
    showAllergens: true,
    showCategory: false,
    showCourseName: true,
    showVoidedItems: true,
    showPrepStation: false,
    showCalories: true,
    showSustainabilityScore: true,
    groupByCourse: false,
    groupByCategory: false,
    groupBySeatNumber: false,
    itemStyle: 'standard'
  },

  allergensAndNotes: {
    showAllergensOnTicket: true,
    allergensInUppercase: true,
    highlightAllergenWarnings: true,
    showCustomerNotes: true,
    showKitchenNotes: true,
    showOccasionNotes: true,
    showDietaryTags: true,
    kitchenNotesOnReceipt: false
  },

  totals: {
    showSubtotal: true,
    showDiscounts: true,
    showServiceCharge: true,
    showTips: true,
    showVat: true,
    showGrandTotal: true,
    showAmountPaid: true,
    showChangeDue: true,
    labelOverrides: {
      subtotal: 'Subtotal',
      grandTotal: 'Total Pay',
      serviceCharge: 'Service Charge',
      vat: 'VAT Total'
    }
  },

  vat: {
    showVatSummary: true,
    showVatBreakdown: true,
    vatLabel: 'VAT',
    vatMessage: 'VAT included where applicable.',
    vatInclusive: true
  },

  serviceCharge: {
    enabled: true,
    label: 'Discretionary Service Charge',
    percentage: 12.5,
    showDisclaimer: true,
    disclaimerText: 'Service charge is discretionary and not obligatory. Please let us know if you would like it removed.'
  },

  qrCode: {
    enabled: true,
    qrType: 'payment_link',
    title: 'Easy Mobile Pay',
    subtitle: 'Scan camera to view bill & settle safely',
    customUrl: 'https://xolofood.co.uk/pay/camden-table10',
    size: 'medium',
    position: 'bottom',
    showPaymentLogos: true
  },

  payment: {
    showPaymentMethod: true,
    showCardType: true,
    showLastFourDigits: true,
    showTransactionId: true,
    showSplitPayments: true,
    showAuthCode: true
  },

  footer: {
    thankYouMessage: 'Thank you for dining with us!',
    reviewMessage: 'Scan to leave us a 5-star review for 10% off next visit.',
    socialMessage: 'Connect with us on Instagram @xoloaberdeen',
    refundPolicy: 'If you have any feedback or require refunds, please email hello@xolofood.co.uk.',
    customFooterText: 'GUEST WIFI - Network: XOLO-GUEST / Pass: xolofresh',
    showWebsite: true,
    showInstagram: true,
    wifiDetails: 'Wifi: XOLO-GUEST / Pass: xolofresh',
    charityMessage: 'A 10p fee on optional service is shared directly with local food charities.'
  },

  printOptions: {
    autoPrintAfterPayment: false,
    askBeforePrinting: true,
    openCashDrawer: false,
    autoCut: true,
    copies: 1
  },

  promoBanner: {
    enabled: true,
    text: 'Use code BACKBONE10 for 10% off your next online order!'
  }
});

// A high-quality sample order for use in template building and preview
export const SAMPLE_POS_ORDERS: POSOrder[] = [
  {
    id: 'ord_sample93',
    tableId: 'tbl_10',
    status: 'paid',
    locationId: 'loc_camden',
    covers: 4,
    createdAt: Date.now() - 3600000, // 1 hour ago
    seatedAt: Date.now() - 5400000,  // 1.5 hours ago
    paidAt: Date.now() - 300000,    // 5 mins ago
    staffId: 'stf_stefy',
    subtotalGross: 7785, // stored in pence, i.e., £77.85
    vatTotal: 1298,      // £12.98
    serviceCharge: 973,  // 12.5% of £77.85 = £9.73
    totalGross: 8758,    // £87.58
    discountAmount: 0,
    amountPaid: 8758,
    paymentMethod: 'card',
    payments: [
      {
        id: 'pay_txn441',
        orderId: 'ord_sample93',
        amount: 8758,
        method: 'card',
        timestamp: Date.now() - 300000,
        staffId: 'stf_stefy'
      }
    ],
    items: [
      {
        uuid: 'item_itm1',
        menuItemId: 'm_mojito',
        quantity: 1,
        totalPrice: 550, // in pence, i.e., £5.50
        status: 'served',
        staffId: 'stf_stefy',
        snapshot: {
          id: 'm_mojito',
          name: 'Virgin Mojito',
          priceGross: 550,
          vatRate: 20,
          station: 'bar',
          course: 'drinks',
          categoryId: 'cat_drinks',
          isDrink: true,
          imageUrl: '',
          locationId: 'loc_camden',
          description: 'Minty, zesty, fresh lime mocktail',
          allergies: ['Mint']
        },
        modifiers: [],
        notes: 'Extra ice'
      },
      {
        uuid: 'item_itm2',
        menuItemId: 'm_corona',
        quantity: 1,
        totalPrice: 725, // £7.25
        status: 'served',
        staffId: 'stf_stefy',
        snapshot: {
          id: 'm_corona',
          name: 'Corona Extra',
          priceGross: 725,
          vatRate: 20,
          station: 'bar',
          course: 'drinks',
          categoryId: 'cat_drinks',
          isDrink: true,
          imageUrl: '',
          locationId: 'loc_camden',
          description: 'Mexican pale lager',
          allergies: ['Gluten']
        },
        modifiers: []
      },
      {
        uuid: 'item_itm3',
        menuItemId: 'm_quesadilla',
        quantity: 1,
        totalPrice: 1475, // £14.75
        status: 'served',
        staffId: 'stf_stefy',
        snapshot: {
          id: 'm_quesadilla',
          name: 'Black Bean & Three Cheese Quesadilla',
          priceGross: 1475,
          vatRate: 20,
          station: 'grill',
          course: 'mains',
          categoryId: 'cat_mains',
          isDrink: false,
          locationId: 'loc_camden',
          allergies: ['Dairy', 'Gluten', 'Peanut']
        },
        modifiers: [
          {
            id: 'mod_no_coriander',
            name: 'No Coriander',
            priceDelta: 0
          }
        ],
        notes: 'Allergy alert: PEANUT'
      },
      {
        uuid: 'item_itm4',
        menuItemId: 'm_flatbread',
        quantity: 2,
        totalPrice: 5035, // 2 x £25.17-ish = 50.35 total (rounded for sample)
        status: 'served',
        staffId: 'stf_stefy',
        snapshot: {
          id: 'm_flatbread',
          name: 'XOLO Signature Beef Tacos Flatbread',
          priceGross: 2517,
          vatRate: 20,
          station: 'grill',
          course: 'mains',
          categoryId: 'cat_mains',
          isDrink: false,
          locationId: 'loc_camden',
          allergies: ['Garlic', 'Gluten']
        },
        modifiers: [
          {
            id: 'mod_extra_guac',
            name: 'Add Extra Guacamole',
            priceDelta: 200
          }
        ]
      }
    ]
  }
];
