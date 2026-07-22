import React from 'react';
import { usePOSStore, resolveCourseForItem } from '../../app/store';
import { POSOrder, MenuItemSnapshot, ModifierSelection, PaymentMethod, POSOrderItem, Course, IngredientAction, AllergyCustomisation, UnavailableItem, SetMenu } from '../../types/pos';
import { PricingEngine } from '../../domain/PricingEngine';
import { ChevronLeft, Trash2, Send, SendHorizonal, CreditCard, Utensils, Gift, Percent, Printer, AlertTriangle, Info, Search, X, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PaymentModal } from '../../components/orders/PaymentModal';
import { ItemActionsModal } from '../../components/orders/ItemActionsModal';
import { ItemDetailModal } from '../../components/orders/ItemDetailModal';
import { POSDiscountModal } from '../../components/orders/POSDiscountModal';
import { CancelSessionModal } from '../../components/orders/CancelSessionModal';
import { POS_CONFIG } from '../../app/config';

export const OrderEntryScreen: React.FC = () => {
  const {
    activeTable, activeOrder, setActiveOrder, setActiveScreen,
    addItem, removeItem, updateQuantity, updateItemInOrder,
    processPayment, sendOrder, fireCourse, cancelSession,
    voidItem, transferItem, tables,
    currentStaff, menuItems, categories, unavailableItems, activeSetMenus,
    fixSidesCategoryMismatch,
  } = usePOSStore();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory]         = React.useState(categories[0]?.id || '');
  const [selectedTopLevel, setSelectedTopLevel]     = React.useState<string>('');
  const [selectedSubfolder, setSelectedSubfolder]   = React.useState<string | null>(null);
  const [detailSelectedItem, setDetailSelectedItem] = React.useState<MenuItemSnapshot | null>(null);
  const [actionSelectedItem, setActionSelectedItem] = React.useState<POSOrderItem | null>(null);
  const [showPayment, setShowPayment]               = React.useState(false);
  const [showDiscount, setShowDiscount]             = React.useState(false);
  const [isPrinting, setIsPrinting]                 = React.useState(false);
  const [showOrderMobile, setShowOrderMobile]       = React.useState(false);
  const [showCancelModal, setShowCancelModal]       = React.useState(false);
  const [hasDeclinedAutoCancel, setHasDeclinedAutoCancel] = React.useState(false);
  const [emptySince, setEmptySince]                 = React.useState<number | null>(null);
  const [changingCourseName, setChangingCourseName] = React.useState<Course | null>(null);
  const [searchQuery, setSearchQuery]               = React.useState('');
  const [selectedSetMenu, setSelectedSetMenu]       = React.useState<SetMenu | null>(null);
  const [covers, setCovers]                         = React.useState(1);

  // ── BULK SELECTION ─────────────────────────────────────────────────────────
  const [bulkMode, setBulkMode]                     = React.useState(false);
  const [selectedUuids, setSelectedUuids]           = React.useState<string[]>([]);
  const [showBulkVoid, setShowBulkVoid]             = React.useState(false);
  const [showBulkDiscount, setShowBulkDiscount]     = React.useState(false);
  const [showBulkTransfer, setShowBulkTransfer]     = React.useState(false);
  const [bulkVoidReason, setBulkVoidReason]         = React.useState('');
  const [bulkDiscountType, setBulkDiscountType]     = React.useState<'percentage' | 'fixed'>('percentage');
  const [bulkDiscountValue, setBulkDiscountValue]   = React.useState(0);
  const [bulkTransferTable, setBulkTransferTable]   = React.useState('');

  const toggleItemSelection = (uuid: string) => {
    setSelectedUuids(prev =>
      prev.includes(uuid)
        ? prev.filter(id => id !== uuid)
        : [...prev, uuid]
    );
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedUuids([]);
  };

  // ── UTILS ──────────────────────────────────────────────────────────────────
  const handlePrintBill = () => {
    setIsPrinting(true);
    setTimeout(() => setIsPrinting(false), 2000);
  };

  const isEmptySession = !activeOrder || activeOrder.items.length === 0 || activeOrder.totalGross <= 0;

  // ── EFFECTS ────────────────────────────────────────────────────────────────

  // Track empty order for auto-cancel prompt
  React.useEffect(() => {
    if (!activeOrder) return;
    if (activeOrder.items.length === 0 && activeOrder.totalGross === 0) {
      if (!emptySince) setEmptySince(Date.now());
    } else {
      setEmptySince(null);
      setHasDeclinedAutoCancel(false);
    }
  }, [activeOrder?.items?.length, activeOrder?.totalGross, emptySince]);

  // Auto-cancel after 2 min of inactivity on empty order
  React.useEffect(() => {
    if (!activeOrder) return;
    if (emptySince && !showCancelModal && !hasDeclinedAutoCancel) {
      const INACTIVITY_LIMIT = 2 * 60 * 1000;
      const checkInactivity = () => {
        if (Date.now() - emptySince >= INACTIVITY_LIMIT) {
          if (activeOrder.createdAt < Date.now() - 500) setShowCancelModal(true);
        }
      };
      const timer = setInterval(checkInactivity, 5000);
      return () => clearInterval(timer);
    }
  }, [emptySince, showCancelModal, hasDeclinedAutoCancel, activeOrder?.createdAt]);

  // Initialise top-level nav when categories load
  React.useEffect(() => {
    if (categories.length > 0 && !selectedTopLevel) {
      const firstTop = categories.find(c => !c.parentId);
      if (firstTop) {
        setSelectedTopLevel(firstTop.id);
        const hasSubs = categories.some(c => c.parentId === firstTop.id);
        if (!hasSubs) setActiveCategory(firstTop.id);
      }
    }
  }, [categories, selectedTopLevel]);

  // Reset covers to 1 whenever a different set menu is opened
  React.useEffect(() => {
    setCovers(1);
  }, [selectedSetMenu]);

  // TEMP MIGRATION — remove after confirming Fix 2 (Sides showing 0 items) resolved
  const hasRunSidesFixRef = React.useRef(false);
  React.useEffect(() => {
    if (hasRunSidesFixRef.current) return;
    if (menuItems.some(i => i.categoryId === 'cat_sides')) {
      hasRunSidesFixRef.current = true;
      fixSidesCategoryMismatch();
    }
  }, [menuItems, fixSidesCategoryMismatch]);

  // Initialise order if it doesn't exist
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

  // ── CATEGORY HELPERS ───────────────────────────────────────────────────────
  const topLevelCategories = categories
    .filter(c => !c.parentId && !(c as any).hidden && c.id !== 'cat_specials')
    .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
  // TEMP DEBUG — remove after diagnosing Fix 2 (Sides showing 0 items)
  console.log('[DEBUG] all categories:\n' + categories.map(c => `${c.id} | name="${c.name}" | parentId=${(c as any).parentId || 'none'}`).join('\n'));

  const getSubfolders = (parentId: string) =>
    categories
      .filter(c => c.parentId === parentId)
      .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));

  // Recursively collect all descendant category IDs (for item counting)
  const collectIds = (id: string): string[] => {
    const children = categories.filter(c => c.parentId === id);
    return [id, ...children.flatMap(c => collectIds(c.id))];
  };

  const getItemCount = (categoryId: string): number => {
    const ids = collectIds(categoryId);
    const count = menuItems.filter(item => ids.includes(item.categoryId)).length;
    const cat = categories.find(c => c.id === categoryId);
    if (cat && /sides?/i.test(cat.name)) {
      // TEMP DEBUG — remove after diagnosing Fix 2 (Sides showing 0 items)
      console.log(`[DEBUG SIDES] category "${cat.name}" (id=${categoryId}) collectIds:`, ids.join(', '));
      console.log('[DEBUG SIDES] total menuItems:', menuItems.length);
      const sideFlagged = menuItems.filter(i => i.isSide);
      console.log(
        `[DEBUG SIDES] first 5 isSide===true items (of ${sideFlagged.length} total):\n` +
        sideFlagged.slice(0, 5).map(i => `${i.name} | categoryId=${i.categoryId} | priceGross=${i.priceGross}`).join('\n')
      );
    }
    return count;
  };

  // Click a top-level sidebar button
  const handleTopLevelClick = (catId: string) => {
    const subs = getSubfolders(catId);
    setSelectedTopLevel(catId);
    setSelectedSubfolder(null);
    setSearchQuery('');
    setSelectedSetMenu(null);
    // If no subfolders, go straight to items
    if (subs.length === 0) setActiveCategory(catId);
  };

  const mapCourseName = (name?: string): Course => {
    const n = (name || '').toLowerCase();
    if (n.includes('start')) return 'starters';
    if (n.includes('main')) return 'mains';
    if (n.includes('dessert')) return 'desserts';
    if (n.includes('drink') || n.includes('bebida') || n.includes('beverage')) return 'drinks';
    return 'mains';
  };

  // Click a subfolder card in the grid
  const handleSubfolderClick = (subId: string) => {
    setSelectedSubfolder(subId);
    setActiveCategory(subId);
    setSearchQuery('');
  };

  // ── SEARCH + FILTER ────────────────────────────────────────────────────────
  const activeCategoryIds = React.useMemo(() => {
    const ids = new Set<string>([activeCategory]);
    const level2 = categories.filter(c => c.parentId === activeCategory).map(c => c.id);
    level2.forEach(id => {
      ids.add(id);
      categories.filter(c => c.parentId === id).forEach(c => ids.add(c.id));
    });
    return Array.from(ids);
  }, [activeCategory, categories]);

  const isSearching = searchQuery.trim().length > 0;

  const filteredItems = isSearching
    ? menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : menuItems.filter(item => activeCategoryIds.includes(item.categoryId))
        .filter(item => item.priceGross > 0);

  // ── NAVIGATION DERIVED STATE ───────────────────────────────────────────────
  const currentSubs    = getSubfolders(selectedTopLevel);
  const showSubfolderGrid = currentSubs.length > 0 && !selectedSubfolder && !isSearching;
  const topLevelName   = selectedTopLevel === 'set_menus'
    ? 'Set Menus & Specials'
    : categories.find(c => c.id === selectedTopLevel)?.name || '';
  const subfolderName  = selectedSubfolder
    ? categories.find(c => c.id === selectedSubfolder)?.name
    : null;

  // ── ITEM HANDLERS ──────────────────────────────────────────────────────────
  const handleItemClick = (item: MenuItemSnapshot) => {
    addItem({
      menuItemId: item.id,
      snapshot: item,
      status: 'draft',
      quantity: 1,
      course: resolveCourseForItem(item, categories),
      staffId: currentStaff?.id || '',
    });
  };

  const handleModifierConfirm = (
    _modifiers: ModifierSelection[],
    notes: string,
    quantity: number,
    adjustments?: Record<string, IngredientAction>,
    allergyCustomisations?: AllergyCustomisation[]
  ) => {
    const activeItem = detailSelectedItem;
    if (!activeItem) return;
    addItem({
      menuItemId: activeItem.id,
      snapshot: activeItem,
      ingredientAdjustments: adjustments,
      notes,
      quantity,
      course: resolveCourseForItem(activeItem, categories),
      status: 'draft',
      staffId: currentStaff?.id || '',
      allergyCustomisations,
    });
    setDetailSelectedItem(null);
  };

  const resolveSetMenuItemCourse = (
    courseHint: Course,
    menuItem: MenuItemSnapshot | undefined
  ): Course => {
    // Priority 1: explicit course derived from the set menu course's own name
    if (courseHint !== 'mains') {
      return courseHint;
    }

    // Priority 2: derive from the actual menu item data
    if (menuItem) {
      if (menuItem.isDrink) return 'drinks';

      const catId = menuItem.categoryId;
      if (catId === 'cat_tacos') return 'tacos';
      if (catId === 'cat_starters') return 'starters';
      if (catId === 'cat_desserts') return 'desserts';
      if (catId === 'cat_sides') return 'sides';
      if ([
        'cat_drinks', 'cat_margaritas', 'cat_cocktails', 'cat_mocktails',
        'cat_beers', 'cat_wines', 'cat_spirits', 'cat_soft_drinks',
        'cat_hot_drinks', 'cat_mixers'
      ].includes(catId)) return 'drinks';
      if (catId === 'cat_mains') return 'mains';

      if (menuItem.course) return menuItem.course;
    }

    // Priority 3: fallback
    return courseHint;
  };

  const handleAddSetMenuToOrder = async (menu: SetMenu, covers: number) => {
    for (const course of menu.courses) {
      const courseHint = mapCourseName(course.name);
      for (const item of course.items) {
        const menuItem = menuItems.find(m => m.id === item.recipeId);
        if (!menuItem) continue;
        const resolvedCourse = resolveSetMenuItemCourse(courseHint, menuItem);
        await addItem({
          menuItemId: item.recipeId,
          snapshot: {
            ...menuItem,
            priceGross: 0,
            name: item.recipeName || menuItem.name,
          },
          quantity: covers,
          course: resolvedCourse,
          status: 'draft',
          isSetMenuItem: true,
          setMenuId: menu.id,
          setMenuName: menu.name,
          staffId: currentStaff?.id || '',
        });
      }
    }

    await addItem({
      menuItemId: `set_menu_${menu.id}`,
      snapshot: {
        id: `set_menu_${menu.id}`,
        name: `★ ${menu.name}`,
        priceGross: menu.pricePerHead * covers,
        vatRate: POS_CONFIG.DEFAULT_VAT_RATE,
        station: 'pass',
        categoryId: 'cat_specials',
        isDrink: false,
        locationId: POS_CONFIG.LOCATION_ID,
      },
      quantity: 1,
      course: 'mains',
      status: 'draft',
      isSetMenuCharge: true,
      setMenuId: menu.id,
      setMenuName: menu.name,
      staffId: currentStaff?.id || '',
    });

    setSelectedSetMenu(null);
    setCovers(1);
  };

  const handlePayment = (amount: number, method: PaymentMethod) => {
    processPayment(amount, method);
    if (activeOrder.amountPaid + amount >= activeOrder.totalGross) {
      setTimeout(() => {
        setActiveOrder(null);
        setActiveScreen('floor');
      }, 2000);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden relative">

      {/* ── MODALS ── */}
      {detailSelectedItem && (
        <ItemDetailModal item={detailSelectedItem} onClose={() => setDetailSelectedItem(null)} onConfirm={handleModifierConfirm} />
      )}
      {actionSelectedItem && (
        <ItemActionsModal item={actionSelectedItem} onClose={() => setActionSelectedItem(null)} />
      )}
      {selectedSetMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  ★ {selectedSetMenu.name}
                </h3>
                <p className="text-[10px] text-brand-primary font-bold mt-0.5">
                  £{(selectedSetMenu.pricePerHead / 100).toFixed(2)} per head
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedSetMenu(null);
                  setCovers(1);
                }}
                className="text-text-muted hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Course list — compact read only */}
            <div className="flex flex-col gap-1">
              {selectedSetMenu.courses.map((course, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-brand-primary uppercase tracking-widest">
                    {course.name || 'Course'}
                  </span>
                  {course.items.map(item => (
                    <span key={item.recipeId}
                          className="text-[10px] text-text-secondary font-bold pl-2">
                      · {item.recipeName}
                    </span>
                  ))}
                </div>
              ))}
            </div>

            {/* Covers selector */}
            <div className="flex items-center gap-3 border-t border-white/5 pt-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                Covers:
              </span>
              <button
                onClick={() => setCovers(Math.max(1, covers - 1))}
                className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-black hover:bg-white/20"
              >
                −
              </button>
              <span className="text-xl font-black text-white w-6 text-center">
                {covers}
              </span>
              <button
                onClick={() => setCovers(covers + 1)}
                className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white font-black hover:bg-brand-primary/80"
              >
                +
              </button>
              <span className="ml-auto text-sm font-black text-brand-primary font-mono">
                £{((selectedSetMenu.pricePerHead * covers) / 100).toFixed(2)}
              </span>
            </div>

            {/* Add to order button */}
            <button
              onClick={() => {
                handleAddSetMenuToOrder(selectedSetMenu, covers);
                setSelectedSetMenu(null);
                setCovers(1);
              }}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary/80 text-white font-black uppercase tracking-widest text-sm rounded-xl transition-all active:scale-95"
            >
              Add {covers} cover{covers > 1 ? 's' : ''} — £{((selectedSetMenu.pricePerHead * covers) / 100).toFixed(2)}
            </button>
          </div>
        </div>
      )}
      {showPayment && (
        <PaymentModal order={activeOrder} onClose={() => setShowPayment(false)} onProcess={handlePayment} />
      )}
      {showDiscount && activeOrder && (
        <POSDiscountModal order={activeOrder} onClose={() => setShowDiscount(false)} />
      )}
      {showCancelModal && (
        <CancelSessionModal
          onClose={() => { setShowCancelModal(false); setHasDeclinedAutoCancel(true); }}
          onConfirm={(reason) => { cancelSession(reason); setShowCancelModal(false); }}
        />
      )}
      {showBulkVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-base font-black text-white uppercase tracking-tight">
              Void {selectedUuids.length} Item{selectedUuids.length > 1 ? 's' : ''}
            </h3>

            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {selectedUuids.map(uuid => {
                const item = activeOrder.items.find(i => i.uuid === uuid);
                return item ? (
                  <div key={uuid} className="flex justify-between text-[10px] text-text-secondary py-0.5">
                    <span>{item.quantity}x {item.snapshot?.name}</span>
                    <span className="font-mono">{PricingEngine.formatCurrency(item.totalPrice)}</span>
                  </div>
                ) : null;
              })}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-text-muted">Reason (applies to all)</label>
              <div className="grid grid-cols-2 gap-1.5">
                {['Customer changed mind', 'Wrong item', 'Kitchen error', 'Wastage', 'Comp/Gift', 'Other'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setBulkVoidReason(reason)}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all text-left",
                      bulkVoidReason === reason
                        ? "bg-red-500/20 border-red-500 text-red-400"
                        : "bg-white/5 border-white/5 text-text-secondary"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowBulkVoid(false); setBulkVoidReason(''); }}
                className="flex-1 py-2.5 bg-white/5 rounded-xl text-[10px] font-black text-text-secondary uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                disabled={!bulkVoidReason}
                onClick={async () => {
                  for (const uuid of selectedUuids) {
                    await voidItem(uuid, bulkVoidReason);
                  }
                  setShowBulkVoid(false);
                  setBulkVoidReason('');
                  exitBulkMode();
                }}
                className="flex-1 py-2.5 bg-red-500 disabled:opacity-30 rounded-xl text-[10px] font-black text-white uppercase tracking-widest"
              >
                Void All
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-base font-black text-white uppercase tracking-tight">
              Discount {selectedUuids.length} Item{selectedUuids.length > 1 ? 's' : ''}
            </h3>

            <div className="flex gap-2">
              <button
                onClick={() => setBulkDiscountType('percentage')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                  bulkDiscountType === 'percentage' ? "bg-brand-primary border-brand-primary text-white" : "bg-white/5 border-white/5 text-text-secondary"
                )}
              >
                % Off
              </button>
              <button
                onClick={() => setBulkDiscountType('fixed')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                  bulkDiscountType === 'fixed' ? "bg-brand-primary border-brand-primary text-white" : "bg-white/5 border-white/5 text-text-secondary"
                )}
              >
                £ Off
              </button>
            </div>

            {bulkDiscountType === 'percentage' && (
              <div className="grid grid-cols-4 gap-1.5">
                {[10, 15, 20, 25, 50, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setBulkDiscountValue(pct)}
                    className={cn(
                      "py-2 rounded-lg text-[10px] font-black border transition-all",
                      bulkDiscountValue === pct ? "bg-brand-primary border-brand-primary text-white" : "bg-white/5 border-white/5 text-text-secondary"
                    )}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <span className="text-text-muted font-black text-sm">{bulkDiscountType === 'percentage' ? '%' : '£'}</span>
              <input
                type="number"
                value={bulkDiscountValue || ''}
                onChange={e => setBulkDiscountValue(Number(e.target.value))}
                placeholder="0"
                className="flex-1 bg-transparent text-white font-black text-xl outline-none"
              />
            </div>

            {/* Display-only preview — the actual write lets the store compute this */}
            {bulkDiscountValue > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex justify-between items-center">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total saving</span>
                <span className="font-mono font-black text-emerald-400">
                  -{PricingEngine.formatCurrency(
                    selectedUuids.reduce((total, uuid) => {
                      const item = activeOrder.items.find(i => i.uuid === uuid);
                      if (!item) return total;
                      return total + (
                        bulkDiscountType === 'percentage'
                          ? Math.round(item.totalPrice * bulkDiscountValue / 100)
                          : bulkDiscountValue * 100
                      );
                    }, 0)
                  )}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowBulkDiscount(false); setBulkDiscountValue(0); }}
                className="flex-1 py-2.5 bg-white/5 rounded-xl text-[10px] font-black text-text-secondary uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                disabled={!bulkDiscountValue}
                onClick={async () => {
                  for (const uuid of selectedUuids) {
                    await updateItemInOrder(uuid, {
                      discountType: bulkDiscountType,
                      discountValue: bulkDiscountValue
                    });
                  }
                  setShowBulkDiscount(false);
                  setBulkDiscountValue(0);
                  exitBulkMode();
                }}
                className="flex-1 py-2.5 bg-emerald-500 disabled:opacity-30 rounded-xl text-[10px] font-black text-white uppercase tracking-widest"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <h3 className="text-base font-black text-white uppercase tracking-tight">
              Transfer {selectedUuids.length} Item{selectedUuids.length > 1 ? 's' : ''} to Table
            </h3>

            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {tables
                .filter(t => t.id !== activeTable.id && t.status !== 'available' && t.status !== 'cleaning')
                .map(table => (
                  <button
                    key={table.id}
                    onClick={() => setBulkTransferTable(table.id)}
                    className={cn(
                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all",
                      bulkTransferTable === table.id
                        ? "bg-brand-primary border-brand-primary text-white"
                        : "bg-white/5 border-white/5 text-text-secondary hover:text-white"
                    )}
                  >
                    {table.name}
                  </button>
                ))
              }
            </div>

            {tables.filter(t => t.id !== activeTable.id && t.status !== 'available' && t.status !== 'cleaning').length === 0 && (
              <p className="text-[10px] text-text-muted text-center py-4">No other occupied tables</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowBulkTransfer(false); setBulkTransferTable(''); }}
                className="flex-1 py-2.5 bg-white/5 rounded-xl text-[10px] font-black text-text-secondary uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                disabled={!bulkTransferTable}
                onClick={async () => {
                  for (const uuid of selectedUuids) {
                    await transferItem(uuid, bulkTransferTable);
                  }
                  setShowBulkTransfer(false);
                  setBulkTransferTable('');
                  exitBulkMode();
                }}
                className="flex-1 py-2.5 bg-brand-primary disabled:opacity-30 rounded-xl text-[10px] font-black text-white uppercase tracking-widest"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MENU SECTION ════════════════════════════════════════════════════ */}
      <div className={cn(
        "flex-1 flex flex-col bg-bg-dark border-r border-white/5 transition-all duration-300",
        showOrderMobile ? "hidden lg:flex" : "flex"
      )}>

        {/* Header */}
        <div className="h-16 lg:h-20 bg-bg-card border-b border-white/5 flex items-center px-4 lg:px-6 gap-3 shrink-0">
          <button
            onClick={() => setActiveScreen('floor')}
            className="p-2 text-text-secondary hover:text-white hover:bg-white/5 rounded-xl shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-lg lg:text-xl font-black text-white uppercase tracking-tight shrink-0 hidden lg:block">
            Table {activeTable.name}
          </h2>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-9 text-white text-sm placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile: view order button */}
          <button
            onClick={() => setShowOrderMobile(true)}
            className="lg:hidden shrink-0 flex items-center gap-2 bg-brand-primary px-3 py-2 rounded-xl text-white font-black text-[10px] uppercase tracking-widest"
          >
            <Utensils className="w-4 h-4" />
            ({activeOrder.items.length})
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── LEFT SIDEBAR — top-level only (desktop) ────────────────────── */}
          <div className="hidden lg:flex lg:w-36 xl:w-40 bg-white/[0.02] border-r border-white/[0.06] flex-col overflow-y-auto no-scrollbar shrink-0">
            {topLevelCategories.map(cat => {
              const isActive = selectedTopLevel === cat.id;
              const subs     = getSubfolders(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => handleTopLevelClick(cat.id)}
                  className={cn(
                    "w-full text-left py-4 px-4 transition-all border-b border-white/[0.03] flex flex-col gap-1 border-l-[3px]",
                    isActive
                      ? "bg-brand-primary/15 border-l-brand-primary text-white"
                      : "border-l-transparent text-text-secondary hover:text-white hover:bg-white/[0.03]"
                  )}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest leading-tight block">
                    {cat.name}
                  </span>
                  <span className={cn(
                    "text-[8px] font-bold uppercase tracking-wider",
                    isActive ? "text-brand-primary/80" : "text-text-muted/60"
                  )}>
                    {subs.length > 0 ? `${subs.length} types` : `${getItemCount(cat.id)} items`}
                  </span>
                </button>
              );
            })}
            {activeSetMenus.length > 0 && (
              <button
                onClick={() => {
                  setSelectedTopLevel('set_menus');
                  setSelectedSubfolder(null);
                  setSelectedSetMenu(null);
                  setSearchQuery('');
                }}
                className={cn(
                  "w-full text-left py-4 px-4 transition-all border-b border-white/[0.03] flex flex-col gap-1 border-l-[3px]",
                  selectedTopLevel === 'set_menus'
                    ? "bg-brand-primary/15 border-l-brand-primary text-white"
                    : "border-l-transparent text-text-secondary hover:text-white hover:bg-white/[0.03]"
                )}
              >
                <span className="text-[10px] font-black uppercase tracking-widest leading-tight block">
                  Set Menus & Specials
                </span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted/60">
                  {activeSetMenus.length} active
                </span>
              </button>
            )}
          </div>

          {/* ── MAIN CONTENT AREA ──────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-0">

            {/* Mobile: top-level category bar */}
            <div className="flex lg:hidden flex-col bg-[#161a26]/40 border-b border-white/5 shrink-0">
              <div className="flex p-2 gap-1.5 px-3 items-center overflow-x-auto no-scrollbar border-b border-white/[0.04]">
                <span className="text-[8px] font-black text-brand-primary uppercase tracking-[0.15em] shrink-0 mr-1">SECTION:</span>
                {topLevelCategories.map(cat => {
                  const isActive = selectedTopLevel === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleTopLevelClick(cat.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg flex items-center justify-center transition-all border text-[9px] font-black uppercase tracking-wider shrink-0",
                        isActive
                          ? "bg-brand-primary border-brand-primary text-white"
                          : "bg-white/5 border-white/5 text-text-secondary"
                      )}
                    >
                      {cat.name}
                    </button>
                  );
                })}
                {activeSetMenus.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedTopLevel('set_menus');
                      setSelectedSubfolder(null);
                      setSelectedSetMenu(null);
                      setSearchQuery('');
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg flex items-center justify-center transition-all border text-[9px] font-black uppercase tracking-wider shrink-0",
                      selectedTopLevel === 'set_menus'
                        ? "bg-brand-primary border-brand-primary text-white"
                        : "bg-white/5 border-white/5 text-text-secondary"
                    )}
                  >
                    Set Menus & Specials
                  </button>
                )}
              </div>

              {/* Mobile: subfolder row (shown when top-level has subfolders) */}
              {currentSubs.length > 0 && (
                <div className="flex p-1.5 gap-1 px-3 items-center overflow-x-auto no-scrollbar">
                  <span className="text-[7px] font-black text-text-muted uppercase tracking-[0.15em] shrink-0 mr-1">TYPE:</span>
                  {currentSubs.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => handleSubfolderClick(sub.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg flex items-center justify-center transition-all border text-[8px] font-black uppercase tracking-wider shrink-0",
                        selectedSubfolder === sub.id
                          ? "bg-brand-primary/30 border-brand-primary text-brand-primary"
                          : "bg-white/5 border-white/5 text-text-secondary"
                      )}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Breadcrumb (desktop only) */}
            {!isSearching && (
              <div className="hidden lg:flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.01] shrink-0">
                <button
                  onClick={() => setSelectedSubfolder(null)}
                  className={cn(
                    "text-[9px] font-black uppercase tracking-widest transition-colors",
                    subfolderName
                      ? "text-brand-primary hover:text-white"
                      : "text-white cursor-default pointer-events-none"
                  )}
                >
                  {topLevelName}
                </button>
                {subfolderName && (
                  <>
                    <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white">
                      {subfolderName}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Content: subfolder grid or item grid */}
            <div className="flex-1 overflow-y-auto p-3 lg:p-5">
              {selectedTopLevel === 'set_menus' && !isSearching ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-1.5 md:gap-2">
                  {activeSetMenus.map(menu => (
                    <button
                      key={menu.id}
                      onClick={() => setSelectedSetMenu(menu)}
                      className="group relative aspect-[1.6/1] bg-bg-card border border-white/10 rounded-lg lg:rounded-xl flex flex-col items-start justify-end p-3 lg:p-4 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all active:scale-95 overflow-hidden"
                    >
                      <span className="absolute top-2 left-2 bg-brand-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full leading-none">
                        {menu.courses.flatMap(c => c.items).length} dishes
                      </span>
                      <span className="relative text-sm font-black text-white uppercase tracking-tight leading-tight group-hover:text-brand-primary transition-colors">
                        {menu.name}
                      </span>
                      <span className="relative text-[10px] font-bold text-brand-primary mt-0.5">
                        £{(menu.pricePerHead / 100).toFixed(2)} per head
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
              <>
              {/* Search header */}
              {isSearching && (
                <div className="mb-3 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-brand-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
                    {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
                  </span>
                </div>
              )}
              {filteredItems.length === 0 && isSearching && (
                <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                  <Search className="w-12 h-12 mb-3 opacity-20" />
                  <span className="text-xs font-black uppercase tracking-widest opacity-40">No items found</span>
                </div>
              )}

              {/* ── SUBFOLDER GRID ─────────────────────────────────────── */}
              {showSubfolderGrid && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-1.5 md:gap-2">
                  {currentSubs.map(sub => {
                    const count = getItemCount(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSubfolderClick(sub.id)}
                        className="group relative aspect-[1.6/1] bg-bg-card border border-white/10 rounded-lg lg:rounded-xl flex flex-col items-start justify-end p-3 lg:p-4 hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all active:scale-95 overflow-hidden"
                      >
                        {/* Subtle gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                        {/* Item count badge — number only */}
                        <span className="absolute top-3 left-3 bg-brand-primary text-white text-xs font-black px-2.5 py-1 rounded-full leading-none">
                          {count}
                        </span>

                        {/* Category name */}
                        <span className="relative text-sm font-black text-white uppercase tracking-tight leading-tight group-hover:text-brand-primary transition-colors">
                          {sub.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── ITEM GRID ──────────────────────────────────────────── */}
              {!showSubfolderGrid && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-1.5 md:gap-2">
                  {filteredItems.map(item => {
                    const unavail    = unavailableItems.find(u => u.menuItemId === item.id);
                    const is86d      = unavail?.status === 'Unavailable (86)';
                    const isLowStock = unavail?.status === 'Low Stock';
                    const qtyLeft    = unavail?.quantityRemaining;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "aspect-[1.45/1] border rounded-lg lg:rounded-xl flex flex-col transition-all group overflow-hidden relative",
                          is86d
                            ? "bg-white/[0.02] border-red-900/40 opacity-50 cursor-not-allowed"
                            : isLowStock
                            ? "bg-bg-card border-amber-500/40 hover:bg-bg-accent"
                            : "bg-bg-card border-white/5 hover:bg-bg-accent"
                        )}
                      >
                        <button
                          onClick={() => !is86d && handleItemClick(item)}
                          disabled={is86d}
                          className="flex-1 p-1.5 lg:p-2.5 flex flex-col justify-between text-left w-full h-full disabled:cursor-not-allowed"
                        >
                          <span className={cn(
                            "text-[10px] lg:text-xs font-bold leading-tight uppercase tracking-tight line-clamp-2",
                            is86d ? "text-white/30" : "text-white"
                          )}>
                            {item.name}
                          </span>
                          <span className="text-[8px] lg:text-[10px] font-mono text-brand-primary font-bold">
                            {PricingEngine.formatCurrency(item.priceGross)}
                          </span>
                        </button>

                        {/* 86'd overlay */}
                        {is86d && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-black/60 px-1.5 py-0.5 rounded">
                              86'd
                            </span>
                          </div>
                        )}

                        {/* Low stock badge */}
                        {isLowStock && !is86d && (
                          <div className="absolute top-0.5 right-0.5 pointer-events-none">
                            <span className="text-[7px] font-black uppercase tracking-wide text-amber-400 bg-amber-900/60 px-1 py-0.5 rounded leading-none">
                              {qtyLeft != null ? `${qtyLeft} left` : 'Low'}
                            </span>
                          </div>
                        )}

                        {/* View details button */}
                        {!is86d && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailSelectedItem(item); }}
                            className="absolute bottom-1.5 right-1.5 p-1 bg-white/5 hover:bg-brand-primary hover:text-white rounded text-text-muted transition-all lg:opacity-0 group-hover:opacity-100"
                            title="View Details"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ ORDER PANEL ═════════════════════════════════════════════════════ */}
      <div className={cn(
        "bg-bg-card flex flex-col shrink-0 transition-all duration-300",
        "fixed inset-0 z-40 lg:relative lg:inset-auto lg:w-96 lg:flex",
        showOrderMobile ? "flex" : "hidden"
      )}>
        <div className="h-16 lg:h-20 border-b border-white/5 flex items-center px-4 lg:px-6 shrink-0 justify-between">
          {bulkMode ? (
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">
              {selectedUuids.length} selected
            </span>
          ) : (
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Current Order</h3>
          )}
          <div className="flex items-center gap-2">
            {bulkMode ? (
              <button
                onClick={exitBulkMode}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-text-secondary uppercase tracking-widest"
              >
                Cancel
              </button>
            ) : (
              activeOrder.items.length > 0 && (
                <button
                  onClick={() => setBulkMode(true)}
                  className="px-3 py-1 bg-white/5 hover:bg-brand-primary/20 border border-white/10 hover:border-brand-primary/40 rounded-lg text-[9px] font-black text-text-secondary hover:text-brand-primary uppercase tracking-widest transition-all"
                >
                  Select
                </button>
              )
            )}
            <button
              onClick={() => setShowOrderMobile(false)}
              className="lg:hidden p-2 text-text-secondary hover:text-white"
            >
              <ChevronLeft className="w-6 h-6 rotate-180" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-4 no-scrollbar">
          {activeOrder.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-20">
              <Utensils className="w-16 h-16 mb-4" />
              <span className="text-xs font-black uppercase tracking-widest">Empty Order</span>
            </div>
          ) : (
            <>
            {(['drinks', 'starters', 'tacos', 'mains', 'desserts', 'sides'] as const).map(courseName => {
              const itemsInCourse = activeOrder.items.filter(i =>
                (i.course || 'mains') === courseName && !i.snapshot?.isAddon && !i.isSetMenuCharge
              );
              if (itemsInCourse.length === 0) return null;

              const nonVoidedItemsInCourse = itemsInCourse.filter(i => i.status !== 'voided');
              const allServed = nonVoidedItemsInCourse.length > 0 && nonVoidedItemsInCourse.every(i => i.status === 'served');
              const allHeld   = nonVoidedItemsInCourse.length > 0 && nonVoidedItemsInCourse.every(i => i.status === 'held');
              const hasSent   = nonVoidedItemsInCourse.some(i => i.status !== 'draft');
              const hasUnfired = nonVoidedItemsInCourse.some(i => i.status === 'held');

              const courseStatus: 'served' | 'held' | 'partial' | 'firing' | 'draft' =
                allServed ? 'served' :
                allHeld ? 'held' :
                (hasSent && hasUnfired) ? 'partial' :
                hasSent ? 'firing' :
                'draft';

              return (
                <div key={courseName} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 flex-1">
                      {changingCourseName === courseName ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                          <span className="text-[8px] font-black text-text-muted uppercase tracking-wider">Move items of this course to:</span>
                          {(['drinks', 'starters', 'tacos', 'mains', 'desserts', 'sides'] as const)
                            .filter(c => c !== courseName)
                            .map(targetCourse => (
                              <button
                                key={targetCourse}
                                onClick={async () => {
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
                    {courseStatus === 'served' && (
                      <span className="ml-3 text-[8px] font-black uppercase tracking-widest text-emerald-500">
                        ✓ SERVED
                      </span>
                    )}
                    {courseStatus === 'held' && (
                      <button
                        onClick={() => fireCourse(activeOrder.id, courseName)}
                        className="ml-3 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-brand-primary text-white animate-pulse shadow-lg shadow-brand-primary/20"
                      >
                        Fire {courseName} →
                      </button>
                    )}
                    {courseStatus === 'firing' && (
                      <span className="ml-3 text-[8px] font-black uppercase tracking-widest text-brand-primary">
                        Firing →
                      </span>
                    )}
                    {courseStatus === 'partial' && (
                      <button
                        onClick={() => fireCourse(activeOrder.id, courseName)}
                        className="ml-3 px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      >
                        Fire Remaining →
                      </button>
                    )}
                  </div>

                  {itemsInCourse.map(item => {
                    const bulkExcluded = item.isSetMenuItem || item.isSetMenuCharge || item.status === 'voided';
                    return (
                    <div
                      key={item.uuid}
                      onClick={() => bulkMode && !bulkExcluded && toggleItemSelection(item.uuid)}
                      className={cn(
                        "bg-white/5 rounded-xl p-2.5 flex gap-2 transition-all border",
                        bulkMode && !bulkExcluded && "cursor-pointer",
                        selectedUuids.includes(item.uuid)
                          ? "border-brand-primary bg-brand-primary/10"
                          : "border-transparent hover:border-white/10",
                        item.status === 'voided' && "opacity-40 grayscale",
                        bulkExcluded && bulkMode && "opacity-30 pointer-events-none"
                      )}
                    >
                      {/* Checkbox — bulk mode only, eligible items only */}
                      {bulkMode && !bulkExcluded && (
                        <div className={cn(
                          "w-4 h-4 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all",
                          selectedUuids.includes(item.uuid)
                            ? "bg-brand-primary border-brand-primary"
                            : "border-white/30"
                        )}>
                          {selectedUuids.includes(item.uuid) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      {/* Name & price */}
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={cn("text-sm font-black text-white uppercase tracking-tight leading-tight flex-1 break-words", (item.status === 'voided' || item.status === 'served') && "line-through")}>
                          <span className="text-brand-primary mr-1.5 font-black">{item.quantity}X</span>
                          {item.snapshot?.name || 'Unknown Item'}
                          {item.isSetMenuItem && (
                            <span className="ml-2 text-[7px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-black uppercase tracking-widest align-middle">
                              [SET MENU]
                            </span>
                          )}
                        </h4>
                        <span className="text-sm font-mono font-black text-white shrink-0">
                          {PricingEngine.formatCurrency(item.totalPrice)}
                        </span>
                      </div>

                      {/* Add-ons / ingredient adjustments */}
                      {((item.addons && item.addons.length > 0) || (item.ingredientAdjustments && Object.entries(item.ingredientAdjustments).some(([_, action]) => action !== 'standard'))) && (
                        <div className="flex flex-wrap gap-1">
                          {item.addons?.map(a => (
                            <span key={a.menuItemId} className="text-[7px] bg-brand-primary/10 text-brand-primary px-1 py-0.5 rounded font-black uppercase tracking-tighter">
                              {a.name}
                            </span>
                          ))}
                          {item.ingredientAdjustments && Object.entries(item.ingredientAdjustments)
                            .filter(([_, action]) => action !== 'standard')
                            .map(([name, action]) => (
                              <span key={name} className={cn(
                                "text-[7px] px-1 py-0.5 rounded font-black uppercase tracking-tighter",
                                action === 'no'    && "bg-status-pending/10 text-status-pending",
                                action === 'extra' && "bg-brand-primary/10 text-brand-primary",
                                action === 'side'  && "bg-amber-500/10 text-amber-500"
                              )}>
                                {action === 'no' ? 'NO ' : action === 'extra' ? 'EXTRA ' : action === 'side' ? 'SIDE ' : ''}{name}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Notes */}
                      {item.notes && (
                        <p className="text-xs text-status-pending font-bold leading-normal break-words whitespace-normal border-l-2 border-status-pending/40 pl-1.5 mt-0.5">
                          "{item.notes}"
                        </p>
                      )}

                      {/* Addons */}
                      {activeOrder.items
                        .filter(a => a.parentOrderItemUuid === item.uuid)
                        .map(addon => (
                          <div key={addon.uuid}
                               className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-white/5">
                            <span className="text-[9px] font-black text-brand-primary uppercase tracking-wider">
                              {addon.snapshot.name.replace(/\s*batch\s*/gi, '').trim()}
                            </span>
                            <span className="text-[9px] font-mono text-brand-primary font-bold">
                              {PricingEngine.formatCurrency(addon.totalPrice)}
                            </span>
                          </div>
                        ))
                      }

                      {/* Footer: status / discount + edit */}
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
                        <div className="flex-1 min-w-0">
                          {item.discountAmount && item.discountAmount > 0 ? (
                            <div className="flex items-center gap-1 text-emerald-400">
                              <Gift className="w-2.5 h-2.5 shrink-0" />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                -{PricingEngine.formatCurrency(item.discountAmount)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        {!item.isSetMenuItem && !bulkMode && (
                          <button
                            onClick={() => setActionSelectedItem(item)}
                            className="px-2 py-0.5 bg-brand-primary/15 hover:bg-brand-primary hover:text-white text-[9px] font-black text-brand-primary uppercase tracking-wider rounded transition-all active:scale-95"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              );
            })}
            {activeOrder.items.filter(i => i.isSetMenuCharge).map(item => (
              <div key={item.uuid} className={cn("flex flex-col gap-1 mt-2 pt-2 border-t border-brand-primary/20", item.status === 'voided' && "opacity-40 grayscale", bulkMode && "opacity-30")}>
                <div className="flex items-center gap-2 px-1 mb-1">
                  <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">
                    {item.setMenuName || 'Set Menu'}
                  </span>
                  <div className="flex-1 h-px bg-brand-primary/20" />
                </div>
                <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-2.5">
                  <div className="flex justify-between items-center">
                    <span className={cn("text-sm font-black text-brand-primary uppercase tracking-tight", item.status === 'voided' && "line-through")}>
                      {item.snapshot.name}
                    </span>
                    <span className="text-sm font-mono font-black text-brand-primary">
                      {PricingEngine.formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-status-pending font-bold leading-normal break-words whitespace-normal border-l-2 border-status-pending/40 pl-1.5 mt-1.5">
                      "{item.notes}"
                    </p>
                  )}
                  {!bulkMode && (
                    <div className="flex items-center justify-end mt-1.5 pt-1.5 border-t border-brand-primary/10">
                      <button
                        onClick={() => setActionSelectedItem(item)}
                        className="px-2 py-0.5 bg-brand-primary/15 hover:bg-brand-primary hover:text-white text-[9px] font-black text-brand-primary uppercase tracking-wider rounded transition-all active:scale-95"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            </>
          )}
        </div>

        {/* Bulk Action Bar */}
        {bulkMode && selectedUuids.length > 0 && (
          <div className="border-t border-white/10 bg-bg-accent p-3 flex flex-col gap-2 shrink-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-brand-primary text-center">
              {selectedUuids.length} item{selectedUuids.length > 1 ? 's' : ''} selected
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(currentStaff?.permissions?.canVoidItem ?? currentStaff?.permissions?.canVoid ?? false) && (
                <button
                  onClick={() => setShowBulkVoid(true)}
                  className="py-2.5 bg-red-500/10 hover:bg-red-500 border border-red-500/30 hover:border-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-all"
                >
                  Void All
                </button>
              )}
              {(currentStaff?.permissions?.canApplyDiscount ?? currentStaff?.permissions?.canDiscount ?? false) && (
                <button
                  onClick={() => setShowBulkDiscount(true)}
                  className="py-2.5 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/30 hover:border-emerald-500 rounded-xl text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-white transition-all"
                >
                  Discount
                </button>
              )}
              <button
                onClick={() => setShowBulkTransfer(true)}
                className="py-2.5 bg-white/5 hover:bg-brand-primary border border-white/10 hover:border-brand-primary rounded-xl text-[9px] font-black uppercase tracking-widest text-text-secondary hover:text-white transition-all"
              >
                Transfer
              </button>
            </div>
          </div>
        )}

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
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={async () => { await sendOrder(); setActiveScreen('floor'); }}
                  disabled={activeOrder.items.length === 0}
                  className="h-10 bg-white/5 rounded-lg flex items-center justify-center gap-1.5 text-white font-black uppercase tracking-tight active:scale-95 transition-all border border-white/10 text-xs px-1"
                >
                  <Send className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  Send
                </button>
                <button
                  onClick={async () => { await sendOrder(); }}
                  disabled={activeOrder.items.length === 0}
                  className="h-10 bg-white/5 rounded-lg flex items-center justify-center gap-1 text-white font-black uppercase tracking-tight active:scale-95 transition-all border border-white/10 text-[10px] px-1"
                  title="Send this course and keep adding to the order"
                >
                  <SendHorizonal className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                  <span>Send &amp; Stay</span>
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
