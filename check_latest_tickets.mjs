// One-off diagnostic script — reads the 3 most recent tickets from
// kdsTickets (kitchen) and barKdsTickets (bar) so course/status/routing
// can be inspected directly against what's in Firestore.
//
// Uses the same Firebase web config + named Firestore database as the
// app itself (src/lib/firebase.ts): database ID
// ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403.
//
// This is read-only and does not modify any data.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const firebaseConfig = JSON.parse(
  readFileSync(join(__dirname, 'firebase-applet-config.json'), 'utf-8')
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

function formatTicket(docSnap, index) {
  const data = docSnap.data();
  const createdAt = typeof data.createdAt === 'number'
    ? new Date(data.createdAt).toLocaleString()
    : 'unknown';

  const items = Array.isArray(data.items) ? data.items : [];

  const lines = [];
  lines.push(`--- #${index} ---`);
  lines.push(`  Ticket ID:  ${docSnap.id}`);
  lines.push(`  Created:    ${createdAt}`);
  lines.push(`  Table ID:   ${data.tableId ?? 'n/a'}`);
  lines.push(`  Status:     ${data.status ?? 'n/a'}`);
  lines.push(`  Items (${items.length}):`);

  if (items.length === 0) {
    lines.push('    (none)');
  } else {
    items.forEach((item, idx) => {
      lines.push(
        `    ${idx + 1}. name="${item.name ?? 'n/a'}" ` +
        `course=${item.course ?? 'n/a'} ` +
        `status=${item.status ?? 'n/a'} ` +
        `parentOrderItemUuid=${item.parentOrderItemUuid ?? 'none'}`
      );
    });
  }

  return lines.join('\n');
}

async function printLatestTickets(collectionName, label) {
  console.log(`\n=== ${label} (last 3) ===`);

  const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'), limit(3));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.log('  (no tickets found)');
    return;
  }

  snap.docs.forEach((docSnap, idx) => {
    console.log('\n' + formatTicket(docSnap, idx + 1));
  });
}

async function main() {
  try {
    await signInAnonymously(auth);
  } catch (err) {
    console.error('Failed to authenticate with Firebase:', err.message);
    console.error(
      'kdsTickets/barKdsTickets require an authenticated request (see firestore.rules).\n' +
      'If anonymous sign-in is disabled for this project, enable it in the ' +
      'Firebase Console under Authentication > Sign-in method, or adapt this ' +
      'script to sign in with a real staff account instead.'
    );
    process.exit(1);
  }

  await printLatestTickets('kdsTickets', 'KITCHEN KDS');
  await printLatestTickets('barKdsTickets', 'BAR KDS');

  process.exit(0);
}

main().catch(err => {
  console.error('Diagnostic script failed:', err);
  process.exit(1);
});
