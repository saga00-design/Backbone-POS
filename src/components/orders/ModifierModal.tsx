import React, { useState } from 'react';
import { MenuItemSnapshot, Modifier, ModifierGroup, ModifierSelection, IngredientAction } from '../../types/pos';
import { X, Check, Plus, Minus, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModifierModalProps {
  item: MenuItemSnapshot;
  onClose: () => void;
  onConfirm: (modifiers: ModifierSelection[], notes: string, quantity: number, adjustments?: Record<string, IngredientAction>) => void;
}

export const ModifierModal: React.FC<ModifierModalProps> = ({ item, onClose, onConfirm }) => {
  const [selections, setSelections] = useState<ModifierSelection[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, IngredientAction>>({});
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'modifiers' | 'ingredients'>(
    item.modifierGroups && item.modifierGroups.length > 0 ? 'modifiers' : 'ingredients'
  );

  const toggleModifier = (group: ModifierGroup, modifier: Modifier) => {
    const isSelected = selections.some(s => s.id === modifier.id);
    
    if (isSelected) {
      setSelections(selections.filter(s => s.id !== modifier.id));
    } else {
      // Check max selection for the group
      const groupSelections = selections.filter(s => 
        group.modifiers.some(m => m.id === s.id)
      );
      
      if (groupSelections.length < group.maxSelection) {
        setSelections([...selections, { id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta }]);
      } else if (group.maxSelection === 1) {
        // Replace if max is 1
        const otherSelections = selections.filter(s => 
          !group.modifiers.some(m => m.id === s.id)
        );
        setSelections([...otherSelections, { id: modifier.id, name: modifier.name, priceDelta: modifier.priceDelta }]);
      }
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

  const isGroupValid = (group: ModifierGroup) => {
    const groupSelections = selections.filter(s => 
      group.modifiers.some(m => m.id === s.id)
    );
    return groupSelections.length >= group.minSelection && groupSelections.length <= group.maxSelection;
  };

  const allGroupsValid = item.modifierGroups?.every(isGroupValid) ?? true;

  const hasIngredients = item.ingredients && item.ingredients.length > 0;
  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4">
      <div className="bg-bg-card w-full max-w-2xl rounded-3xl md:rounded-[2rem] border border-white/10 flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 md:p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">{item?.name || 'Unknown Item'}</h2>
            <p className="text-text-secondary text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Customize Item</p>
          </div>
          <button onClick={onClose} className="p-2 md:p-3 bg-white/5 rounded-xl md:rounded-2xl text-text-muted hover:text-white transition-all">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Tab Selector if both exist */}
        {hasIngredients && hasModifiers && (
          <div className="flex bg-white/5 p-1 mx-4 md:mx-8 mt-4 rounded-2xl border border-white/5 shrink-0">
            <button 
              onClick={() => setActiveTab('modifiers')}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'modifiers' ? "bg-brand-primary text-white" : "text-text-muted hover:text-white"
              )}
            >
              Requirements
            </button>
            <button 
              onClick={() => setActiveTab('ingredients')}
              className={cn(
                "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'ingredients' ? "bg-brand-primary text-white" : "text-text-muted hover:text-white"
              )}
            >
              Ingredients
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 no-scrollbar">
          {activeTab === 'modifiers' && hasModifiers && (
            /* Modifier Groups */
            <div className="space-y-8">
              {item.modifierGroups?.map(group => (
                <div key={group.id} className="space-y-3 md:space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs md:text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      {group.name}
                      {group.minSelection > 0 && <span className="text-[8px] md:text-[10px] text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">Required</span>}
                    </h3>
                    <span className="text-[8px] md:text-[10px] text-text-muted font-bold uppercase tracking-tighter">
                      Select {group.minSelection === group.maxSelection ? group.minSelection : `${group.minSelection}-${group.maxSelection}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    {group.modifiers.map(mod => {
                      const isSelected = selections.some(s => s.id === mod.id);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggleModifier(group, mod)}
                          className={cn(
                            "p-3 md:p-4 rounded-xl md:rounded-2xl border transition-all text-left flex items-center justify-between",
                            isSelected 
                              ? "bg-brand-primary/10 border-brand-primary text-white" 
                              : "bg-white/5 border-white/5 text-text-secondary hover:border-white/20"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs md:text-sm font-bold">{mod.name}</span>
                            {mod.priceDelta !== 0 && (
                              <span className="text-[10px] font-mono font-bold text-brand-primary">
                                +{mod.priceDelta > 0 ? `£${(mod.priceDelta/100).toFixed(2)}` : `-£${(Math.abs(mod.priceDelta)/100).toFixed(2)}`}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-brand-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'ingredients' && hasIngredients && (
            /* Ingredients Customization */
            <div className="space-y-6">
              <div className="bg-brand-primary/5 border border-brand-primary/10 p-4 md:p-6 rounded-2xl md:rounded-3xl flex items-start gap-4">
                <Info className="w-5 h-5 text-brand-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">Ingredient Adjustments</h4>
                  <p className="text-[10px] text-text-secondary font-bold uppercase tracking-tighter mt-1 leading-relaxed">
                    Click an ingredient to cycle through: <span className="text-white">None</span> → <span className="text-brand-primary">Extra</span> → <span className="text-status-pending">Side</span> → <span className="text-text-muted">Standard</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.ingredients?.map(ing => {
                  const state = adjustments[ing] || 'standard';
                  return (
                    <button
                      key={ing}
                      onClick={() => cycleIngredient(ing)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all text-left flex items-center justify-between relative overflow-hidden group",
                        state === 'no' && "bg-status-pending/5 border-status-pending text-status-pending",
                        state === 'extra' && "bg-brand-primary/10 border-brand-primary text-white",
                        state === 'side' && "bg-amber-500/10 border-amber-500 text-amber-500",
                        state === 'standard' && "bg-white/5 border-white/5 text-text-secondary hover:border-white/20"
                      )}
                    >
                      <div className="flex flex-col relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest">{ing}</span>
                        <span className="text-[8px] font-black uppercase mt-1 opacity-60">
                          {state === 'standard' ? 'Default' : state.toUpperCase()}
                        </span>
                      </div>
                      <div className="relative z-10 shrink-0">
                        {state === 'no' && <X className="w-4 h-4" />}
                        {state === 'extra' && <Plus className="w-4 h-4" />}
                        {state === 'side' && <div className="w-4 h-4 rounded-full border-2 border-current" />}
                        {state === 'standard' && <Check className="w-4 h-4 opacity-10" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity and Notes always visible or in Details tab */}
          <div className="space-y-6 md:space-y-8 pt-4 border-t border-white/5">
            {/* Quantity */}
            <div className="flex items-center justify-between bg-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5">
              <span className="text-xs md:text-sm font-bold text-white uppercase tracking-widest">Quantity</span>
              <div className="flex items-center gap-4 md:gap-6">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all"
                >
                  <Minus className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <span className="text-xl md:text-2xl font-black text-white w-6 md:w-8 text-center">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-brand-primary flex items-center justify-center text-white shadow-lg shadow-brand-primary/20 transition-all"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>

            {/* Special Notes */}
            <div className="space-y-3 md:space-y-4">
              <h3 className="text-xs md:text-sm font-black text-white uppercase tracking-widest">Special Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add kitchen instructions..."
                className="w-full bg-white/5 border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 text-white text-xs md:text-sm focus:outline-none focus:border-brand-primary transition-all min-h-[100px] md:min-h-[120px] resize-none shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-8 border-t border-white/5 shrink-0 bg-white/[0.01]">
          <button
            disabled={!allGroupsValid}
            onClick={() => onConfirm(selections, notes, quantity, adjustments)}
            className={cn(
              "w-full py-4 md:py-6 rounded-2xl md:rounded-3xl font-black uppercase tracking-widest text-xs md:text-sm transition-all shadow-xl",
              allGroupsValid 
                ? "bg-brand-primary text-white shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]" 
                : "bg-white/5 text-white/20 cursor-not-allowed"
            )}
          >
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
};
