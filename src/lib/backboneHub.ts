import { storage } from './firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { StaffProfile, Zone, Table, ShiftBriefing } from '../types/pos';
import { POS_CONFIG } from '../app/config';
import firebaseConfig from '../../firebase-applet-config.json';

// This service handles fetching data from the external "backbone-hub"
// We use the project's own storage bucket as the default hub location.
const HUB_BUCKET = firebaseConfig.storageBucket;

export const fetchHubData = async <T>(fileName: string): Promise<T | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Resolve an authorized download URL via the Storage SDK (includes the
    // access token) instead of guessing an unauthenticated media URL, which
    // Firebase Storage rejects and previously caused every sync to silently
    // fall back to the bundled local seed data.
    let downloadUrl: string;
    try {
      downloadUrl = await getDownloadURL(ref(storage, fileName));
    } catch (resolveError: any) {
      // Fallback to camelCase if snake_case file doesn't exist for menu_items
      if (fileName === 'menu_items.json') {
        console.log(`${fileName} not found, retrying with menuItems.json...`);
        downloadUrl = await getDownloadURL(ref(storage, 'menuItems.json'));
      } else {
        throw resolveError;
      }
    }

    console.log(`Fetching ${fileName} from hub (${HUB_BUCKET})...`);
    const response = await fetch(`${downloadUrl}&t=${Date.now()}`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
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
  users: StaffProfile[];
  zones: Zone[];
  tables: Table[];
  briefing: ShiftBriefing | null;
}

// menuCategories/menuItems are intentionally NOT fetched here. They're kept
// live via the Firestore listener in useFirestoreSync.ts, and fetching them
// from a Storage JSON snapshot was unreliable (CORS) and, on failure, silently
// overwrote real Hub data with stale bundled seed data. This sync is scoped to
// its original purpose: staff/zones/tables/briefing.
export const syncAllFromHub = async () => {
  const users = await fetchHubData<StaffProfile[]>(POS_CONFIG.HUB_FILES.STAFF);
  const zones = await fetchHubData<Zone[]>(POS_CONFIG.HUB_FILES.ZONES);
  const tables = await fetchHubData<Table[]>(POS_CONFIG.HUB_FILES.TABLES);
  const briefing = await fetchHubData<ShiftBriefing>(POS_CONFIG.HUB_FILES.BRIEFING);

  return { users, zones, tables, briefing };
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
