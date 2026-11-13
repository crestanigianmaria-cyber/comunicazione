import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, syncMessage, triggerManualSync } = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // If the queue changes, surface the alert again. Hiding the banner never
  // deletes or modifies queued orders; background retries continue.
  useEffect(() => {
    setDismissed(false);
  }, [pendingCount]);

  if (dismissed || (isOnline && pendingCount === 0)) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 shadow-sm text-xs font-semibold flex items-center justify-between gap-3 border-b border-amber-600 no-print">
      <div className="flex items-center gap-2 min-w-0">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-slate-950 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <span>Modalità Offline: connessione assente. Gli ordini restano salvati sul dispositivo.</span>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
            <div className="min-w-0">
              <span>{pendingCount} {pendingCount === 1 ? 'ordine in sospeso' : 'ordini in sospeso'} da sincronizzare.</span>
              {syncMessage && <p className="font-medium mt-0.5 break-words">{syncMessage}</p>}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {pendingCount > 0 && isOnline && (
          <button
            onClick={() => void triggerManualSync()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 text-white text-[11px] font-bold hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizzazione...' : 'Riprova ora'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Nascondi avviso; gli ordini restano in coda"
          title="Nascondi avviso senza eliminare gli ordini"
          className="p-1 rounded hover:bg-amber-600/40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
