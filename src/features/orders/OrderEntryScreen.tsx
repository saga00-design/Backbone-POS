import React from 'react';
import { usePOSStore, resolveCourseForItem } from '../../app/store';
import { POSOrder, MenuItemSnapshot, ModifierSelection, PaymentMethod, POSOrderItem, Course, IngredientAction, AllergyCustomisation } from '../../types/pos';
import { PricingEngine } from '../../domain/PricingEngine';
import { ChevronLeft, Plus, Minus, Trash2, Send, CreditCard, Utensils, Gift, Percent, Printer, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ModifierModal } from '../../components/orders/ModifierModal';
import { PaymentModal } from '../../components/orders/PaymentModal';
import { ItemActionsModal } from '../../components/orders/ItemActionsModal';
import { ItemDetailModal } from '../../components/orders/ItemDetailModal';
import { POSDiscountModal } from '../../components/orders/POSDiscountModal';
import { CancelSessionModal } from '../../components/orders/CancelSessionModal';
import { POS_CONFIG } from '../../app/config';

export const OrderEntryScreen: React.FC = () => {
  const { activeTable, activeOrder, setActiveOrder, setActiveScreen, addItem, removeItem, updateQuantity, updateItemInOrder, processPayment, sendOrder, fireCourse, currentStaff, menuItems, categories } = usePOSStore();
  const [activeCategory, setActiveCategory] = React.useState(categories[0]?.id || '');
  const [selectedItem, setSelectedItem] = React.useState<MenuItemSnapshot | null>(null);
  const [detailSelectedItem, setDetailSelectedItem] = React.useState<MenuItemSnapshot | null>(null);
  const [actionSelectedItem, setActionSelectedItem] = React.useState<POSOrderItem | null>(null);
  const [showPayment, setShowPayment] = React.useState(false);
  const [showDiscount, setShowDiscount] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [showOrderMobile, setShowOrderMobile] = React.useState(false);
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [hasDeclinedAutoCancel, setHasDeclinedAutoCancel] = React.useState(false);
  const [emptySince, setEmptySince] = React.useState<number | null>(null);
  const [changingCourseName, setChangingCourseName] = React.useState<Course | null>(null);
  const { cancelSession } = usePOSStore();

  const handlePrintBill = () => {
    setIsPrinting(true);
    setTimeout(() => setIsPrinting(false), 2000);
  };

  const isEmptySession = !activeOrder || activeOrder.items.length === 0 || activeOrder.totalGross <= 0;

  // Track when order becomes empty
  React.useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.items.length === 0 && activeOrder.totalGross === 0) {
      if (!emptySince) {
        setEmptySince(Date.now());
      }
    } else {
      setEmptySince(null);
      setHasDeclinedAutoCancel(false); // Reset decline state if items are added
    }
  }, [activeOrder?.items?.length, activeOrder?.totalGross, emptySince]);

  // Prompt for auto-close if items removed and total is 0 AND inactive for 2 minutes
  React.useEffect(() => {
    if (!activeOrder) return;
    if (emptySince && !showCancelModal && !hasDeclinedAutoCancel) {
      const INACTIVITY_LIMIT = 2 * 60 * 1000; // 2 minutes (several minutes)
      
      const checkInactivity = () => {
        const timePassed = Date.now() - emptySince;
        if (timePassed >= INACTIVITY_LIMIT) {
          // Only show if we've been open for a bit (not just initialized)
          if (activeOrder.createdAt < Date.now() - 500) {
            setShowCancelModal(true);
          }
        }
      };

      const timer = setInterval(checkInactivity, 5000); // Check every 5 seconds
      return () => clearInterval(timer);
    }
  }, [emptySince, showCancelModal, hasDeclinedAutoCancel, activeOrder?.createdAt]);

  // Update active category if categories change and current is empty
  React.useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  // Initialize order if it doesn't exist
  React.useEffect(() => {
    if (activeTable && !activeOrder) {
      const newOrder: POSOrder = {
        id: `ORD-${Math.random().toString(36).substring(7)}`,
        tableId: activeTable.id,
        status: 'draft',
        items: [],
        subtotalGross: 0,
        vatTotal: 0,
        serviceCharge: 0,
        totalGross: 0,
        amountPaid: 0,
        payments: [],
        staffId: currentStaff?.id || '',
        createdAt: Date.now(),
        seatedAt: Date.now(),
        locationId: POS_CONFIG.LOCATION_ID,
      };
      setActiveOrder(newOrder);
    }
  }, [activeTable, activeOrder, setActiveOrder, currentStaff]);

  if (!activeTable || !activeOrder) return null;

  const handleItemClick = (item: MenuItemSnapshot) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setSelectedItem(item);
    } else {
      addItem({
        menuItemId: item.id,
        snapshot: item,
        modifiers: [],
        status: 'draft',
        quantity: 1,
        course: resolveCourseForItem(item, categories),
        staffId: currentStaff?.id || '',
      });
    }
  };

  const handleModifierConfirm = (
    modifiers: ModifierSelection[], 
    notes: string, 
    quantity: number, 
    adjustments?: Record<string, IngredientAction>,
    allergyCustomisations?: AllergyCustomisation[]
  ) => {
    if (selectedItem || detailSelectedItem) {
      const activeItem = selectedItem || detailSelectedItem;
      if (!activeItem) return;

      addItem({
        menuItemId: activeItem.id,
        snapshot: activeItem,
        modifiers,
        ingredientAdjustments: adjustments,
        notes,
        quantity,
        course: resolveCourseForItem(activeItem, categories),
        status: 'draft',
        staffId: currentStaff?.id || '',
        allergyCustomisations,
      });
      setSelectedItem(null);
      setDetailSelectedItem(null);
    }
  };

  const handlePayment = (amount: number, method: PaymentMethod) => {
    processPayment(amount, method);
    // If fully paid, we might want to close the order and return to floor
    if (activeOrder.amountPaid + amount >= activeOrder.totalGross) {
      setTimeout(() => {
        setActiveOrder(null);
        setActiveScreen('floor');
      }, 2000);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden relative">
      {selectedItem && (
        <ModifierModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onConfirm={handleModifierConfirm} 
        />
      )}
      {detailSelectedItem && (
        <ItemDetailModal
          item={detailSelectedItem}
          onClose={() => setDetailSelectedItem(null)}
          onConfirm={handleModifierConfirm}
        />
      )}
      {actionSelectedItem && (
        <ItemActionsModal
          item={actionSelectedItem}
          onClose={() => setActionSelectedItem(null)}
        />
      )}
      {showPayment && (
        <PaymentModal
          order={activeOrder}
          onClose={() => setShowPayment(false)}
          onProcess={handlePayment}
        />
      )}
      {showDiscount && activeOrder && (
        <POSDiscountModal 
          order={activeOrder} 
          onClose={() => setShowDiscount(false)} 
        />
      )}
      {showCancelModal && (
        <CancelSessionModal
          onClose={() => {
            setShowCancelModal(false);
            setHasDeclinedAutoCancel(true);
          }}
          onConfirm={(reason) => {
            cancelSession(reason);
            setShowCancelModal(false);
          }}
        />
      )}
      {/* Menu Section */}
      <div className={cn(
        "flex-1 flex flex-col bg-bg-dark border-r border-white/5 transition-all duration-300",
        showOrderMobile ? "hidden lg:flex" : "flex"
      )}>
        <div className="h-16 lg:h-20 bg-bg-card border-b border-white/5 flex items-center px-4 lg:px-6 gap-4 shrink-0 justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveScreen('floor')}
              className="p-2 text-text-secondary hover:text-white hover:bg-white/5 rounded-xl"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg lg:text-xl font-black text-white uppercase tracking-tight">Table {activeTable.name}</h2>
          </div>
          
          <button 
            onClick={() => setShowOrderMobile(true)}
            className="lg:hidden flex items-center gap-2 bg-brand-primary px-4 py-2 rounded-xl text-white font-black text-[10px] uppercase tracking-widest"
          >
            <Utensils className="w-4 h-4" />
            View Order ({activeOrder.items.length})
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Items Content Middle Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0">
            {/* Mobile Category Selector (Scrollable Horizontal Strip at Top - Mobile only) */}
            <div className="flex lg:hidden bg-[#161a26]/40 border-b border-white/5 p-2 gap-1.5 px-3 shrink-0 items-center overflow-x-auto no-scrollbar">
              <span className="text-[8px] font-black text-brand-primary uppercase tracking-[0.15em] shrink-0 mr-1">CATEGORY:</span>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg flex items-center justify-center transition-all border text-[9px] font-black uppercase tracking-wider shrink-0",
                    activeCategory === cat.id 
                      ? "bg-brand-primary border-brand-primary text-white shadow-sm shadow-brand-primary/10" 
                      : "bg-white/5 border-white/5 text-text-secondary"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="flex-1 p-2 lg:p-6 overflow-y-auto">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-1.5 md:gap-2">
                {menuItems.filter(item => item.categoryId === activeCategory).map(item => (
                  <div 
                    key={item.id}
                    className="aspect-[1.45/1] bg-bg-card border border-white/5 rounded-lg lg:rounded-xl flex flex-col hover:bg-bg-accent transition-all group overflow-hidden relative"
                  >
                    <button
                      onClick={() => handleItemClick(item)}
                      className="flex-1 p-1.5 lg:p-2.5 flex flex-col justify-between text-left w-full h-full"
                    >
                      <span className="text-[10px] lg:text-xs font-bold text-white leading-tight uppercase tracking-tight line-clamp-2">{item.name}</span>
                      <span className="text-[8px] lg:text-[10px] font-mono text-brand-primary font-bold">
                        {PricingEngine.formatCurrency(item.priceGross)}
                      </span>
                    </button>
                    
                    {/* View Details Overlay Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailSelectedItem(item);
                      }}
                      className="absolute bottom-1.5 right-1.5 p-1 bg-white/5 hover:bg-brand-primary hover:text-white rounded text-text-muted transition-all lg:opacity-0 group-hover:opacity-100"
                      title="View Details"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Categories Sidebar - Elegant on Desktop, hidden on Mobile */}
          <div className="hidden lg:flex lg:w-32 bg-white/[0.02] border-l border-white/5 flex-col py-3 gap-1 overflow-y-auto no-scrollbar shrink-0">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "py-2.5 px-0.5 lg:py-4 lg:px-2 text-[8px] lg:text-[10px] uppercase font-black tracking-wider lg:tracking-widest text-center transition-all line-clamp-2 break-all border-b border-white/[0.02]",
                  activeCategory === cat.id ? "bg-brand-primary text-white" : "text-text-secondary hover:text-white"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Order Panel */}
      <div className={cn(
        "bg-bg-card flex flex-col shrink-0 transition-all duration-300",
        "fixed inset-0 z-40 lg:relative lg:inset-auto lg:w-96 lg:flex",
        showOrderMobile ? "flex" : "hidden"
      )}>
        <div className="h-16 lg:h-20 border-b border-white/5 flex items-center px-4 lg:px-6 shrink-0 justify-between">
          <h3 className="text-lg font-black text-white uppercase tracking-tight">Current Order</h3>
          <button 
            onClick={() => setShowOrderMobile(false)}
            className="lg:hidden p-2 text-text-secondary hover:text-white"
          >
            <ChevronLeft className="w-6 h-6 rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-4 no-scrollbar">
          {activeOrder.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-20">
              <Utensils className="w-16 h-16 mb-4" />
              <span className="text-xs font-black uppercase tracking-widest">Empty Order</span>
            </div>
          ) : (
            (['drinks', 'starters', 'tacos', 'mains', 'desserts', 'sides', 'extras'] as const).map(courseName => {
              const itemsInCourse = activeOrder.items.filter(i => (i.course || 'mains') === courseName);
              if (itemsInCourse.length === 0) return null;
              
              const hasSentItems = itemsInCourse.some(i => i.status !== 'draft' && i.status !== 'voided');
              const hasUnfired = itemsInCourse.some(i => i.status === 'held');
              const hasFired = itemsInCourse.some(i => i.status === 'fired' || !!i.firedAt);
              
              return (
                <div key={courseName} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 flex-1">
                      {changingCourseName === courseName ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                          <span className="text-[8px] font-black text-text-muted uppercase tracking-wider">Move items of this course to:</span>
                          {(['drinks', 'starters', 'tacos', 'mains', 'desserts', 'sides', 'extras'] as const)
                            .filter(c => c !== courseName)
                            .map(targetCourse => (
                              <button
                                key={targetCourse}
                                onClick={async () => {
                                  // Update all items in this course group
                                  const draftOrAllInCourse = activeOrder.items.filter(i => (i.course || 'mains') === courseName);
                                  for (const item of draftOrAllInCourse) {
                                    await updateItemInOrder(item.uuid, { course: targetCourse });
                                  }
                                  setChangingCourseName(null);
                                }}
                                className="px-1.5 py-0.5 rounded bg-brand-primary hover:bg-white hover:text-brand-primary text-white text-[8px] font-bold uppercase tracking-wider transition-all"
                              >
                                {targetCourse.substring(0, 3)}
                              </button>
                            ))}
                          <button 
                            onClick={() => setChangingCourseName(null)}
                            className="text-[8px] font-bold uppercase text-status-pending px-1 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setChangingCourseName(courseName)}
                          className="group/courseBtn text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] hover:text-white flex items-center gap-1 transition-colors"
                          title="Click to change course for these items"
                        >
                          <span>{courseName}</span>
                          <span className="text-[7px] text-text-muted group-hover/courseBtn:text-brand-primary font-bold lowercase opacity-70 group-hover/courseBtn:opacity-100">(change)</span>
                        </button>
                      )}
                      
                      {changingCourseName !== courseName && <div className="flex-1 h-px bg-white/10" />}
                    </div>
                    {hasSentItems && (
                      <button 
                        onClick={() => hasUnfired && fireCourse(activeOrder.id, courseName)}
                        disabled={!hasUnfired}
                        className={cn(
                          "ml-3 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                          hasUnfired 
                            ? "bg-amber-500 text-white border border-amber-400 animate-pulse shadow-lg shadow-amber-500/20" 
                            : "bg-white/5 text-emerald-500/50 border border-emerald-500/10 cursor-default"
                        )}
                      >
                        {hasUnfired ? 'Fire' : 'Fired'}
                      </button>
                    )}
                  </div>
                  {itemsInCourse.map(item => (
                    <div 
                      key={item.uuid} 
                      className={cn(
                        "bg-white/5 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all border border-transparent hover:border-white/10",
                        item.status === 'voided' && "opacity-40 grayscale"
                      )}
                    >
                      {/* Name & Price closer together, plus enlarged by 20-30% */}
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={cn("text-sm font-black text-white uppercase tracking-tight leading-tight flex-1 break-words", item.status === 'voided' && "line-through")}>
                          <span className="text-brand-primary mr-1.5 font-black">{item.quantity}X</span>
                          {item.snapshot?.name || 'Unknown Item'}
                        </h4>
                        <span className="text-sm font-mono font-black text-white shrink-0">
                          {PricingEngine.formatCurrency(item.totalPrice)}
                        </span>
                      </div>

                      {/* Modifiers or ingredient adjustments */}
                      {(item.modifiers.length > 0 || (item.ingredientAdjustments && Object.entries(item.ingredientAdjustments).some(([_, action]) => action !== 'standard'))) && (
                        <div className="flex flex-wrap gap-1">
                          {item.modifiers.map(m => (
                            <span key={m.id} className="text-[7px] bg-brand-primary/10 text-brand-primary px-1 py-0.5 rounded font-black uppercase tracking-tighter">
                              {m.name}
                            </span>
                          ))}
                          {item.ingredientAdjustments && Object.entries(item.ingredientAdjustments)
                            .filter(([_, action]) => action !== 'standard')
                            .map(([name, action]) => (
                              <span key={name} className={cn(
                                "text-[7px] px-1 py-0.5 rounded font-black uppercase tracking-tighter",
                                action === 'no' && "bg-status-pending/10 text-status-pending",
                                action === 'extra' && "bg-brand-primary/10 text-brand-primary",
                                action === 'side' && "bg-amber-500/10 text-amber-500"
                              )}>
                                {action === 'no' ? 'NO ' : action === 'extra' ? 'EXTRA ' : action === 'side' ? 'SIDE ' : ''}{name}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Allergy/Additional Notes in eye-catching red, just slightly smaller than menu item name for supreme comfort */}
                      {item.notes && (
                        <p className="text-xs text-status-pending font-bold leading-normal break-words whitespace-normal border-l-2 border-status-pending/40 pl-1.5 mt-0.5">
                          "{item.notes}"
                        </p>
                      )}

                      {/* Footer level values and Edit trigger */}
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
                        <div className="flex-1 min-w-0">
                          {item.discountAmount && item.discountAmount > 0 ? (
                            <div className="flex items-center gap-1 text-emerald-400">
                              <Gift className="w-2.5 h-2.5 shrink-0" />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                -{PricingEngine.formatCurrency(item.discountAmount)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[8px] font-black text-text-muted uppercase tracking-wider block truncate">
                              Status: {item.status.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => setActionSelectedItem(item)}
                          className="px-2 py-0.5 bg-brand-primary/15 hover:bg-brand-primary hover:text-white text-[9px] font-black text-brand-primary uppercase tracking-wider rounded transition-all active:scale-95"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Totals & Actions */}
        <div className="p-3 md:p-4 bg-bg-accent border-t border-white/5 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-text-secondary text-[9px] md:text-[10px] uppercase font-black tracking-widest leading-none">
              <span>Subtotal (Exc. VAT)</span>
              <span className="font-mono">{PricingEngine.formatCurrency(activeOrder.subtotalGross)}</span>
            </div>
            <div className="flex justify-between text-text-secondary text-[9px] md:text-[10px] uppercase font-black tracking-widest leading-none">
              <span>VAT</span>
              <span className="font-mono">{PricingEngine.formatCurrency(activeOrder.vatTotal)}</span>
            </div>
            <div className="flex justify-between text-text-secondary text-[9px] md:text-[10px] uppercase font-black tracking-widest leading-none">
              <span>Service Charge (12.5%)</span>
              <span className="font-mono">{PricingEngine.formatCurrency(activeOrder.serviceCharge)}</span>
            </div>
            <div className="flex justify-between text-text-secondary text-[9px] md:text-[10px] uppercase font-black tracking-widest leading-none">
              <button 
                onClick={() => setShowDiscount(true)} 
                className="hover:text-white transition-all p-0 h-auto min-h-0 text-left uppercase outline-none flex items-center text-[9px] md:text-[10px]"
              >
                DISCOUNTS
              </button>
              <span className="font-mono">
                {(activeOrder.discountAmount && activeOrder.discountAmount > 0) ? '-' : ''}
                {PricingEngine.formatCurrency(activeOrder.discountAmount || 0)}
              </span>
            </div>
            {activeOrder.amountPaid > 0 && (
              <div className="flex justify-between text-status-available text-[9px] md:text-[10px] uppercase font-black tracking-widest">
                <span>Paid</span>
                <span className="font-mono">-{PricingEngine.formatCurrency(activeOrder.amountPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-white text-sm md:text-base font-black pt-1.5 border-t border-white/5">
              <span>Total</span>
              <span className="font-mono">{PricingEngine.formatCurrency(activeOrder.totalGross - activeOrder.amountPaid)}</span>
            </div>
          </div>
          
          <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-lg p-2 flex items-center justify-center gap-2 text-[16px]">
            <AlertTriangle className="w-3 h-3 text-brand-primary animate-pulse" />
            <p className="text-[12px] font-black text-brand-primary uppercase tracking-[0.15em] text-center">
              Repeat order before sending
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {isEmptySession ? (
              <button 
                onClick={() => setShowCancelModal(true)}
                className="w-full h-10 bg-status-pending rounded-lg flex items-center justify-center gap-2 text-white font-black uppercase tracking-widest shadow-md shadow-status-pending/10 active:scale-95 transition-all text-xs"
              >
                <Trash2 className="w-4 h-4" />
                Cancel Session
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                <button 
                  onClick={async () => {
                    await sendOrder();
                    setActiveScreen('floor');
                  }}
                  disabled={activeOrder.items.length === 0}
                  className="h-10 bg-white/5 rounded-lg flex items-center justify-center gap-1.5 text-white font-black uppercase tracking-tight active:scale-95 transition-all border border-white/10 text-xs px-1"
                >
                  <Send className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  Send
                </button>
                <button 
                  onClick={() => setShowPayment(true)}
                  disabled={activeOrder.items.length === 0 || activeOrder.amountPaid >= activeOrder.totalGross}
                  className="h-10 bg-brand-primary disabled:opacity-20 rounded-lg flex items-center justify-center gap-1.5 text-white font-black uppercase tracking-tight shadow-md shadow-brand-primary/10 active:scale-95 transition-all text-xs px-1"
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  Pay
                </button>
                <button 
                  onClick={handlePrintBill}
                  disabled={activeOrder.items.length === 0 || isPrinting}
                  className={cn(
                    "h-10 border rounded-lg flex items-center justify-center gap-1 text-white font-black uppercase tracking-tight transition-all text-xs px-1",
                    isPrinting 
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                      : "bg-white/5 border-white/10 text-text-secondary hover:text-white"
                  )}
                >
                  <Printer className={cn("w-3.5 h-3.5 shrink-0", isPrinting && "animate-bounce")} />
                  <span>{isPrinting ? 'Sent' : 'Print'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
