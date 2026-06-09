import { useEffect, useRef } from 'react';
import { usePOSStore, ServerAlert } from '../app/store';
import { playOrderReadySound, playWarningSound } from './notifications';

const THRESHOLDS = {
  DRINKS: 4 * 60000,
  STARTERS: 12 * 60000,
  MAINS: 20 * 60000,
  PACING: 15 * 60000
};

export const usePacingMonitor = () => {
  const { kdsTickets, barKdsTickets, allOrders, tables, activeAlerts, currentStaff } = usePOSStore();
  const prevAlertCount = useRef(0);

  useEffect(() => {
    const checkAlerts = () => {
      const now = Date.now();
      const newAlerts: ServerAlert[] = [];

      allOrders.forEach(order => {
        if (order.status !== 'sent' && order.status !== 'open') return;
        
        const table = tables.find(t => t.currentOrderId === order.id);
        if (!table) return;

        const orderTickets = [...kdsTickets, ...barKdsTickets].filter(t => t.orderId === order.id);
        const isReady = orderTickets.length > 0 && orderTickets.every(t => t.status === 'ready');

        // 1. Ready to Serve Alert
        if (isReady) {
          const alertId = `ready-${order.id}`;
          if (!activeAlerts.some(a => a.id === alertId)) {
            newAlerts.push({
              id: alertId,
              type: 'READY',
              message: `Order for ${table.name} is READY`,
              tableId: table.id,
              tableName: table.name,
              orderId: order.id,
              createdAt: now
            });
          }
        }

        // 2. Delay Alerts
        orderTickets.forEach(ticket => {
          if (ticket.status === 'pending' || ticket.status === 'preparing') {
             const elapsed = now - ticket.createdAt;
             
             // Drinks Delay
             if (ticket.station === 'bar' && elapsed > THRESHOLDS.DRINKS) {
                const alertId = `delay-drinks-${order.id}`;
                if (!activeAlerts.some(a => a.id === alertId)) {
                   newAlerts.push({
                      id: alertId,
                      type: 'DELAY_DRINKS',
                      message: `DRINK DELAY: ${table.name} (${Math.floor(elapsed/60000)}m)`,
                      tableId: table.id,
                      tableName: table.name,
                      orderId: order.id,
                      createdAt: now
                   });
                }
             }

             // Food Delay (Starters or Mains)
             const hasStarters = ticket.items.some(i => i.course === 'starters');
             if (ticket.station === 'kitchen' && elapsed > (hasStarters ? THRESHOLDS.STARTERS : THRESHOLDS.MAINS)) {
                const alertId = `delay-food-${order.id}`;
                if (!activeAlerts.some(a => a.id === alertId)) {
                   newAlerts.push({
                      id: alertId,
                      type: 'DELAY_FOOD',
                      message: `FOOD DELAY: ${table.name} (${Math.floor(elapsed/60000)}m)`,
                      tableId: table.id,
                      tableName: table.name,
                      orderId: order.id,
                      createdAt: now
                   });
                }
             }
          }
        });

        // 3. Pacing Alert (Waiters should fire next course)
        if (order.lastCourseAt && (now - order.lastCourseAt) > THRESHOLDS.PACING) {
           const hasHeldItems = order.items.some(i => i.status === 'held');
           if (hasHeldItems) {
               const alertId = `pacing-${order.id}`;
               if (!activeAlerts.some(a => a.id === alertId)) {
                  newAlerts.push({
                     id: alertId,
                     type: 'PACING',
                     message: `PACING: Check Table ${table.name} for next course`,
                     tableId: table.id,
                     tableName: table.name,
                     orderId: order.id,
                     createdAt: now
                  });
               }
           }
        }
      });

      if (newAlerts.length > 0) {
        usePOSStore.setState(state => ({
           activeAlerts: [...state.activeAlerts, ...newAlerts]
        }));
      }
    };

    const interval = setInterval(checkAlerts, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [kdsTickets, barKdsTickets, allOrders, tables, activeAlerts]);

  // Handle sounds/vibrations on new alerts
  useEffect(() => {
    if (activeAlerts.length > prevAlertCount.current) {
        const latestAlert = activeAlerts[activeAlerts.length - 1];
        if (latestAlert.type === 'READY') {
            playOrderReadySound();
        } else {
            playWarningSound();
        }
    }
    prevAlertCount.current = activeAlerts.length;
  }, [activeAlerts]);
};
