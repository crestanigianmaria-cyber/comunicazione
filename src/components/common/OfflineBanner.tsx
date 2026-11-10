import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, triggerManualSync } = useOnlineStatus();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 shadow-sm text-xs font-semibold flex items-center justify-between gap-3 border-b border-amber-600 no-print">
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-slate-950 shrink-0 animate-pulse" />
            <span>Modalità Offline: Sei disconnesso dalla rete. Gli ordini vengono salvati in locale in sicurezza.</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
            <span>Ci sono {pendingCount} ordini in sospeso da sincronizzare con il database.</span>
          </>
        )}
      </div>

      {pendingCount > 0 && isOnline && (
        <button
          onClick={triggerManualSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 text-white text-[11px] font-bold hover:bg-slate-800 transition disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Sincronizzazione...' : 'Sincronizza Ora'}</span>
        </button>
      )}
    </div>
  );
};
