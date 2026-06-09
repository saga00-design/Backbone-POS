import { POSOrder, POSOrderItem, Course, MenuItemSnapshot } from '../types/pos';

export interface Suggestion {
  id: string;
  itemId: string;
  name: string;
  price: number;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  stage: TableStage;
}

export type TableStage = 'WELCOME' | 'DRINKS_ONLY' | 'STARTERS' | 'MAINS' | 'DESSERTS' | 'CHECKOUT';

export const detectTableStage = (order: POSOrder | null): TableStage => {
  if (!order || order.items.length === 0) return 'WELCOME';
  
  const items = order.items.filter(i => i.status !== 'voided');
  const hasDrinks = items.some(i => i.snapshot.isDrink);
  const hasStarters = items.some(i => i.course === 'starters');
  const hasMains = items.some(i => i.course === 'mains');
  const hasDesserts = items.some(i => i.course === 'desserts');

  const allMainsServed = hasMains && items.filter(i => i.course === 'mains').every(i => i.status === 'served');

  if (allMainsServed && !hasDesserts) return 'DESSERTS';
  if (hasMains) return 'MAINS';
  if (hasStarters) return 'STARTERS';
  if (hasDrinks) return 'DRINKS_ONLY';
  return 'WELCOME';
};

export const getSuggestions = (
  order: POSOrder | null, 
  menuItems: MenuItemSnapshot[]
): Suggestion[] => {
  const stage = detectTableStage(order);
  const suggestions: Suggestion[] = [];
  
  // Helper to find high margin items in a category (by name or ID)
  const getHighMarginItems = (keywords: string[], limit: number = 2) => {
    return menuItems
      .filter(item => {
        const catId = item.categoryId.toLowerCase();
        const itemName = item.name.toLowerCase();
        // Match if category ID or item name contains any of the keywords
        return keywords.some(kw => catId.includes(kw.toLowerCase()) || itemName.includes(kw.toLowerCase()));
      })
      .sort((a, b) => {
        const marginA = a.priceGross - (a.cost || 0);
        const marginB = b.priceGross - (b.cost || 0);
        return marginB - marginA;
      })
      .slice(0, limit);
  };

  const existingItemIds = new Set((order?.items || []).map(i => i.menuItemId));

  const suggestedItemIds = new Set<string>();

  const addToSuggestions = (items: MenuItemSnapshot[], reason: string, priority: Suggestion['priority']) => {
    items.forEach(item => {
      if (!existingItemIds.has(item.id) && !suggestedItemIds.has(item.id) && suggestions.length < 3) {
        suggestedItemIds.add(item.id);
        suggestions.push({
          id: `sug-${item.id}`,
          itemId: item.id,
          name: item.name,
          price: item.priceGross,
          reason,
          priority,
          stage
        });
      }
    });
  };

  switch (stage) {
    case 'WELCOME':
      addToSuggestions(getHighMarginItems(['cocktail', 'drink', 'beverage', 'aperitif', 'gin', 'wine']), 'Perfect start to the evening', 'high');
      break;

    case 'DRINKS_ONLY':
      addToSuggestions(getHighMarginItems(['starter', 'appetizer', 'entry', 'snack', 'sharing']), 'Great to share while drinking', 'medium');
      break;

    case 'STARTERS':
      addToSuggestions(getHighMarginItems(['wine', 'water', 'premium', 'special'], 1), 'Pairs beautifully with starters', 'medium');
      break;

    case 'MAINS':
      addToSuggestions(getHighMarginItems(['side', 'extra', 'add', 'portion']), 'Highly recommended with mains', 'high');
      break;

    case 'DESSERTS':
      addToSuggestions(getHighMarginItems(['dessert', 'sweet', 'coffee', 'digestif', 'after']), 'Sweeten the end of the meal', 'high');
      break;
  }

  // Fallback: If still no suggestions, just pick highest margin items from anywhere
  if (suggestions.length < 2) {
    const fallbackItems = menuItems
      .sort((a, b) => (b.priceGross - (b.cost || 0)) - (a.priceGross - (a.cost || 0)))
      .slice(0, 5);
    addToSuggestions(fallbackItems, 'Chef\'s recommendation', 'medium');
  }

  return suggestions.slice(0, 3); // Max 3 suggestions as per rules
};
