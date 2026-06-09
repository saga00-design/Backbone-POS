/**
 * POS Application Configuration
 * This centralizes settings to make HUB management and multi-site scaling easier.
 */
export const POS_CONFIG = {
  // Default location for this terminal. 
  // In a multi-site setup, this would be injected via environment or staff login.
  LOCATION_ID: 'loc_camden',
  
  // Tax & Charges
  SERVICE_CHARGE_RATE: 0.125, // 12.5%
  DEFAULT_VAT_RATE: 20, // 20%
  
  // Feature toggles
  ENABLE_HUB_SYNC: true,
  ENABLE_AUTO_KDS_FIRE: true, // Fire drinks automatically on sent
  
  // Hub File mapping
  HUB_FILES: {
    MENU: 'menu_items.json',
    CATEGORIES: 'categories.json',
    STAFF: 'users.json',
    ZONES: 'zones.json',
    TABLES: 'tables.json',
    BRIEFING: 'shift_briefing.json',
    MODIFIERS: 'modifier_groups.json'
  }
};
