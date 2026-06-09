import React, { useState } from 'react';
import { MenuItemSnapshot, ModifierSelection, IngredientAction, AllergyCustomisation } from '../../types/pos';
import { X, Check, Plus, Minus, Info, AlertCircle, ShoppingCart, ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PricingEngine } from '../../domain/PricingEngine';
import { usePOSStore } from '../../app/store';
import { UK_ALLERGENS } from '../../features/menu/MenuManagementScreen';

interface ItemDetailModalProps {
  item: MenuItemSnapshot;
  onClose: () => void;
  onConfirm: (
    modifiers: ModifierSelection[], 
    notes: string, 
    quantity: number, 
    adjustments?: Record<string, IngredientAction>,
    allergyCustomisations?: AllergyCustomisation[]
  ) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose, onConfirm }) => {
  const { modifierGroups } = usePOSStore();
  const [selections, setSelections] = useState<ModifierSelection[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, IngredientAction>>({});
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'customize'>('details');
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [allergySeverity, setAllergySeverity] = useState<'Allergic' | 'Intolerant'>('Allergic');
  const [crossContamOk, setCrossContamOk] = useState<boolean>(false);

  // Find "Common Extras" or "Global Extras" group
  const commonExtrasGroup = modifierGroups.find(g => 
    g.name.toLowerCase().includes('extra') || 
    g.name.toLowerCase().includes('common')
  );

  const toggleExtra = (extra: { id: string, name: string, priceDelta: number }) => {
    const isSelected = selections.some(s => s.id === extra.id);
    if (isSelected) {
      setSelections(selections.filter(s => s.id !== extra.id));
    } else {
      setSelections([...selections, { id: extra.id, name: extra.name, priceDelta: extra.priceDelta }]);
    }
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

  const totalPrice = ((item.priceGross || 0) + selections.reduce((acc, m) => acc + m.priceDelta, 0)) * quantity;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-bg-card w-full max-w-3xl rounded-2xl md:rounded-3xl border border-white/10 flex flex-col md:flex-row max-h-[88vh] md:h-[580px] overflow-hidden shadow-2xl">
        
        {/* Left Side: Image & Basic Info */}
        <div className="w-full md:w-1/2 bg-black/20 flex flex-row md:flex-col relative shrink-0">
          <div className="h-28 w-28 md:w-full md:h-auto md:flex-1 relative overflow-hidden bg-bg-accent shrink-0">
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-text-muted opacity-20 p-4 md:p-8 text-center">
                <AlertCircle className="w-8 h-8 md:w-12 md:h-12 mb-2" />
                <span className="text-[8px] font-black uppercase tracking-wider">No High-Res Image Available</span>
              </div>
            )}
            
            {/* Price Overlay */}
            <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 bg-brand-primary px-2 py-1.5 rounded-lg shadow-md">
              <span className="text-white font-mono font-black text-xs md:text-sm">
                {PricingEngine.formatCurrency(item.priceGross)}
              </span>
            </div>
            
            {/* Allergies Overlay */}
            {item.allergies && item.allergies.length > 0 && (
              <div className="absolute top-2 left-2 md:top-3 md:left-3 flex flex-wrap gap-1">
                {item.allergies.slice(0, 3).map(allergy => (
                  <div key={allergy} className="bg-status-pending px-2 py-0.5 rounded flex items-center gap-1 shadow">
                    <AlertCircle className="w-2.5 h-2.5 text-white" />
                    <span className="text-[7px] font-black text-white uppercase tracking-wider">{allergy}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 md:p-4 flex-1 flex flex-col justify-center space-y-2 md:space-y-3">
            <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-tight leading-tight">{item.name}</h2>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <h4 className="text-[8px] md:text-[9px] font-black text-text-muted uppercase tracking-wider mb-1">Station</h4>
                <span className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[9px] font-bold text-white uppercase tracking-wider inline-block">{item.station}</span>
              </div>
              <div className="flex-1">
                <h4 className="text-[8px] md:text-[9px] font-black text-text-muted uppercase tracking-wider mb-1">Course</h4>
                <span className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[9px] font-bold text-white uppercase tracking-wider inline-block">{item.isDrink ? 'Drink' : 'Food'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Details & Tabs */}
        <div className="flex-1 flex flex-col bg-bg-card border-t md:border-t-0 md:border-l border-white/5 min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-white/5 shrink-0">
            <button 
              onClick={() => setActiveTab('details')}
              className={cn(
                "flex-1 py-3 text-[9px] font-black uppercase tracking-wider md:tracking-widest transition-all border-b-2",
                activeTab === 'details' ? "text-brand-primary border-brand-primary" : "text-text-muted hover:text-white border-transparent"
              )}
            >
              Info & Ingredients
            </button>
            <button 
              onClick={() => setActiveTab('customize')}
              className={cn(
                "flex-1 py-3 text-[9px] font-black uppercase tracking-wider md:tracking-widest transition-all relative overflow-hidden border-b-2",
                activeTab === 'customize' ? "text-brand-primary border-brand-primary" : "text-text-muted hover:text-white border-transparent"
              )}
            >
              Customise & Extras
              {selections.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping" />
              )}
            </button>
            <button 
              onClick={onClose}
              className="p-3 text-text-muted hover:text-white border-l border-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-5 no-scrollbar">
            {activeTab === 'details' ? (
              <div className="space-y-4">
                {/* Ingredients Section */}
                <section>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-brand-primary" />
                    Ingredients List
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.ingredients && item.ingredients.length > 0 ? (
                      item.ingredients.map(ing => (
                        <span key={ing} className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-text-secondary uppercase">
                          {ing}
                        </span>
                      ))
                    ) : (
                      <p className="text-[10px] text-text-muted italic">No specific ingredients listed.</p>
                    )}
                  </div>
                </section>

                {/* Details Section */}
                <section className="bg-white/5 rounded-xl p-3.5 border border-white/5">
                  <h4 className="text-[9px] font-black text-brand-primary uppercase tracking-wider mb-1.5">Kitchen Notes</h4>
                  <p className="text-[10px] text-text-secondary leading-relaxed font-medium">
                    Standard recipe prepared fresh at the {item.station} station. All items can be modified for dietary requirements in the customization tab.
                  </p>
                </section>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recipe Adjustments */}
                {item.ingredients && item.ingredients.length > 0 && (
                  <section>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Recipe Adjustments</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {item.ingredients.map(ing => {
                        const state = adjustments[ing] || 'standard';
                        return (
                          <button
                            key={ing}
                            onClick={() => cycleIngredient(ing)}
                            className={cn(
                              "p-2.5 rounded-lg border transition-all text-left flex items-center justify-between",
                              state === 'no' && "bg-status-pending/10 border-status-pending text-status-pending",
                              state === 'extra' && "bg-brand-primary/10 border-brand-primary text-brand-primary",
                              state === 'side' && "bg-amber-500/10 border-amber-500 text-amber-500",
                              state === 'standard' && "bg-white/5 border-white/5 text-text-secondary hover:border-white/20"
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase truncate mr-1.5">{ing}</span>
                            <div className="shrink-0 text-current">
                              {state === 'no' && <X className="w-3 h-3" />}
                              {state === 'extra' && <Plus className="w-3 h-3" />}
                              {state === 'side' && <div className="w-2.5 h-2.5 rounded-full border-2 border-current" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Universal Extras */}
                <section>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Add Extras</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {commonExtrasGroup ? (
                      commonExtrasGroup.modifiers.map(extra => {
                        const isSelected = selections.some(s => s.id === extra.id);
                        return (
                          <button
                            key={extra.id}
                            onClick={() => toggleExtra(extra)}
                            className={cn(
                              "p-2.5 rounded-lg border transition-all text-left flex items-center justify-between",
                              isSelected 
                                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                                : "bg-white/5 border-white/5 text-text-secondary hover:border-white/20"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase">{extra.name}</span>
                              <span className="text-[9px] font-mono text-emerald-500/60 font-medium">+{PricingEngine.formatCurrency(extra.priceDelta)}</span>
                            </div>
                            {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="col-span-2 p-4 border border-dashed border-white/10 rounded-xl text-center">
                        <p className="text-[8px] text-text-muted uppercase tracking-widest font-black">No Global Extras Found</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Allergy & Dietary Safeguard */}
                <section className="bg-white/5 rounded-xl p-3.5 border border-white/5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-status-pending" />
                      Allergy Safeguard
                    </h3>
                    <span className="text-[7px] bg-status-pending/20 text-status-pending px-1.5 py-0.5 rounded font-black uppercase tracking-wider">UK 14 Allergens</span>
                  </div>

                  {item.allergies && item.allergies.length > 0 && (
                    <div className="p-2.5 bg-status-pending/15 border border-status-pending/20 rounded-lg flex flex-col gap-1.5">
                      <div className="flex items-center gap-1 text-status-pending">
                        <AlertCircle className="w-3 h-3 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Recipe Contains:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.allergies.map(allg => (
                          <span key={allg} className="px-1.5 py-0.5 bg-status-pending/20 border border-status-pending/30 rounded text-[8px] font-black text-white uppercase">
                            {allg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5 bg-black/20 p-2.5 rounded-lg border border-white/5">
                      <p className="text-[8px] font-black text-text-muted uppercase tracking-wider">Specify Guest Allergy Concerns:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-28 overflow-y-auto pr-1 no-scrollbar">
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
                                "p-1.5 rounded border text-left text-[9px] uppercase font-bold transition-all truncate",
                                isSelected 
                                  ? "bg-status-pending border-status-pending text-white shadow" 
                                  : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10"
                              )}
                            >
                              {allg}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedAllergies.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 bg-black/25 p-2.5 rounded-lg border border-white/5 animate-in fade-in duration-300">
                        {/* Reaction Severity */}
                        <div className="space-y-1">
                          <p className="text-[8px] font-black text-text-muted uppercase tracking-wider">Severity:</p>
                          <div className="grid grid-cols-2 gap-1">
                            {(['Allergic', 'Intolerant'] as const).map(sev => (
                              <button
                                type="button"
                                key={sev}
                                onClick={() => setAllergySeverity(sev)}
                                className={cn(
                                  "py-1 rounded text-[8px] uppercase tracking-wider font-bold transition-all border",
                                  allergySeverity === sev 
                                    ? "bg-status-pending text-white border-status-pending shadow" 
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
                          <p className="text-[8px] font-black text-text-muted uppercase tracking-wider">Cross Contam:</p>
                          <div className="grid grid-cols-2 gap-1">
                            {[
                              { label: 'Strict NO', val: false, color: 'bg-red-600 text-white border-red-500' },
                              { label: 'Contam OK', val: true, color: 'bg-amber-600 text-white border-amber-500' }
                            ].map(cont => (
                              <button
                                type="button"
                                key={cont.label}
                                onClick={() => setCrossContamOk(cont.val)}
                                className={cn(
                                  "py-1 rounded text-[8px] uppercase tracking-wider font-bold transition-all border",
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
                </section>

                {/* Special Instructions */}
                <section>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Special Instructions</h3>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g. Sauce on the side, cut in half..."
                    className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-brand-primary transition-all min-h-[60px] resize-none"
                  />
                </section>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 md:p-5 border-t border-white/5 bg-black/20 space-y-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white hover:bg-white/10"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-lg font-black text-white w-4 text-center">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-white shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest leading-none mb-1">Estimated Total</p>
                <p className="text-lg font-mono font-black text-white">{PricingEngine.formatCurrency(totalPrice)}</p>
              </div>
            </div>

            <button
              onClick={() => {
                let finalNotes = notes.trim();
                const customisations: AllergyCustomisation[] = selectedAllergies.map(a => ({
                  allergen: a,
                  type: allergySeverity,
                  crossContaminationOk: crossContamOk
                }));
                if (customisations.length > 0) {
                  const severityStr = allergySeverity.toUpperCase();
                  const contamStr = crossContamOk ? 'Contamination OK' : 'STRICT NO CROSS-CONTAM';
                  const allergyPref = `🚨 [${severityStr}: ${selectedAllergies.join(', ').toUpperCase()} - ${contamStr}] 🚨`;
                  finalNotes = finalNotes ? `${allergyPref}\n${finalNotes}` : allergyPref;
                }
                onConfirm(selections, finalNotes, quantity, adjustments, customisations);
              }}
              className="w-full py-3.5 bg-brand-primary rounded-xl font-black uppercase tracking-widest text-white shadow-lg shadow-brand-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs"
            >
              <ShoppingCart className="w-4 h-4" />
              Add {quantity} to Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
