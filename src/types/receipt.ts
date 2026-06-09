export interface ReceiptTemplate {
  id: string; // matches locationId
  businessId: string;
  siteId: string;
  templateName: string;
  isDefault: boolean;

  paperSize: '58mm' | '80mm' | 'A4';
  fontSize: 'small' | 'medium' | 'large';
  lineSpacing: 'compact' | 'normal' | 'spacious';
  themeMode: 'light' | 'dark';

  header: {
    showLogo: boolean;
    logoUrl: string;
    logoSize: 'small' | 'medium' | 'large';
    logoAlign: 'left' | 'center' | 'right';
    showBusinessName: boolean;
    businessName: string;
    businessNameFontSize: string; // e.g. "lg", "xl", "2xl"
    addressLines: string[];
    phone: string;
    email: string;
    website: string;
    vatNumber: string;
    companyNumber: string;
    customHeaderText: string;
  };

  orderDetails: {
    showServer: boolean;
    showStaffRole: boolean;
    showCheckNumber: boolean;
    showOrderNumber: boolean;
    showTableNumber: boolean;
    showGuestCount: boolean;
    showDate: boolean;
    showTime: boolean;
    showOrderType: boolean;
    showCustomerName: boolean;
    showCustomerPhone: boolean;
    showCustomerEmail: boolean;
    showTillName: boolean;
    showPaymentMethod: boolean;
    showPaidTime: boolean;
  };

  items: {
    showQuantity: boolean;
    showItemName: boolean;
    showPrice: boolean;
    showModifiers: boolean;
    showNotes: boolean;
    showAllergens: boolean;
    showCategory: boolean;
    showCourseName: boolean;
    showVoidedItems: boolean;
    showPrepStation: boolean;
    showCalories: boolean;
    showSustainabilityScore: boolean;
    groupByCourse: boolean;
    groupByCategory: boolean;
    groupBySeatNumber: boolean;
    itemStyle: 'compact' | 'standard' | 'detailed' | 'premium';
  };

  allergensAndNotes: {
    showAllergensOnTicket: boolean;
    allergensInUppercase: boolean;
    highlightAllergenWarnings: boolean;
    showCustomerNotes: boolean;
    showKitchenNotes: boolean;
    showOccasionNotes: boolean;
    showDietaryTags: boolean; // vegan, vegetarian, gf, df, etc.
    kitchenNotesOnReceipt: boolean; // whether to show on customer ticket or not
  };

  totals: {
    showSubtotal: boolean;
    showDiscounts: boolean;
    showServiceCharge: boolean;
    showTips: boolean;
    showVat: boolean;
    showGrandTotal: boolean;
    showAmountPaid: boolean;
    showChangeDue: boolean;
    labelOverrides: {
      subtotal: string;
      grandTotal: string;
      serviceCharge: string;
      vat: string;
    };
  };

  vat: {
    showVatSummary: boolean;
    showVatBreakdown: boolean;
    vatLabel: string;
    vatMessage: string;
    vatInclusive: boolean;
  };

  serviceCharge: {
    enabled: boolean;
    label: string;
    percentage: number;
    showDisclaimer: boolean;
    disclaimerText: string;
  };

  qrCode: {
    enabled: boolean;
    qrType: 'payment_link' | 'review_link' | 'loyalty_signup' | 'menu' | 'feedback' | 'custom';
    title: string;
    subtitle: string;
    customUrl: string;
    size: 'small' | 'medium' | 'large';
    position: 'top' | 'middle' | 'bottom';
    showPaymentLogos: boolean;
  };

  payment: {
    showPaymentMethod: boolean;
    showCardType: boolean;
    showLastFourDigits: boolean;
    showTransactionId: boolean;
    showSplitPayments: boolean;
    showAuthCode: boolean;
  };

  footer: {
    thankYouMessage: string;
    reviewMessage: string;
    socialMessage: string;
    refundPolicy: string;
    customFooterText: string;
    showWebsite: boolean;
    showInstagram: boolean;
    wifiDetails: string;
    charityMessage: string;
  };

  printOptions: {
    autoPrintAfterPayment: boolean;
    askBeforePrinting: boolean;
    openCashDrawer: boolean;
    autoCut: boolean;
    copies: number;
  };

  promoBanner: {
    enabled: boolean;
    text: string;
  };
}
