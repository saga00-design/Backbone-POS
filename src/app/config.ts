/**
 * POS Application Configuration
 * This centralizes settings to make HUB management and multi-site scaling easier.
 */
// Single source of truth (within this repo) for hardcoded bootstrap/fallback
// admin emails. These bypass the normal staffProfiles.role check entirely -
// kept for initial system access before any staff records exist, and as a
// safety net.
//
// IMPORTANT: this is a SEPARATE copy from Backbone Hub's constants.ts
// ADMIN_EMAILS and firestore.rules' isManager() function - since POS is a
// different repo and Firestore rules can't import application code, this
// list must be kept in sync BY HAND across all three if it ever changes.
export const ADMIN_EMAILS = ['saga00@gmail.com', 'famrokha@gmail.com'] as const;

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
