import { useEffect, useState } from 'react';
import { getPendingOrdersCount, syncPendingOrders } from '../services/db';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingOrdersCount());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const updatePending = () => {
      setPendingCount(getPendingOrdersCount());
    };

    const handleOnline = async () => {
      setIsOnline(true);
      updatePending();
      // Auto attempt sync
      if (getPendingOrdersCount() > 0) {
        setIsSyncing(true);
        try {
          await syncPendingOrders();
        } finally {
          setIsSyncing(false);
          updatePending();
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      updatePending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(updatePending, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const triggerManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncPendingOrders();
    } finally {
      setIsSyncing(false);
      setPendingCount(getPendingOrdersCount());
    }
  };

  return {
    isOnline,
    pendingCount,
    isSyncing,
    triggerManualSync,
  };
}
