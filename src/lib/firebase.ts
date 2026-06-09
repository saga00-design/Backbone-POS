import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable Offline Persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled
        // in one tab at a a time.
        console.warn('Firestore persistence failed-precondition (multiple tabs open?)');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
        console.warn('Firestore persistence unimplemented in this browser');
    }
});

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Test connection to Firestore
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
async function testConnection() {
  try {
    // Try to get a non-existent doc to test connectivity
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    console.log("Firestore connection successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore Error: The client is offline. Please check your Firebase configuration and project ID.");
    } else {
      console.warn("Firestore connection test warning (expected if rules deny):", error);
    }
  }
}
testConnection();
