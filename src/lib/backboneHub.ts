import { storage } from './firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { MenuItemSnapshot, StaffProfile, Zone, Table, ModifierGroup, ShiftBriefing } from '../types/pos';
import { POS_CONFIG } from '../app/config';
import firebaseConfig from '../../firebase-applet-config.json';

// This service handles fetching data from the external "backbone-hub"
// We use the project's own storage bucket as the default hub location.
const HUB_BUCKET = firebaseConfig.storageBucket;

export const fetchHubData = async <T>(fileName: string): Promise<T | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Try primary filename with cache buster
    let url = `https://firebasestorage.googleapis.com/v0/b/${HUB_BUCKET}/o/${encodeURIComponent(fileName)}?alt=media&t=${Date.now()}`;
    console.log(`Fetching ${fileName} from hub (${HUB_BUCKET})...`);
    let response = await fetch(url, { signal: controller.signal });

    // Fallback to camelCase if snake_case fails for menu_items
    if (!response.ok && fileName === 'menu_items.json') {
      const fallbackName = 'menuItems.json';
      console.log(`Retrying with ${fallbackName}...`);
      url = `https://firebasestorage.googleapis.com/v0/b/${HUB_BUCKET}/o/${encodeURIComponent(fallbackName)}?alt=media&t=${Date.now()}`;
      response = await fetch(url, { signal: controller.signal });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Hub fetch warning for ${fileName}: ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    console.log(`Successfully fetched ${fileName} from hub.`);
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`Error fetching ${fileName} from hub:`, error);
    return null;
  }
};

export interface HubData {
  menuItems: MenuItemSnapshot[];
  categories: { id: string; name: string; order: number }[];
  modifierGroups: ModifierGroup[];
  users: StaffProfile[];
  zones: Zone[];
  tables: Table[];
  briefing: ShiftBriefing | null;
}

export const syncAllFromHub = async () => {
  const menuItems = await fetchHubData<MenuItemSnapshot[]>(POS_CONFIG.HUB_FILES.MENU);
  const categories = await fetchHubData<{ id: string; name: string; order: number }[]>(POS_CONFIG.HUB_FILES.CATEGORIES);
  const modifierGroups = await fetchHubData<ModifierGroup[]>(POS_CONFIG.HUB_FILES.MODIFIERS);
  const users = await fetchHubData<StaffProfile[]>(POS_CONFIG.HUB_FILES.STAFF);
  const zones = await fetchHubData<Zone[]>(POS_CONFIG.HUB_FILES.ZONES);
  const tables = await fetchHubData<Table[]>(POS_CONFIG.HUB_FILES.TABLES);
  const briefing = await fetchHubData<ShiftBriefing>(POS_CONFIG.HUB_FILES.BRIEFING);
  
  return { menuItems, categories, modifierGroups, users, zones, tables, briefing };
};

/**
 * Uploads data back to the hub bucket
 */
export const uploadHubData = async (fileName: string, data: any): Promise<boolean> => {
  try {
    const { uploadString } = await import('firebase/storage');
    const storageRef = ref(storage, fileName);
    const jsonString = JSON.stringify(data, null, 2);
    await uploadString(storageRef, jsonString, 'raw', {
      contentType: 'application/json',
    });
    console.log(`Successfully uploaded ${fileName} to hub.`);
    return true;
  } catch (error) {
    console.error(`Error uploading ${fileName} to hub:`, error);
    return false;
  }
};
