import { useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { usePOSStore } from '../app/store';
import { MenuItemSnapshot, Zone, Table, StaffProfile, POSOrder, ModifierGroup, KDSTicket, UnavailableItem } from '../types/pos';
import { POSTransaction } from '../types/transactions';
import { initializeDatabase } from './seedData';
import { parseFirestoreTimestamp } from './dateUtils';

import { POS_CONFIG } from '../app/config';

export const useFirestoreSync = () => {
  const { 
    setMenuItems, setCategories, setZones, setTables, setStaffList, 
    setAllOrders, setKdsHistory, setModifierGroups, setKdsTickets, 
    setBarKdsTickets, setActiveBriefing, setAcknowledgements, setPOSAlerts,
    setCancelledSessions, setStockMovements, setQuizSubmissions, setAllTransactions,
    setUnavailableItems
  } = usePOSStore();
  const LOCATION_ID = POS_CONFIG.LOCATION_ID;

  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Clear previous listeners if auth changes
      unsubs.forEach(unsub => unsub());
      unsubs = [];

      if (!user) return;

      // Initialize database if needed (only for authenticated users)
      initializeDatabase().catch(console.error);

      // Sync Cancelled Sessions
      const qCancelled = query(collection(db, 'cancelledSessions'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qCancelled, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        setCancelledSessions(sessions.sort((a, b) => b.cancelledAt - a.cancelledAt));
      }, (err) => console.error("Cancelled Sessions Sync Error:", err)));

      // Sync Stock Movements
      const qStock = query(collection(db, 'stockMovements'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qStock, (snapshot) => {
        const movements = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        setStockMovements(movements.sort((a, b) => b.timestamp - a.timestamp));
      }, (err) => console.error("Stock Movements Sync Error:", err)));

      // Sync Quiz Submissions
      const qQuiz = query(collection(db, 'quizSubmissions'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qQuiz, (snapshot) => {
        const subs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        setQuizSubmissions(subs.sort((a, b) => b.completedAt - a.completedAt));
      }, (err) => console.error("Quiz Submissions Sync Error:", err)));

      // Sync Shift Briefings (Latest for location)
      const qBriefing = query(
        collection(db, 'shiftBriefings'),
        where('locationId', '==', LOCATION_ID)
      );
      unsubs.push(onSnapshot(qBriefing, (snapshot) => {
        const briefings = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        // Sort by createdAt DESC to always get the latest one
        const sorted = briefings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        if (sorted.length > 0) {
          setActiveBriefing(sorted[0]);
        } else {
          setActiveBriefing(null);
        }
      }, (err) => console.error("Briefing Sync Error:", err)));

      // Sync Acknowledgements
      const qAcks = query(collection(db, 'briefingAcknowledgements'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qAcks, (snapshot) => {
        const acks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        setAcknowledgements(acks);
      }, (err) => console.error("Acknowledgements Sync Error:", err)));

      // Sync POS Alerts
      const qAlerts = query(
        collection(db, 'posAlerts'),
        where('locationId', '==', LOCATION_ID),
        where('active', '==', true)
      );
      unsubs.push(onSnapshot(qAlerts, (snapshot) => {
        const alerts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        setPOSAlerts(alerts.sort((a, b) => b.createdAt - a.createdAt));
      }, (err) => console.error("POS Alerts Sync Error:", err)));

      // Sync KDS Tickets (Kitchen)
      const qKds = query(
        collection(db, 'kdsTickets'), 
        where('locationId', '==', LOCATION_ID),
        where('status', 'in', ['pending', 'preparing', 'ready'])
      );
      unsubs.push(onSnapshot(qKds, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as KDSTicket));
        setKdsTickets(tickets.sort((a, b) => a.createdAt - b.createdAt));
      }, (err) => console.error("KDS Kitchen Sync Error:", err)));

      // Sync KDS Tickets (Bar)
      const qBar = query(
        collection(db, 'barKdsTickets'), 
        where('locationId', '==', LOCATION_ID),
        where('status', 'in', ['pending', 'preparing', 'ready'])
      );
      unsubs.push(onSnapshot(qBar, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as KDSTicket));
        setBarKdsTickets(tickets.sort((a, b) => a.createdAt - b.createdAt));
      }, (err) => console.error("KDS Bar Sync Error:", err)));

      // Sync Modifier Groups
      const qModGroups = query(collection(db, 'modifierGroups'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qModGroups, (snapshot) => {
        const groups = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ModifierGroup));
        setModifierGroups(groups);
      }, (err) => console.error("Modifier Groups Sync Error:", err)));

      // Sync Orders (for reporting)
      const qOrders = query(collection(db, 'posOrders'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qOrders, (snapshot) => {
        const orders = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            ...data, 
            id: doc.id,
            createdAt: parseFirestoreTimestamp(data.createdAt) || Date.now(),
            paidAt: parseFirestoreTimestamp(data.paidAt) ?? undefined,
            seatedAt: parseFirestoreTimestamp(data.seatedAt) ?? undefined,
            lastOrderedAt: parseFirestoreTimestamp(data.lastOrderedAt) ?? undefined,
            items: (data.items || []).map((item: any) => ({
              ...item,
              firedAt: parseFirestoreTimestamp(item.firedAt) ?? undefined,
              sentAt: parseFirestoreTimestamp(item.sentAt) ?? undefined,
            }))
          } as POSOrder;
        });
        setAllOrders(orders);
      }, (err) => console.error("Orders Sync Error:", err)));

      // Sync Transactions (for archive and audit log)
      const qTransactions = query(
        collection(db, 'posTransactions'), 
        where('businessId', '==', 'biz_backbone'),
        where('siteId', '==', LOCATION_ID)
      );
      unsubs.push(onSnapshot(qTransactions, (snapshot) => {
        const transactions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: parseFirestoreTimestamp(data.createdAt) || Date.now(),
            paidAt: parseFirestoreTimestamp(data.paidAt) || Date.now(),
            correctedAt: parseFirestoreTimestamp(data.correctedAt) ?? undefined,
            refundedAt: parseFirestoreTimestamp(data.refundedAt) ?? undefined,
            voidedAt: parseFirestoreTimestamp(data.voidedAt) ?? undefined,
          } as POSTransaction;
        });
        setAllTransactions(transactions.sort((a, b) => b.createdAt - a.createdAt));
      }, (err) => console.error("Transactions Sync Error:", err)));

      // Sync Users
      const qUsers = query(collection(db, 'staffProfiles'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qUsers, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StaffProfile));
        setStaffList(users);
      }, (err) => console.error("Users Sync Error:", err)));

      // Sync Categories
      const qCat = query(collection(db, 'menuCategories'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qCat, (snapshot) => {
        const categories = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        const sorted = categories.sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : 999;
          const orderB = typeof b.order === 'number' ? b.order : 999;
          if (orderA !== orderB) return orderA - orderB;
          return a.id.localeCompare(b.id);
        });
        setCategories(sorted);
      }, (err) => console.error("Categories Sync Error:", err)));

      // Sync Menu Items
      const qItems = query(collection(db, 'menuItems'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qItems, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MenuItemSnapshot));
        setMenuItems(items);
      }, (err) => console.error("Items Sync Error:", err)));

      // Sync Unavailable Items (86s and low stock — live from HUB)
      const qUnavailable = query(collection(db, 'unavailableItems'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qUnavailable, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as UnavailableItem));
        setUnavailableItems(items);
      }, (err) => console.error("Unavailable Items Sync Error:", err)));

      // Sync Tables
      const qTables = query(collection(db, 'tables'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qTables, (snapshot) => {
        const tables = snapshot.docs.map(doc => {
          const data = doc.data();
          return { 
            ...data, 
            id: doc.id,
            seatedAt: parseFirestoreTimestamp(data.seatedAt) ?? undefined
          } as Table;
        });
        setTables(tables);
      }, (err) => console.error("Tables Sync Error:", err)));

      // Sync Zones
      const qZones = query(collection(db, 'zones'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qZones, (snapshot) => {
        const zones = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Zone));
        setZones(zones);
      }, (err) => console.error("Zones Sync Error:", err)));

      // Sync KDS History
      const qKdsHistory = query(collection(db, 'kdsHistory'), where('locationId', '==', LOCATION_ID));
      unsubs.push(onSnapshot(qKdsHistory, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
        setKdsHistory(history.sort((a, b) => b.bumpedAt - a.bumpedAt));
      }, (err) => console.error("KDS History Sync Error:", err)));
    });

    return () => {
      unsubAuth();
      unsubs.forEach(unsub => unsub());
    };
  }, [setMenuItems, setCategories, setZones, setTables, setStaffList, setAllOrders, setAllTransactions, setUnavailableItems]);
};
