import React, { useState } from 'react';
import { POSOrderItem, Table, ModifierSelection, Modifier, ModifierGroup, IngredientAction, AllergyCustomisation } from '../../types/pos';
import { usePOSStore } from '../../app/store';
import { PricingEngine } from '../../domain/PricingEngine';
import { X, MessageSquare, Plus, Minus, Hash, Percent, Trash2, Move, Check, ArrowRight, Gift, Wind, Info, ShieldAlert, Utensils, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UK_ALLERGENS } from '../../features/menu/MenuManagementScreen';

interface ItemActionsModalProps {
  item: POSOrderItem;
  onClose: () => void;
}

export const ItemActionsModal: React.FC<ItemActionsModalProps> = ({ item, onClose }) => {
  const { updateItemInOrder, voidItem, transferItem, tables, currentStaff, activeTable } = usePOSStore();
  
  const hasIngredients = item.snapshot?.ingredients && item.snapshot.ingredients.length > 0;
  const hasModifiers = item.snapshot?.modifierGroups && item.snapshot.modifierGroups.length > 0;

  const [activeTab, setActiveTab] = useState<'details' | 'modifiers' | 'ingredients' | 'discount' | 'transfer' | 'void' | 'course' | 'allergies'>(
    hasModifiers ? 'modifiers' : (hasIngredients ? 'ingredients' : 'details')
  );
  
  // State for actions
  const [notes, setNotes] = useState(item.notes || '');
  const [quantity, setQuantity] = useState(item.quantity);
  const [selections, setSelections] = useState<ModifierSelection[]>(item.modifiers || []);
  const [adjustments, setAdjustments] = useState<Record<string, IngredientAction>>(item.ingredientAdjustments || {});
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(item.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(item.discountValue || 0);
  const [voidReason, setVoidReason] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(item.course || 'mains');

  // Allergy States
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(
    item.allergyCustomisations?.map(c => c.allergen) || []
  );
  const [allergySeverity, setAllergySeverity] = useState<'Allergic' | 'Intolerant'>(
    item.allergyCustomisations?.[0]?.type || 'Allergic'
  );
  const [crossContamOk, setCrossContamOk] = useState<boolean>(
    item.allergyCustomisations?.[0]?.crossContaminationOk ?? false
  );

  const handleUpdateItem = () => {
    let baseNotes = notes.trim();
    // Strip previous alert prefix from baseNotes if present
    baseNotes = baseNotes.replace(/🚨 \[.*?\] 🚨\n?/g, '').trim();

    const customisations: AllergyCustomisation[] = selectedAllergies.map(a => ({
      allergen: a,
      type: allergySeverity,
      crossContaminationOk: crossContamOk
    }));

    if (customisations.length > 0) {
      const severityStr = allergySeverity.toUpperCase();
      const contamStr = crossContamOk ? 'Contamination OK' : 'STRICT NO CROSS-CONTAM';
      const allergyPref = `🚨 [${severityStr}: ${selectedAllergies.join(', ').toUpperCase()} - ${contamStr}] 🚨`;
      baseNotes = baseNotes ? `${allergyPref}\n${baseNotes}` : allergyPref;
    }

    updateItemInOrder(item.uuid, { 
      notes: baseNotes, 
      quantity, 
      modifiers: selections,
      ingredientAdjustments: adjustments,
      discountType,
      discountValue,
      course: selectedCourse,
      allergyCustomisations: customisations
    });
    onClose();
  };

  const cycleIngredient = (ingredient: string) => {
    const current = adjustments[ingredient] || 'standard';
    const cycle: IngredientAction[] = ['standard', 'no', 'extra', 'side'];
    const nextIndex = (cycle.indexOf(current) + 1) % cycle.length;
    setAdjustments({
      ...adjustments,
      [ingredient]: cycle[nextIndex]
    });
  };

  const handleVoid = (reason: string) => {
    voidItem(item.uuid, reason);
    onClose();
  };

  const handleTransfer = () => {
    if (!targetTable) return;
    transferItem(item.uuid, targetTable);
    onClose();
  };

  const toggleModifier = (group: ModifierGroup, modifier: Modifier) => {
    const isSelected = selections.some(s => s.id === modifier.id);
    
    if (isSelected) {
      setSelections(selections.filter(s => s.id !== modifier.id));
    } else {
      const groupSelections = selections.filter(s => 
        group.modifiers.some(m => m.id === s.id)
      );
      
      if (groupSelections.length < group.maxSelection) {
        setSelections([...selections, { id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta }]);
      } else if (group.maxSelection === 1) {
        const otherSelections = selections.filter(s => 
          !group.modifiers.some(m => m.id === s.id)
        );
        setSelections([...otherSelections, { id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta }]);
      }
    }
  };

  const isGroupValid = (group: ModifierGroup) => {
    const groupSelections = selections.filter(s => 
      group.modifiers.some(m => m.id === s.id)
    );
    return groupSelections.length >= group.minSelection && groupSelections.length <= group.maxSelection;
  };

  const allGroupsValid = item.snapshot?.modifierGroups?.every(isGroupValid) ?? true;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-bg-dark/95 backdrop-blur-md">
      <div className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[88vh] md:h-[620px]">
        
        {/* Left Sidebar - Tabs */}
        <div className="w-full md:w-48 bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/5 p-2 md:p-3 flex md:flex-col gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <div className="hidden md:block mb-2 px-3">
            <h4 className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">Menu Actions</h4>
            <div className="h-0.5 w-6 bg-brand-primary" />
          </div>
          
          {item.snapshot.modifierGroups && item.snapshot.modifierGroups.length > 0 && (
            <TabButton active={activeTab === 'modifiers'} onClick={() => setActiveTab('modifiers')} icon={Hash} label="Modifiers" />
          )}
          {hasIngredients && (
            <TabButton active={activeTab === 'ingredients'} onClick={() => setActiveTab('ingredients')} icon={Info} label="Ingredients" />
          )}
          <TabButton active={activeTab === 'course'} onClick={() => setActiveTab('course')} icon={Wind} label="Change Course" />
          <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')} icon={MessageSquare} label="Notes & Qty" />
          <TabButton active={activeTab === 'allergies'} onClick={() => setActiveTab('allergies')} icon={ShieldAlert} label="Allergy Safety" color={selectedAllergies.length > 0 ? "text-status-pending font-black animate-pulse" : "text-text-muted"} />
          <TabButton active={activeTab === 'discount'} onClick={() => setActiveTab('discount')} icon={Percent} label="Discounts" />
          <TabButton active={activeTab === 'transfer'} onClick={() => setActiveTab('transfer')} icon={Move} label="Transfer" />
          <TabButton active={activeTab === 'void'} onClick={() => setActiveTab('void')} icon={Trash2} label="Void / Waste" color="text-status-pending" />
          
          <div className="mt-auto hidden md:flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-text-muted">
              <span>Unit Price</span>
              <span className="text-white">{PricingEngine.formatCurrency(item.snapshot?.priceGross || 0)}</span>
            </div>
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-text-muted">
              <span>Quantity</span>
              <span className="text-white">x{quantity}</span>
            </div>
            <div className="pt-1.5 border-t border-white/10 flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-primary">Total</span>
              <span className="text-xs font-black text-white">
                {PricingEngine.formatCurrency(((item.snapshot?.priceGross || 0) + selections.reduce((a, b) => a + b.priceDelta, 0)) * quantity)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-bg-card">
          <div className="p-4 md:p-5 border-b border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                <Hash className="w-5 h-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">{item.snapshot?.name || 'Unknown Item'}</h3>
                <p className="text-[9px] font-black text-text-muted uppercase tracking-wider mt-1.5">
                  Station: <span className="text-brand-primary">{item.snapshot?.station || 'KITCHEN'}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-all border border-white/5">
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
            {activeTab === 'modifiers' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-350">
                {item.snapshot?.modifierGroups?.map(group => (
                  <div key={group.id} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                        {group.name}
                        {group.minSelection > 0 && <span className="text-[8px] text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">Required</span>}
                      </h4>
                      <span className="text-[8px] text-text-muted font-bold uppercase tracking-tighter">
                        Min: {group.minSelection} / Max: {group.maxSelection}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.modifiers.map(mod => {
                        const isSelected = selections.some(s => s.id === mod.id);
                        return (
                          <button
                            key={mod.id}
                            onClick={() => toggleModifier(group, mod)}
                            className={cn(
                              "p-3 rounded-xl border transition-all text-left flex items-center justify-between",
                              isSelected 
                                ? "bg-brand-primary/20 border-brand-primary text-white" 
                                : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10"
                            )}
                          >
                            <div>
                              <span className="text-xs font-bold uppercase tracking-tight">{mod.name}</span>
                              {mod.priceDelta !== 0 && (
                                <span className="text-[9px] font-mono font-bold text-brand-primary block mt-0.5">
                                  {mod.priceDelta > 0 ? `+£${PricingEngine.formatCurrency(mod.priceDelta)}` : `-£${PricingEngine.formatCurrency(Math.abs(mod.priceDelta))}`}
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'ingredients' && hasIngredients && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-brand-primary/5 border border-brand-primary/10 p-3 rounded-xl flex gap-3">
                  <Info className="w-5 h-5 text-brand-primary shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-xs">Ingredient Customization</h4>
                    <p className="text-[9px] text-text-secondary font-black uppercase tracking-wider mt-0.5">Cycle through options: Standard, No Ingredient, Extra Ingredient, or On the Side.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {item.snapshot?.ingredients?.map(ing => {
                    const state = adjustments[ing] || 'standard';
                    return (
                      <button 
                        key={ing}
                        onClick={() => cycleIngredient(ing)}
                        className={cn(
                          "p-3 rounded-xl border transition-all flex flex-col gap-1 relative overflow-hidden group",
                          state === 'no' && "bg-status-pending/5 border-status-pending text-status-pending",
                          state === 'extra' && "bg-brand-primary/10 border-brand-primary text-white",
                          state === 'side' && "bg-amber-500/10 border-amber-500 text-amber-500",
                          state === 'standard' && "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                        )}
                      >
                        <div className="flex justify-between items-start relative z-10 w-full">
                          <span className="text-xs font-bold uppercase tracking-tight truncate">{ing}</span>
                          <div className="shrink-0 text-current">
                            {state === 'no' && <X className="w-3.5 h-3.5" />}
                            {state === 'extra' && <Plus className="w-3.5 h-3.5" />}
                            {state === 'side' && <div className="w-3.5 h-3.5 rounded-full border-2 border-current" />}
                          </div>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-tight opacity-65 relative z-10">
                          {state === 'standard' ? 'Standard' : state.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'course' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-brand-primary/5 border border-brand-primary/10 p-3 rounded-xl flex gap-3">
                  <Wind className="w-5 h-5 text-brand-primary shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-xs">Assign to Course</h4>
                    <p className="text-[9px] text-text-secondary font-black uppercase tracking-wider mt-0.5">Select which course this item should be served in.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['drinks', 'starters', 'tacos', 'mains', 'desserts', 'sides', 'extras'] as const).map(course => (
                    <button 
                      key={course}
                      onClick={() => setSelectedCourse(course)}
                      className={cn(
                        "p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5",
                        selectedCourse === course ? "bg-brand-primary text-white border-brand-primary shadow-sm" : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                      )}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">{course}</span>
                      {selectedCourse === course && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Quantity Controls */}
                <div className="space-y-2.5">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-wider">Adjust Quantity</label>
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 max-w-sm mx-auto">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-all active:scale-95"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-3xl font-black text-white">{quantity}</span>
                      <p className="text-[8px] font-black text-text-muted uppercase tracking-wider mt-0.5">Item Count</p>
                    </div>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 bg-brand-primary rounded-lg flex items-center justify-center text-white shadow hover:scale-105 active:scale-95 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-wider">Kitchen & Bar Instructions</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g. No allergies, extra crispy, birthday guest..."
                    className="w-full h-28 bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold text-xs outline-none focus:border-brand-primary transition-all resize-none shadow-inner"
                  />
                </div>
              </div>
            )}

            {activeTab === 'allergies' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-status-pending/5 border border-status-pending/10 p-3 rounded-xl flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-status-pending shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-xs">Allergy & Dietary Guard</h4>
                    <p className="text-[9px] text-text-secondary font-black uppercase tracking-wider mt-0.5">Specify guest allergies and reaction severity securely.</p>
                  </div>
                </div>

                {/* If item has preset recipe allergies, display them */}
                {item.snapshot?.allergies && item.snapshot.allergies.length > 0 && (
                  <div className="p-3 bg-status-pending/20 border border-status-pending/30 rounded-xl space-y-1.5 animate-in fade-in duration-300">
                    <p className="text-[9px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-status-pending" />
                      Recipe Base Contains:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.snapshot.allergies.map(allg => (
                        <span key={allg} className="px-2 py-1 bg-status-pending/30 border border-status-pending/40 rounded-lg text-[9px] font-black text-white uppercase select-none">
                          {allg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Toggle individual guest allergens */}
                <div className="space-y-3">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-xl space-y-2">
                    <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Select Guest Allergies</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                      {UK_ALLERGENS.map(allg => {
                        const isSelected = selectedAllergies.includes(allg);
                        return (
                          <button
                            type="button"
                            key={allg}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAllergies(selectedAllergies.filter(a => a !== allg));
                              } else {
                                setSelectedAllergies([...selectedAllergies, allg]);
                              }
                            }}
                            className={cn(
                              "p-2 rounded-lg border text-[9px] uppercase font-bold transition-all text-left truncate flex items-center justify-between",
                              isSelected 
                                ? "bg-status-pending border-status-pending text-white shadow" 
                                : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10"
                            )}
                          >
                            <span>{allg}</span>
                            {isSelected && <Check className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedAllergies.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-xl border border-white/10 animate-in fade-in duration-300">
                      {/* Reaction Type */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Reaction Severity</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['Allergic', 'Intolerant'] as const).map(sev => (
                            <button
                              type="button"
                              key={sev}
                              onClick={() => setAllergySeverity(sev)}
                              className={cn(
                                "py-2 rounded-lg border text-[9px] uppercase tracking-wider font-bold transition-all",
                                allergySeverity === sev 
                                  ? "bg-status-pending text-white border-status-pending shadow-sm" 
                                  : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10"
                              )}
                            >
                              {sev}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Cross Contamination */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Cross Contamination</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { label: 'Strict NO', val: false, color: 'bg-red-600 text-white border-red-500 shadow-sm' },
                            { label: 'Contam OK', val: true, color: 'bg-amber-600 text-white border-amber-500 shadow-sm' }
                          ].map(cont => (
                            <button
                              type="button"
                              key={cont.label}
                              onClick={() => setCrossContamOk(cont.val)}
                              className={cn(
                                "py-2 rounded-lg border text-[9px] uppercase tracking-wider font-bold transition-all",
                                crossContamOk === cont.val 
                                  ? cont.color 
                                  : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10"
                              )}
                            >
                              {cont.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'discount' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setDiscountType('percentage')}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex flex-col items-center gap-1.5 group",
                      discountType === 'percentage' ? "bg-brand-primary/20 border-brand-primary text-white" : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                    )}
                  >
                    <Percent className={cn("w-5 h-5", discountType === 'percentage' ? "text-brand-primary" : "group-hover:text-white")} />
                    <span className="font-black uppercase text-[9px] tracking-wider">Percentage (%)</span>
                  </button>
                  <button 
                    onClick={() => setDiscountType('fixed')}
                    className={cn(
                      "p-3.5 rounded-xl border transition-all flex flex-col items-center gap-1.5 group",
                      discountType === 'fixed' ? "bg-brand-primary/20 border-brand-primary text-white" : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                    )}
                  >
                    <Hash className={cn("w-5 h-5", discountType === 'fixed' ? "text-brand-primary" : "group-hover:text-white")} />
                    <span className="font-black uppercase text-[9px] tracking-wider">Fixed Amount (GBP)</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <label className="text-[9px] font-black text-text-muted uppercase tracking-wider">Discount Value</label>
                    <span className="text-xl font-mono font-black text-white">
                      {discountType === 'percentage' ? `${discountValue}%` : `£${PricingEngine.formatCurrency(discountValue)}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 20, 25, 50, 100].map(v => (
                      <button 
                        key={v}
                        onClick={() => setDiscountValue(discountType === 'fixed' ? v * 100 : v)}
                        className="py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-white border border-white/10 transition-all"
                      >
                        {discountType === 'fixed' ? `£${v}` : `${v}%`}
                      </button>
                    ))}
                    <button 
                      onClick={() => { setDiscountType('percentage'); setDiscountValue(100); }}
                      className="col-span-2 py-2.5 bg-brand-primary/10 hover:bg-brand-primary/20 rounded-xl text-[9px] font-black text-brand-primary border border-brand-primary/20 uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <Gift className="w-3.5 h-3.5" /> Guest Comp / Gift
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transfer' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-brand-primary/5 border border-brand-primary/10 p-3.5 rounded-xl flex gap-3">
                  <Move className="w-5 h-5 text-brand-primary shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-xs">Transfer to Another Table</h4>
                    <p className="text-[9px] text-text-secondary font-black uppercase tracking-wider mt-0.5">Move this item to any other active table instantly.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[180px] overflow-y-auto no-scrollbar pr-2">
                  {tables.filter(t => t.id !== activeTable?.id).map(t => (
                    <button 
                      key={t.id}
                      onClick={() => setTargetTable(t.id)}
                      className={cn(
                        "aspect-square rounded-xl border transition-all flex flex-col items-center justify-center p-2 gap-0.5",
                        targetTable === t.id ? "bg-brand-primary text-white border-brand-primary" : "bg-white/5 border-white/10 text-text-secondary hover:border-white/30"
                      )}
                    >
                      <span className="text-base font-black">{t.name}</span>
                      <span className={cn(
                        "text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full",
                        t.status === 'available' ? "bg-white/10" : "bg-brand-primary/20 text-brand-primary"
                      )}>{t.status}</span>
                    </button>
                  ))}
                </div>
                {targetTable && (
                  <button 
                    onClick={handleTransfer}
                    className="w-full py-3 bg-brand-primary text-white font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    Complete Transfer <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {activeTab === 'void' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-status-pending/5 border border-status-pending/10 p-3 rounded-xl flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-status-pending shrink-0" />
                  <div>
                    <h4 className="text-white font-bold text-xs">Void Reason Required</h4>
                    <p className="text-[9px] text-text-secondary font-black uppercase tracking-wider mt-0.5">Please specify a valid reason for registering table wastage.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'Wastage', icon: Wind, color: 'text-status-pending' },
                    { label: 'Mistake', icon: Trash2, color: 'text-text-muted' },
                    { label: 'Guest Rejected', icon: X, color: 'text-amber-500' },
                    { label: 'Out of Stock', icon: Info, color: 'text-brand-primary' },
                    { label: 'Bad Prep', icon: Utensils, color: 'text-red-500' },
                    { label: 'Test Order', icon: MessageSquare, color: 'text-text-secondary' }
                  ].map(reason => (
                    <button 
                      key={reason.label}
                      onClick={() => handleVoid(reason.label)}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center gap-2 hover:bg-white/10 hover:border-white/20 transition-all group"
                    >
                      <reason.icon className={cn("w-5 h-5 transition-transform group-hover:scale-105", reason.color)} />
                      <span className="text-[9px] font-black uppercase tracking-wider text-text-secondary group-hover:text-white">{reason.label}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-white/5">
                  <label className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-2 block">Other / Detailed Reason</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Type custom reason here..."
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold text-xs outline-none focus:border-status-pending transition-all h-12"
                    />
                    <button 
                      onClick={() => handleVoid(voidReason)}
                      disabled={!voidReason.trim()}
                      className="px-5 bg-status-pending disabled:opacity-20 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-95 shadow-md shadow-status-pending/20"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 md:p-5 border-t border-white/5 bg-white/[0.01] shrink-0">
            <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 py-3.5 bg-white/5 text-white font-black uppercase tracking-widest rounded-xl border border-white/10 hover:bg-white/10 transition-all active:scale-95 text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateItem}
                disabled={!allGroupsValid}
                className="flex-[2] py-3.5 bg-brand-primary disabled:opacity-20 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.01] active:scale-95 transition-all text-xs"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, label, color = "text-text-secondary" }: { active: boolean; onClick: () => void; icon: any; label: string; color?: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-row items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-2.5 rounded-lg md:rounded-xl transition-all shrink-0 uppercase md:w-full text-left",
      active ? "bg-brand-primary/10 text-white shadow-lg" : "hover:bg-white/5 text-text-muted"
    )}
  >
    <Icon className={cn("w-4 h-4", active ? "text-brand-primary" : color)} />
    <span className={cn("text-[8px] md:text-[9px] font-black uppercase tracking-wider md:tracking-widest", active ? "text-white" : "group-hover:text-white")}>{label}</span>
    {active && <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-brand-primary ml-auto" />}
  </button>
);
