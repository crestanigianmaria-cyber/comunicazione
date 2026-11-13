import { useCallback, useEffect, useState } from 'react';
import { getPendingOrdersCount, syncPendingOrders } from '../services/db';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingOrdersCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncPendingOrders();
      setPendingCount(result.remaining);
      if (result.errors.length > 0) {
        setSyncMessage(result.errors.slice(0, 2).join(' • '));
      } else if (result.synced > 0) {
        setSyncMessage(`Sincronizzazione completata: ${result.synced} ordini inviati correttamente.`);
      } else {
        setSyncMessage(result.remaining > 0
          ? 'Connessione disponibile, ma non è stato possibile completare la sincronizzazione. Gli ordini sono ancora al sicuro sul dispositivo.'
          : null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSyncMessage(`Sincronizzazione non riuscita: ${message}. Gli ordini restano salvati sul dispositivo.`);
      setPendingCount(getPendingOrdersCount());
    } finally {
      setIsSyncing(false);
      setPendingCount(getPendingOrdersCount());
    }
  }, []);

  useEffect(() => {
    const updatePending = () => setPendingCount(getPendingOrdersCount());

    const handleOnline = () => {
      setIsOnline(true);
      updatePending();
      void runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updatePending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Retry on startup and periodically: a browser "online" event does not
    // guarantee that Supabase is already reachable.
    if (navigator.onLine && getPendingOrdersCount() > 0) void runSync();

    const interval = window.setInterval(() => {
      updatePending();
      if (navigator.onLine && getPendingOrdersCount() > 0) void runSync();
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [runSync]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncMessage,
    triggerManualSync: runSync,
  };
}
