import React, { useState } from 'react';
import { usePOSStore } from '../../app/store';
import { db } from '../../lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, X, Settings2, ChefHat, ArrowRight, Save, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, AlertCircle, Check, Search } from 'lucide-react';
import { cn, sanitizeForFirestore } from '../../lib/utils';
import { MenuItemSnapshot, Station, Course, SetMenu } from '../../types/pos';
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
  const [formData, setFormData] = useState<Partial<MenuItemSnapshot>>(item);
  const [activeTab, setActiveTab] = useState<'details' | 'ingredients' | 'allergies'>('details');

  const addIngredient = () => {
    const ingredients = [...(formData.ingredients || []), ''];
    setFormData({ ...formData, ingredients });
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-muted uppercase tracking-widest">Item Type</label>
                  <div className="flex items-center gap-6 p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Side</h4>
                      <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-tighter">Sellable as a side dish on its own</p>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, isSide: !formData.isSide })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                        formData.isSide ? "bg-brand-primary" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full bg-white transition-all shadow-md",
                        formData.isSide ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                  <div className="flex items-center gap-6 p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Add-On</h4>
                      <p className="text-[10px] text-text-secondary mt-1 uppercase tracking-tighter">Offered as an extra when building an order</p>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, isAddon: !formData.isAddon })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative flex items-center px-1",
                        formData.isAddon ? "bg-brand-primary" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full bg-white transition-all shadow-md",
                        formData.isAddon ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                  {formData.isAddon && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-text-muted uppercase tracking-widest">Linked Dish Ingredient ID (optional)</label>
                      <input
                        value={formData.parentRecipeId || ''}
                        onChange={e => setFormData({ ...formData, parentRecipeId: e.target.value || undefined })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold text-xs outline-none focus:border-brand-primary transition-all"
                        placeholder="Matches an ingredient ID on the dish this add-on goes with"
                      />
                    </div>
                  )}
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
  const { menuItems, categories, syncFromHub, activeSetMenus } = usePOSStore();
  const [showSidesAddons, setShowSidesAddons] = useState(false);
  const [selectedTopLevel, setSelectedTopLevel] = useState<string>('');
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
  const [previewMenu, setPreviewMenu] = useState<SetMenu | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidesSearch, setSidesSearch] = useState('');
  const [sidesFilter, setSidesFilter] = useState<'all' | 'sides' | 'addons'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<MenuItemSnapshot> | null>(null);

  // ── CATEGORY HIERARCHY (mirrors OrderEntryScreen's top-level + subfolder nav) ──
  const topLevelCategories = categories
    .filter(c => !c.parentId && !(c as any).hidden && c.id !== 'cat_specials')
    .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));

  const getSubfolders = (parentId: string) =>
    categories
      .filter(c => c.parentId === parentId)
      .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));

  // Recursively collect all descendant category IDs (so items assigned to a
  // deeper leaf, e.g. Wines > Red, still show up while browsing "Wines")
  const collectIds = (id: string): string[] => {
    const children = categories.filter(c => c.parentId === id);
    return [id, ...children.flatMap(c => collectIds(c.id))];
  };

  const getItemCount = (categoryId: string): number =>
    menuItems.filter(item => collectIds(categoryId).includes(item.categoryId)).length;

  const sidesOnlyCategoryIds = categories
    .filter(c => /^sides$/i.test(c.name))
    .flatMap(c => collectIds(c.id));
  const addonsOnlyCategoryIds = categories
    .filter(c => /^add-?ons$/i.test(c.name))
    .flatMap(c => collectIds(c.id));
  const sidesAndAddons = menuItems.filter(item =>
    item.isSide || item.isAddon ||
    sidesOnlyCategoryIds.includes(item.categoryId) || addonsOnlyCategoryIds.includes(item.categoryId)
  );
  const filteredSidesAndAddons = sidesAndAddons.filter(item => {
    const matchesSearch = !sidesSearch.trim() || item.name.toLowerCase().includes(sidesSearch.toLowerCase());
    const matchesFilter =
      sidesFilter === 'all' ? true :
      sidesFilter === 'sides' ? (item.isSide || sidesOnlyCategoryIds.includes(item.categoryId)) :
      (item.isAddon || addonsOnlyCategoryIds.includes(item.categoryId));
    return matchesSearch && matchesFilter;
  });

  const visibleTopLevelCategories = topLevelCategories.filter(
    cat => !/^sides$/i.test(cat.name) && !/^add-?ons$/i.test(cat.name)
  );

  React.useEffect(() => {
    if (categories.length > 0 && !selectedTopLevel) {
      setSelectedTopLevel(topLevelCategories[0]?.id || '');
    }
  }, [categories.length]);

  const currentSubs = getSubfolders(selectedTopLevel);
  const isSearching = searchQuery.trim().length > 0;
  const showSubfolderGrid = currentSubs.length > 0 && !selectedSubfolder && !isSearching;
  const activeCategoryId = selectedSubfolder || selectedTopLevel;
  const activeCategoryIds = React.useMemo(
    () => collectIds(activeCategoryId),
    [activeCategoryId, categories]
  );
  const filteredItems = isSearching
    ? menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : menuItems.filter(item => activeCategoryIds.includes(item.categoryId));
  const topLevelName = selectedTopLevel === 'set_menus'
    ? 'Set Menus & Specials'
    : categories.find(c => c.id === selectedTopLevel)?.name || '';
  const subfolderName = selectedSubfolder ? categories.find(c => c.id === selectedSubfolder)?.name : null;

  const handleTopLevelClick = (catId: string) => {
    setSelectedTopLevel(catId);
    setSelectedSubfolder(null);
    setSearchQuery('');
  };

  const handleSubfolderClick = (subId: string) => {
    setSelectedSubfolder(subId);
  };

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
          categoryId: activeCategoryId,
          locationId: POS_CONFIG.LOCATION_ID,
        }));
      }
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  };

  // Reorders within siblings only (same parentId) so moving a subfolder like
  // "Margaritas" never crosses into an unrelated top-level section.
  const handleMoveCategory = async (catId: string, direction: 'up' | 'down') => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    const siblings = categories
      .filter(c => (c.parentId || null) === (cat.parentId || null))
      .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));

    const index = siblings.findIndex(c => c.id === catId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    try {
      const newSequence = [...siblings];
      const temp = newSequence[index];
      newSequence[index] = newSequence[targetIndex];
      newSequence[targetIndex] = temp;

      await Promise.all(
        newSequence.map((c, i) =>
          updateDoc(doc(db, 'menuCategories', c.id), { order: i * 10 })
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
            {visibleTopLevelCategories.map((cat, idx) => (
              <div
                key={cat.id}
                className={cn(
                  "group flex items-center justify-between rounded-xl transition-all mb-1 pr-2",
                  !showSidesAddons && selectedTopLevel === cat.id ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-secondary hover:bg-white/5"
                )}
              >
                <button
                  onClick={() => { setShowSidesAddons(false); handleTopLevelClick(cat.id); }}
                  className="flex-1 flex items-center gap-1.5 text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-inherit"
                >
                  <span>{cat.name}</span>
                  <span className="ml-auto bg-brand-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shrink-0">
                    {getItemCount(cat.id)}
                  </span>
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
                    disabled={idx === visibleTopLevelCategories.length - 1}
                    onClick={() => handleMoveCategory(cat.id, 'down')}
                    className={cn(
                      "p-1 rounded text-inherit disabled:opacity-20 hover:bg-white/15",
                      idx === visibleTopLevelCategories.length - 1 && "cursor-not-allowed"
                    )}
                    title="Move Section Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                setShowSidesAddons(true);
                setSelectedTopLevel(topLevelCategories[0]?.id || '');
              }}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-between",
                showSidesAddons ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-secondary hover:bg-white/5"
              )}
            >
              <span>Sides & Add-Ons</span>
              <span className="ml-auto bg-brand-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shrink-0">
                {sidesAndAddons.length}
              </span>
            </button>
          </div>
          {activeSetMenus.length > 0 && (
            <div className="mb-4">
              <button
                onClick={() => {
                  setSelectedTopLevel('set_menus');
                  setSelectedSubfolder(null);
                  setShowSidesAddons(false);
                  setSearchQuery('');
                }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl transition-all flex flex-col gap-0.5",
                  selectedTopLevel === 'set_menus'
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                    : "text-text-secondary hover:bg-white/5"
                )}
              >
                <span className="text-xs font-bold uppercase tracking-widest">Set Menus & Specials</span>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-wider",
                  selectedTopLevel === 'set_menus' ? "text-text-muted" : "text-text-muted/60"
                )}>
                  {activeSetMenus.length} active
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="h-20 bg-bg-card border-b border-white/5 flex items-center px-8 justify-between">
          <div className="flex items-center gap-3">
            {!showSidesAddons && subfolderName && (
              <button
                onClick={() => setSelectedSubfolder(null)}
                className="p-2 text-text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-all"
                title="Back to sections"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {showSidesAddons ? (
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Sides & Add-Ons</h2>
            ) : selectedTopLevel === 'set_menus' ? (
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{topLevelName}</h2>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className={cn(
                  "text-xl font-black uppercase tracking-tight transition-colors",
                  subfolderName ? "text-text-muted" : "text-white"
                )}>
                  {topLevelName}
                </h2>
                {subfolderName && (
                  <>
                    <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">{subfolderName}</h2>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {!showSidesAddons && selectedTopLevel !== 'set_menus' && (
              <div className="relative w-64">
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
            )}
            {showSidesAddons && (
              <>
                <div className="flex items-center gap-1">
                  {(['all', 'sides', 'addons'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setSidesFilter(f)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                        sidesFilter === f
                          ? "bg-brand-primary border-brand-primary text-white"
                          : "bg-white/5 border-white/5 text-text-secondary hover:text-white"
                      )}
                    >
                      {f === 'all' ? 'All' : f === 'sides' ? 'Sides' : 'Add-ons'}
                    </button>
                  ))}
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={sidesSearch}
                    onChange={(e) => setSidesSearch(e.target.value)}
                    placeholder="Search sides and add-ons..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-9 text-white text-sm placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                  />
                  {sidesSearch && (
                    <button onClick={() => setSidesSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-white/5 px-6 py-2 rounded-xl text-text-secondary hover:text-white font-black uppercase tracking-widest text-xs border border-white/10 transition-all disabled:opacity-50"
            >
              <ArrowRight className={cn("w-4 h-4", isSyncing && "animate-spin")} />
              {isSyncing ? 'Syncing...' : 'Sync Hub'}
            </button>
            {!showSidesAddons && !showSubfolderGrid && selectedTopLevel !== 'set_menus' && (
              <button
                onClick={() => setEditingItem({ station: 'grill', priceGross: 0, vatRate: 20, isDrink: false, ingredients: [] })}
                className="flex items-center gap-2 bg-brand-primary px-6 py-2 rounded-xl text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-brand-primary/20"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          {showSidesAddons ? (
            <>
              {sidesAndAddons.length === 0 ? (
                <div className="p-10 border border-dashed border-white/10 rounded-2xl text-center">
                  <p className="text-xs text-text-muted font-black uppercase tracking-widest">No sides or add-ons yet</p>
                  <p className="text-[10px] text-text-muted/70 font-bold uppercase tracking-wider mt-1">Open any menu item's editor and flip the Side or Add-On switch to have it show up here</p>
                </div>
              ) : filteredSidesAndAddons.length === 0 ? (
                <div className="p-10 border border-dashed border-white/10 rounded-2xl text-center">
                  <p className="text-xs text-text-muted font-black uppercase tracking-widest">No results for "{sidesSearch}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-1.5 md:gap-2">
                  {filteredSidesAndAddons.map(item => (
                    <div key={item.id} className="aspect-[1.45/1] bg-bg-card border border-white/5 rounded-lg lg:rounded-xl p-1.5 lg:p-2.5 flex flex-col justify-between group hover:border-white/20 transition-all overflow-hidden shadow-sm">
                      <div>
                        <div className="flex justify-between items-start gap-1 mb-0.5">
                          <h3 className="text-white font-bold text-[10px] lg:text-xs line-clamp-2 uppercase tracking-tight leading-tight">{item.name || 'Unnamed Item'}</h3>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="p-1 text-text-muted hover:text-brand-primary bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <Settings2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-brand-primary font-mono text-[8px] lg:text-[10px] font-bold">£{(item.priceGross / 100).toFixed(2)}</p>
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {item.isSide && (
                            <span className="text-[6px] uppercase font-black tracking-widest bg-brand-primary/10 px-1 py-0.5 rounded text-brand-primary border border-brand-primary/20">Side</span>
                          )}
                          {item.isAddon && (
                            <span className="text-[6px] uppercase font-black tracking-widest bg-emerald-500/10 px-1 py-0.5 rounded text-emerald-400 border border-emerald-500/20">Add-On</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : selectedTopLevel === 'set_menus' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-1.5 md:gap-2">
              {activeSetMenus.map(menu => (
                <button
                  key={menu.id}
                  onClick={() => setPreviewMenu(menu)}
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
          ) : showSubfolderGrid ? (
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-1.5 md:gap-2">
              {currentSubs.map((sub, idx) => {
                const count = getItemCount(sub.id);
                return (
                  <div
                    key={sub.id}
                    className="group relative aspect-[4/3] bg-bg-card border border-white/5 rounded-lg lg:rounded-xl p-2.5 lg:p-3 flex flex-col justify-between hover:border-brand-primary/50 hover:bg-brand-primary/5 transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => handleSubfolderClick(sub.id)}
                      className="flex-1 flex flex-col items-start justify-between text-left"
                    >
                      <span className="bg-brand-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full leading-none">
                        {count}
                      </span>
                      <span className="text-sm font-black text-white uppercase tracking-tight leading-tight group-hover:text-brand-primary transition-colors">
                        {sub.name}
                      </span>
                    </button>
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(sub.id, 'up')}
                        className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        disabled={idx === currentSubs.length - 1}
                        onClick={() => handleMoveCategory(sub.id, 'down')}
                        className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-1.5 md:gap-2">
              {filteredItems.map(item => (
                <div key={item.id} className="aspect-[1.45/1] bg-bg-card border border-white/5 rounded-lg lg:rounded-xl p-1.5 lg:p-2.5 flex flex-col justify-between group hover:border-white/20 transition-all overflow-hidden shadow-sm">
                  <div>
                    <div className="flex justify-between items-start gap-1 mb-0.5">
                      <h3 className="text-white font-bold text-[10px] lg:text-xs line-clamp-2 uppercase tracking-tight leading-tight">{item.name}</h3>
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-1 text-text-muted hover:text-brand-primary bg-white/5 rounded-lg transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0"
                      >
                        <Settings2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-brand-primary font-mono text-[8px] lg:text-[10px] font-bold">£{(item.priceGross / 100).toFixed(2)}</p>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      <span className="text-[6px] uppercase font-black tracking-widest bg-white/5 px-1 py-0.5 rounded text-text-muted border border-white/5">{item.station}</span>
                      {item.ingredients?.slice(0, 3).map(ing => (
                        <span key={ing} className="text-[6px] uppercase font-bold bg-brand-primary/10 text-brand-primary px-1 py-0.5 rounded">{ing}</span>
                      ))}
                    </div>
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

      {previewMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewMenu(null)}
        >
          <div
            className="bg-bg-card border border-white/10 rounded-2xl p-5 w-full max-w-sm flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">
                  {previewMenu.name}
                </h3>
                <p className="text-[10px] text-brand-primary font-bold mt-0.5">
                  £{(previewMenu.pricePerHead / 100).toFixed(2)} per head
                </p>
              </div>
              <button
                onClick={() => setPreviewMenu(null)}
                className="text-text-muted hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {previewMenu.courses.map((course, idx) => (
                <div key={idx}>
                  <span className="text-[8px] font-black uppercase tracking-widest text-brand-primary">
                    {course.name || 'Course'}
                  </span>
                  <div className="mt-1 flex flex-col gap-1">
                    {course.items.map(item => (
                      <div
                        key={item.recipeId}
                        className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-[11px] font-bold text-white uppercase tracking-tight">
                          {item.recipeName}
                        </span>
                        <span className="text-[9px] font-mono text-text-muted">
                          £0.00
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
                {previewMenu.courses.flatMap(c => c.items).length} dishes total
              </span>
              <button
                onClick={() => setPreviewMenu(null)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black text-white uppercase tracking-wider transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

