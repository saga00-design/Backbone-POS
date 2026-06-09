import React, { useState } from 'react';
import { usePOSStore } from '../../app/store';
import { db } from '../../lib/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Copy, Trash2, X, Settings2, Hash, ChefHat, Milk, Beer, ListChecks, ArrowRight, Save, ChevronUp, ChevronDown, AlertCircle, Check } from 'lucide-react';
import { cn, sanitizeForFirestore } from '../../lib/utils';
import { MenuItemSnapshot, ModifierGroup, Modifier, Station, Course } from '../../types/pos';
import { POS_CONFIG } from '../../app/config';

export const UK_ALLERGENS = [
  'Celery',
  'Cereals (Gluten)',
  'Crustaceans',
  'Eggs',
  'Fish',
  'Lupin',
  'Milk',
  'Molluscs',
  'Mustard',
  'Peanuts',
  'Sesame',
  'Soybeans',
  'Sulfur Dioxide / Sulfites',
  'Tree Nuts'
];

interface ItemEditorModalProps {
  item: Partial<MenuItemSnapshot>;
  categories: { id: string, name: string }[];
  onClose: () => void;
  onSave: (item: Partial<MenuItemSnapshot>) => Promise<void>;
}

const ItemEditorModal: React.FC<ItemEditorModalProps> = ({ item, categories, onClose, onSave }) => {
  const { modifierGroups: globalGroups } = usePOSStore();
  const [formData, setFormData] = useState<Partial<MenuItemSnapshot>>(item);
  const [activeTab, setActiveTab] = useState<'details' | 'ingredients' | 'modifiers' | 'allergies'>('details');
  const [showGlobalLinker, setShowGlobalLinker] = useState(false);

  const addIngredient = () => {
    const ingredients = [...(formData.ingredients || []), ''];
    setFormData({ ...formData, ingredients });
  };
  
  const linkGlobalGroup = (group: ModifierGroup) => {
    // We deep copy to avoid direct mutation of global store template
    const newGroup: ModifierGroup = JSON.parse(JSON.stringify(group));
    // Regenerate IDs if needed, but usually keeping them is fine for linking
    const modifierGroups = [...(formData.modifierGroups || []), newGroup];
    setFormData({ ...formData, modifierGroups });
    setShowGlobalLinker(false);
  };

  const updateIngredient = (index: number, value: string) => {
    const ingredients = [...(formData.ingredients || [])];
    ingredients[index] = value;
    setFormData({ ...formData, ingredients });
  };

  const removeIngredient = (index: number) => {
    const ingredients = formData.ingredients?.filter((_, i) => i !== index);
    setFormData({ ...formData, ingredients });
  };

  const addModifierGroup = () => {
    const modifierGroups = [...(formData.modifierGroups || []), {
      id: Math.random().toString(36).substring(7),
      name: 'New Group',
      minSelection: 0,
      maxSelection: 1,
      modifiers: []
    }];
    setFormData({ ...formData, modifierGroups });
  };

  const updateModifierGroup = (index: number, group: ModifierGroup) => {
    const modifierGroups = [...(formData.modifierGroups || [])];
    modifierGroups[index] = group;
    setFormData({ ...formData, modifierGroups });
  };

  const removeModifierGroup = (index: number) => {
    const modifierGroups = formData.modifierGroups?.filter((_, i) => i !== index);
    setFormData({ ...formData, modifierGroups });
  };

  const addModifier = (groupIndex: number) => {
    const modifierGroups = [...(formData.modifierGroups || [])];
    const group = { ...modifierGroups[groupIndex] };
    group.modifiers = [...group.modifiers, {
      id: Math.random().toString(36).substring(7),
      name: 'New Modifier',
      priceDelta: 0
    }];
    modifierGroups[groupIndex] = group;
    setFormData({ ...formData, modifierGroups });
  };

  const updateModifier = (groupIndex: number, modIndex: number, mod: Modifier) => {
    const modifierGroups = [...(formData.modifierGroups || [])];
    const group = { ...modifierGroups[groupIndex] };
    const modifiers = [...group.modifiers];
    modifiers[modIndex] = mod;
    group.modifiers = modifiers;
    modifierGroups[groupIndex] = group;
    setFormData({ ...formData, modifierGroups });
  };

  const removeModifier = (groupIndex: number, modIndex: number) => {
    const modifierGroups = [...(formData.modifierGroups || [])];
    const group = { ...modifierGroups[groupIndex] };
    group.modifiers = group.modifiers.filter((_, i) => i !== modIndex);
    modifierGroups[groupIndex] = group;
    setFormData({ ...formData, modifierGroups });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-bg-card w-full max-w-4xl rounded-[2.5rem] border border-white/10 flex flex-col h-[85vh] overflow-hidden shadow-2xl">
        <div className="h-20 flex items-center px-10 border-b border-white/5 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              {item.id ? 'Edit Menu Item' : 'New Menu Item'}
            </h2>
            <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full font-black uppercase tracking-widest">
              {formData.categoryId ? categories.find(c => c.id === formData.categoryId)?.name : 'Uncategorized'}
            </span>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
            <X className="w-6 h-6 text-text-muted" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-white/5 p-2 mx-10 mt-6 rounded-2xl border border-white/5 shrink-0 select-none">
          <button 
            type="button"
            onClick={() => setActiveTab('details')}
            className={cn(
              "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeTab === 'details' ? "bg-brand-primary text-white shadow-xl shadow-brand-primary/20" : "text-text-muted hover:text-white"
            )}
          >
            <Settings2 className="w-4 h-4" />
            General Details
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('ingredients')}
            className={cn(
              "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeTab === 'ingredients' ? "bg-brand-primary text-white shadow-xl shadow-brand-primary/20" : "text-text-muted hover:text-white"
            )}
          >
            <ChefHat className="w-4 h-4" />
            Ingredients
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('allergies')}
            className={cn(
              "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeTab === 'allergies' ? "bg-brand-primary text-white shadow-xl shadow-brand-primary/20" : "text-text-muted hover:text-white"
            )}
          >
            <AlertCircle className="w-4 h-4" />
            UK Allergens ({formData.allergies?.length || 0})
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('modifiers')}
            className={cn(
              "flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              activeTab === 'modifiers' ? "bg-brand-primary text-white shadow-xl shadow-brand-primary/20" : "text-text-muted hover:text-white"
            )}
          >
            <ListChecks className="w-4 h-4" />
            Modifier Groups
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
          {activeTab === 'details' && (
            <div className="grid grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Item Name</label>
                  <input 
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold outline-none focus:border-brand-primary transition-all"
                    placeholder="e.g. Signature Taco"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Price & Profit</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-text-muted uppercase">Sell Price (Pence)</p>
                      <input 
                        type="number"
                        value={formData.priceGross || 0}
                        onChange={e => setFormData({ ...formData, priceGross: parseInt(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-mono font-bold outline-none focus:border-brand-primary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-text-muted uppercase">Cost Price (Pence)</p>
                      <input 
                        type="number"
                        value={formData.cost || 0}
                        onChange={e => setFormData({ ...formData, cost: parseInt(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-mono font-bold outline-none focus:border-brand-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-4">
                    <p className="text-[10px] text-brand-primary/60 font-mono">Gross: £{( (formData.priceGross || 0) / 100).toFixed(2)}</p>
                    <p className="text-[10px] text-status-pending font-mono">Margin: {formData.priceGross ? Math.round(((formData.priceGross - (formData.cost || 0)) / formData.priceGross) * 100) : 0}%</p>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Station & Preparation</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['grill', 'cold', 'dessert', 'bar', 'pass'].map(s => (
                      <button
                        key={s}
                        onClick={() => setFormData({ ...formData, station: s as Station })}
                        className={cn(
                          "py-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                          formData.station === s ? "bg-brand-primary border-brand-primary text-white" : "bg-white/5 border-white/5 text-text-muted hover:border-white/20"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Service Course</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['drinks', 'starters', 'mains', 'desserts', 'sides'].map(c => (
                      <button
                        key={c}
                        onClick={() => setFormData({ ...formData, course: c as Course })}
                        className={cn(
                          "py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                          formData.course === c ? "bg-emerald-600 border-emerald-500 text-white" : "bg-white/5 border-white/5 text-text-muted hover:border-white/20"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-6 p-6 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex-1">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Alcoholic Beverage</h4>
                    <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-tighter">Requires ID check if enabled</p>
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, isAlcoholic: !formData.isAlcoholic, isDrink: true })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                      formData.isAlcoholic ? "bg-brand-primary" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white transition-all shadow-md",
                      formData.isAlcoholic ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ingredients' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="grid grid-cols-2 gap-8">
                {/* Traditional Ingredient Flags */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Ingredient Flags</h3>
                    <button onClick={addIngredient} className="text-brand-primary text-[10px] font-black uppercase tracking-widest">+ Add</button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {formData.ingredients?.map((ing, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          value={ing}
                          onChange={e => updateIngredient(idx, e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs"
                          placeholder="e.g. Tomato"
                        />
                        <button onClick={() => removeIngredient(idx)} className="text-text-muted hover:text-status-pending">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stock Recipe (HUB Connection) */}
                <div className="space-y-4 border-l border-white/5 pl-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-tight">Theoretical Stock</h3>
                      <p className="text-[8px] text-text-secondary font-black uppercase mt-1 tracking-widest">Weight / Volume for Hub Tracking</p>
                    </div>
                    <button 
                      onClick={() => setFormData({ ...formData, stockRequirements: [...(formData.stockRequirements || []), { name: '', quantity: 0, unit: 'g', cost: 0 }] })} 
                      className="text-brand-primary text-[10px] font-black uppercase tracking-widest"
                    >
                      + Recipie
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.stockRequirements?.map((req, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          placeholder="Short Rib..." 
                          value={req.name}
                          onChange={e => {
                            const newReqs = [...(formData.stockRequirements || [])];
                            newReqs[idx].name = e.target.value;
                            setFormData({ ...formData, stockRequirements: newReqs });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-[10px]"
                        />
                        <input 
                          type="number"
                          placeholder="Qty" 
                          value={req.quantity}
                          onChange={e => {
                            const newReqs = [...(formData.stockRequirements || [])];
                            newReqs[idx].quantity = parseFloat(e.target.value);
                            setFormData({ ...formData, stockRequirements: newReqs });
                          }}
                          className="w-16 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white font-mono text-[10px]"
                        />
                        <select 
                          value={req.unit}
                          onChange={e => {
                            const newReqs = [...(formData.stockRequirements || [])];
                            newReqs[idx].unit = e.target.value;
                            setFormData({ ...formData, stockRequirements: newReqs });
                          }}
                          className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-[10px] outline-none"
                        >
                          <option value="g">g</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                          <option value="slice">slice</option>
                        </select>
                        <button 
                          onClick={() => setFormData({ ...formData, stockRequirements: formData.stockRequirements?.filter((_, i) => i !== idx) })}
                          className="text-text-muted hover:text-status-pending"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'modifiers' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">Requirement Groups</h3>
                  <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest mt-1">Options like Sauce, Sides, or Cooking Temp</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowGlobalLinker(!showGlobalLinker)} 
                    className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary/20 transition-all border border-brand-primary/20"
                  >
                    <ListChecks className="w-4 h-4" />
                    Link Global
                  </button>
                  <button onClick={addModifierGroup} className="flex items-center gap-2 bg-white/5 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10">
                    <Plus className="w-4 h-4" />
                    Custom Group
                  </button>
                </div>
              </div>

              {showGlobalLinker && (
                <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-3xl p-6 grid grid-cols-2 md:grid-cols-3 gap-4 animate-in zoom-in-95 duration-200">
                  {globalGroups.length === 0 ? (
                    <p className="col-span-full text-center py-4 text-[10px] text-brand-primary font-black uppercase tracking-widest">No global groups synced from hub yet</p>
                  ) : (
                    globalGroups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => linkGlobalGroup(group)}
                        className="p-4 bg-white/5 hover:bg-brand-primary/10 rounded-2xl border border-white/5 hover:border-brand-primary/30 transition-all text-left"
                      >
                        <p className="text-xs font-bold text-white mb-1">{group.name}</p>
                        <p className="text-[8px] text-text-muted font-black uppercase tracking-tighter">{group.modifiers.length} Options • Min {group.minSelection} Max {group.maxSelection}</p>
                      </button>
                    ))
                  )}
                </div>
              )}

              <div className="space-y-6">
                {formData.modifierGroups?.map((group, gIdx) => (
                  <div key={group.id} className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-6">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Group Name</label>
                          <input 
                            value={group.name}
                            onChange={e => updateModifierGroup(gIdx, { ...group, name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Min Selection</label>
                          <input 
                            type="number"
                            value={group.minSelection}
                            onChange={e => updateModifierGroup(gIdx, { ...group, minSelection: parseInt(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Max Selection</label>
                          <input 
                            type="number"
                            value={group.maxSelection}
                            onChange={e => updateModifierGroup(gIdx, { ...group, maxSelection: parseInt(e.target.value) })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none"
                          />
                        </div>
                      </div>
                      <button onClick={() => removeModifierGroup(gIdx)} className="p-3 bg-status-pending/10 text-status-pending rounded-xl hover:bg-status-pending hover:text-white transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Modifier Options & Stock Costs</label>
                        <button onClick={() => addModifier(gIdx)} className="text-[9px] font-black text-brand-primary uppercase tracking-widest hover:underline">+ Add Option</button>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {group.modifiers.map((mod, mIdx) => (
                          <div key={mod.id} className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                            <div className="flex gap-3 items-center">
                              <input 
                                placeholder="Option Name"
                                value={mod.name}
                                onChange={e => updateModifier(gIdx, mIdx, { ...mod, name: e.target.value })}
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold"
                              />
                              <div className="w-32 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-mono text-[10px]">£</span>
                                <input 
                                  type="number"
                                  placeholder="Price Δ"
                                  value={mod.priceDelta}
                                  onChange={e => updateModifier(gIdx, mIdx, { ...mod, priceDelta: parseInt(e.target.value) })}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-6 pr-3 py-3 text-white text-xs font-mono"
                                />
                              </div>
                              <div className="w-24 relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-status-pending font-mono text-[8px]">Cost</span>
                                <input 
                                  type="number"
                                  placeholder="Cost"
                                  value={mod.cost || 0}
                                  onChange={e => updateModifier(gIdx, mIdx, { ...mod, cost: parseInt(e.target.value) })}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-2 py-3 text-white text-xs font-mono"
                                />
                              </div>
                              <button onClick={() => removeModifier(gIdx, mIdx)} className="p-3 text-text-muted hover:text-status-pending">
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Stock Requirements for Modifier */}
                            <div className="pt-2 border-t border-white/5 flex flex-wrap gap-2 items-center">
                              <span className="text-[8px] font-black text-text-muted uppercase tracking-widest mr-2">Stock Link:</span>
                              {(mod.stockRequirements || []).map((sreq, sidx) => (
                                <div key={sidx} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                                  <span className="text-[9px] text-white font-bold">{sreq.name}</span>
                                  <span className="text-[8px] text-brand-primary font-mono">{sreq.quantity}{sreq.unit}</span>
                                  <button 
                                    onClick={() => {
                                      const newSreqs = mod.stockRequirements?.filter((_, i) => i !== sidx);
                                      updateModifier(gIdx, mIdx, { ...mod, stockRequirements: newSreqs });
                                    }}
                                    className="text-text-muted hover:text-white"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <button 
                                onClick={() => {
                                  const newSreqs = [...(mod.stockRequirements || []), { name: '', quantity: 0, unit: 'g', cost: 0 }];
                                  updateModifier(gIdx, mIdx, { ...mod, stockRequirements: newSreqs });
                                }}
                                className="text-brand-primary text-[8px] font-black uppercase tracking-widest hover:underline"
                              >
                                + Add Stock Line
                              </button>
                            </div>

                            {/* Stock Line Editor (Inline) */}
                            {mod.stockRequirements?.some(r => r.name === '') && (
                              <div className="flex gap-2 mt-2 bg-brand-primary/5 p-2 rounded-xl border border-brand-primary/10">
                                <input 
                                  placeholder="Stock Item Name"
                                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white"
                                  autoFocus
                                  onBlur={(e) => {
                                    if (!e.target.value) return;
                                    const newSreqs = [...(mod.stockRequirements || [])];
                                    const emptyIdx = newSreqs.findIndex(r => r.name === '');
                                    if (emptyIdx !== -1) {
                                      newSreqs[emptyIdx].name = e.target.value;
                                      updateModifier(gIdx, mIdx, { ...mod, stockRequirements: newSreqs });
                                    }
                                  }}
                                />
                                <input 
                                  type="number"
                                  placeholder="Qty"
                                  className="w-12 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-mono"
                                  onChange={(e) => {
                                    const newSreqs = [...(mod.stockRequirements || [])];
                                    const emptyIdx = newSreqs.findIndex(r => r.name === '');
                                    if (emptyIdx !== -1) {
                                      newSreqs[emptyIdx].quantity = parseFloat(e.target.value);
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'allergies' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-status-pending" />
                  UK Recognized 14 Allergens
                </h3>
                <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest mt-1">Select all official allergens that are present in this recipe to avoid customer mistakes</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {UK_ALLERGENS.map(allergen => {
                  const hasAllergen = formData.allergies?.includes(allergen);
                  return (
                    <button
                      type="button"
                      key={allergen}
                      onClick={() => {
                        const currentAllergies = formData.allergies || [];
                        const nextAllergies = hasAllergen
                          ? currentAllergies.filter(a => a !== allergen)
                          : [...currentAllergies, allergen];
                        setFormData({ ...formData, allergies: nextAllergies });
                      }}
                      className={cn(
                        "p-5 rounded-2xl border transition-all text-left flex items-center justify-between group h-20 select-none",
                        hasAllergen
                          ? "bg-status-pending/20 border-status-pending text-white shadow-lg"
                          : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/10 hover:border-white/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <AlertCircle className={cn("w-5 h-5 shrink-0", hasAllergen ? "text-status-pending" : "text-text-secondary group-hover:text-white")} />
                        <span className="text-xs font-black uppercase tracking-tight">{allergen}</span>
                      </div>
                      {hasAllergen && (
                        <div className="w-6 h-6 bg-status-pending rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-10 border-t border-white/5 shrink-0 flex gap-4">
          <button onClick={onClose} className="px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs text-text-muted hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex-1 py-5 bg-brand-primary rounded-[1.5rem] text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <Save className="w-4 h-4" />
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

export const MenuManagementScreen: React.FC = () => {
  const { menuItems, categories, syncFromHub } = usePOSStore();
  const [activeCategory, setActiveCategory] = useState<string | 'modifiers'>(categories[0]?.id || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItemSnapshot> | null>(null);
  const [editingGroup, setEditingGroup] = useState<Partial<ModifierGroup> | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncFromHub();
      alert('Sync complete!');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveItem = async (itemData: Partial<MenuItemSnapshot>) => {
    try {
      if (itemData.id) {
        const itemRef = doc(db, 'menuItems', itemData.id);
        await updateDoc(itemRef, sanitizeForFirestore(itemData));
      } else {
        await addDoc(collection(db, 'menuItems'), sanitizeForFirestore({
          ...itemData,
          categoryId: activeCategory,
          locationId: POS_CONFIG.LOCATION_ID,
        }));
      }
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  };

  const handleSaveGroup = async (groupData: Partial<ModifierGroup>) => {
    try {
      if (groupData.id) {
        const groupRef = doc(db, 'modifierGroups', groupData.id);
        await updateDoc(groupRef, sanitizeForFirestore(groupData));
      } else {
        await addDoc(collection(db, 'modifierGroups'), sanitizeForFirestore({
          ...groupData,
          locationId: POS_CONFIG.LOCATION_ID,
        }));
      }
      setEditingGroup(null);
    } catch (error) {
      console.error('Error saving group:', error);
      alert('Failed to save modifier group');
    }
  };

  const handleCopyItem = async (item: MenuItemSnapshot) => {
    try {
      const { id, ...itemData } = item;
      await addDoc(collection(db, 'menuItems'), sanitizeForFirestore({
        ...itemData,
        name: `${item.name} (Copy)`,
      }));
    } catch (error) {
      console.error('Error copying item:', error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'menuItems', id));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this modifier group?')) return;
    try {
      await deleteDoc(doc(db, 'modifierGroups', id));
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const handleMoveCategory = async (catId: string, direction: 'up' | 'down') => {
    const index = categories.findIndex(c => c.id === catId);
    if (index === -1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    
    try {
      const newSequence = [...categories];
      const temp = newSequence[index];
      newSequence[index] = newSequence[targetIndex];
      newSequence[targetIndex] = temp;
      
      await Promise.all(
        newSequence.map((cat, i) => 
          updateDoc(doc(db, 'menuCategories', cat.id), { order: i * 10 })
        )
      );
    } catch (error) {
      console.error('Error swapping category order:', error);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-bg-dark">
      <div className="w-64 bg-bg-card border-r border-white/5 flex flex-col">
        <div className="h-20 flex items-center px-6 border-b border-white/5 justify-between">
          <h2 className="text-lg font-black text-white uppercase tracking-tight">System Data</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          <div className="mb-4">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 mb-2">Menu Sections</h4>
            {categories.map((cat, idx) => (
              <div
                key={cat.id}
                className={cn(
                  "group flex items-center justify-between rounded-xl transition-all mb-1 pr-2",
                  activeCategory === cat.id ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-secondary hover:bg-white/5"
                )}
              >
                <button
                  onClick={() => setActiveCategory(cat.id)}
                  className="flex-1 text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-inherit"
                >
                  {cat.name}
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveCategory(cat.id, 'up')}
                    className={cn(
                      "p-1 rounded text-inherit disabled:opacity-20 hover:bg-white/15",
                      idx === 0 && "cursor-not-allowed"
                    )}
                    title="Move Section Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === categories.length - 1}
                    onClick={() => handleMoveCategory(cat.id, 'down')}
                    className={cn(
                      "p-1 rounded text-inherit disabled:opacity-20 hover:bg-white/15",
                      idx === categories.length - 1 && "cursor-not-allowed"
                    )}
                    title="Move Section Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/5">
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest px-4 mb-2">Global Data</h4>
            <button
              onClick={() => setActiveCategory('modifiers')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                activeCategory === 'modifiers' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-secondary hover:bg-white/5"
              )}
            >
              Modifier Groups
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-20 bg-bg-card border-b border-white/5 flex items-center px-8 justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              {activeCategory === 'modifiers' ? 'Global Modifiers' : categories.find(c => c.id === activeCategory)?.name || 'Menu Items'}
            </h2>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-white/5 px-6 py-2 rounded-xl text-text-secondary hover:text-white font-black uppercase tracking-widest text-xs border border-white/10 transition-all disabled:opacity-50"
            >
              <ArrowRight className={cn("w-4 h-4", isSyncing && "animate-spin")} />
              {isSyncing ? 'Syncing...' : 'Sync Hub'}
            </button>
            {activeCategory === 'modifiers' ? (
              <button 
                onClick={() => setEditingGroup({ name: 'New Group', minSelection: 0, maxSelection: 1, modifiers: [] })}
                className="flex items-center gap-2 bg-brand-primary px-6 py-2 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-brand-primary/20"
              >
                <Plus className="w-4 h-4" />
                Add Group
              </button>
            ) : (
              <button 
                onClick={() => setEditingItem({ station: 'grill', priceGross: 0, vatRate: 20, isDrink: false, ingredients: [], modifierGroups: [] })}
                className="flex items-center gap-2 bg-brand-primary px-6 py-2 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-brand-primary/20"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          {activeCategory === 'modifiers' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {usePOSStore.getState().modifierGroups.map(group => (
                <div key={group.id} className="bg-bg-card border border-white/5 rounded-[2rem] p-8 flex flex-col justify-between group hover:border-white/20 transition-all shadow-sm">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-white font-black text-sm uppercase tracking-tight">{group.name}</h3>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-1">
                          {group.modifiers.length} Options • {group.minSelection === group.maxSelection ? `Select ${group.minSelection}` : `Min ${group.minSelection} / Max ${group.maxSelection}`}
                        </p>
                      </div>
                      <button 
                        onClick={() => setEditingGroup(group)}
                        className="p-3 text-text-muted hover:text-brand-primary bg-white/5 rounded-xl transition-all"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar pr-2 pt-2 border-t border-white/5">
                      {group.modifiers.map(mod => (
                        <div key={mod.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                          <span className="text-[10px] font-bold text-text-secondary uppercase">{mod.name}</span>
                          <span className="text-[10px] font-mono text-brand-primary font-black">+£{(mod.priceDelta / 100).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-8 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDeleteGroup(group.id)} className="p-3 text-text-muted hover:text-status-pending hover:bg-status-pending/10 rounded-xl transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {menuItems.filter(i => i.categoryId === activeCategory).map(item => (
                <div key={item.id} className="bg-bg-card border border-white/5 rounded-[2rem] p-5 flex flex-col justify-between group hover:border-white/20 transition-all min-h-[180px] shadow-sm">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-white font-bold text-xs line-clamp-2 uppercase tracking-wide">{item.name}</h3>
                      <button 
                        onClick={() => setEditingItem(item)}
                        className="p-2 text-text-muted hover:text-brand-primary bg-white/5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-brand-primary font-mono text-[10px] font-bold">£{(item.priceGross / 100).toFixed(2)}</p>
                    <div className="mt-4 flex flex-wrap gap-1">
                      <span className="text-[7px] uppercase font-black tracking-widest bg-white/5 px-2 py-1 rounded text-text-muted border border-white/5">{item.station}</span>
                      {item.ingredients?.slice(0, 3).map(ing => (
                        <span key={ing} className="text-[7px] uppercase font-bold bg-brand-primary/10 text-brand-primary px-2 py-1 rounded">{ing}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleCopyItem(item)} className="p-2 text-text-secondary hover:text-white hover:bg-white/5 rounded-xl"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-text-muted hover:text-status-pending hover:bg-status-pending/10 rounded-xl"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingItem && (
        <ItemEditorModal 
          item={editingItem}
          categories={categories}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveItem}
        />
      )}

      {editingGroup && (
        <GroupEditorModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSave={handleSaveGroup}
        />
      )}
    </div>
  );
};

interface GroupEditorModalProps {
  group: Partial<ModifierGroup>;
  onClose: () => void;
  onSave: (group: Partial<ModifierGroup>) => Promise<void>;
}

const GroupEditorModal: React.FC<GroupEditorModalProps> = ({ group, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ModifierGroup>>(group);

  const addModifier = () => {
    const modifiers = [...(formData.modifiers || []), {
      id: Math.random().toString(36).substring(7),
      name: 'New Option',
      priceDelta: 0,
      cost: 0
    }];
    setFormData({ ...formData, modifiers });
  };

  const updateModifier = (idx: number, mod: Modifier) => {
    const modifiers = [...(formData.modifiers || [])];
    modifiers[idx] = mod;
    setFormData({ ...formData, modifiers });
  };

  const removeModifier = (idx: number) => {
    const modifiers = formData.modifiers?.filter((_, i) => i !== idx);
    setFormData({ ...formData, modifiers });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-bg-card w-full max-w-2xl rounded-[2.5rem] border border-white/10 flex flex-col max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="h-20 flex items-center px-10 border-b border-white/5 justify-between shrink-0">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            {group.id ? 'Edit Group' : 'New Modifier Group'}
          </h2>
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
            <X className="w-6 h-6 text-text-muted" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Group Name</label>
              <input 
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-brand-primary transition-all"
                placeholder="e.g. Side Salad Options"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Min</label>
                <input 
                  type="number"
                  value={formData.minSelection}
                  onChange={e => setFormData({ ...formData, minSelection: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-mono font-bold outline-none"
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Max</label>
                <input 
                  type="number"
                  value={formData.maxSelection}
                  onChange={e => setFormData({ ...formData, maxSelection: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-mono font-bold outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Options & Inventory Costs</h3>
              <button 
                onClick={addModifier}
                className="text-brand-primary text-[10px] font-black uppercase tracking-widest hover:underline"
              >
                + Add Option
              </button>
            </div>
            <div className="space-y-2">
              {formData.modifiers?.map((mod, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <input 
                    value={mod.name}
                    onChange={e => updateModifier(idx, { ...mod, name: e.target.value })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs"
                    placeholder="Option Name"
                  />
                  <div className="w-24 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted font-mono text-[8px]">GBP</span>
                    <input 
                      type="number"
                      value={mod.priceDelta}
                      onChange={e => updateModifier(idx, { ...mod, priceDelta: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-2 py-2 text-white font-mono text-[10px]"
                    />
                  </div>
                  <div className="w-24 relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-status-pending font-mono text-[8px]">Cost</span>
                    <input 
                      type="number"
                      value={mod.cost || 0}
                      onChange={e => updateModifier(idx, { ...mod, cost: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-2 py-2 text-white font-mono text-[10px]"
                    />
                  </div>
                  <button onClick={() => removeModifier(idx)} className="text-text-muted hover:text-status-pending transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-10 border-t border-white/5 shrink-0 flex gap-4">
          <button onClick={onClose} className="px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs text-text-muted hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="flex-1 py-5 bg-brand-primary rounded-[1.5rem] text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <Save className="w-4 h-4" />
            Save group
          </button>
        </div>
      </div>
    </div>
  );
};
;
