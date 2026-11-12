import React from 'react';
import { Volume2, VolumeX, LogOut, ArrowRightLeft, Bell } from 'lucide-react';
import { UserRole, CompanySettings } from '../../types';
import { PWAInstallButton } from './PWAInstallButton';
import { isSoundEnabled, setSoundEnabled } from '../../lib/audio';

interface HeaderProps {
  currentRole: UserRole | null;
  activeView: 'magazzino' | 'magazzino_storico' | 'ufficio_dashboard' | 'ufficio_storico' | 'ufficio_cestino' | 'ufficio_catalogo' | 'ufficio_impostazioni';
  onNavigate: (view: 'magazzino' | 'magazzino_storico' | 'ufficio_dashboard' | 'ufficio_storico' | 'ufficio_cestino' | 'ufficio_catalogo' | 'ufficio_impostazioni') => void;
  onLogout: () => void;
  onSwitchRole: () => void;
  companySettings: CompanySettings;
  isOnline: boolean;
  notificationPermission: NotificationPermission;
  onEnableNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  activeView,
  onNavigate,
  onLogout,
  onSwitchRole,
  companySettings,
  isOnline,
  notificationPermission,
  onEnableNotifications,
}) => {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white select-none no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Single Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-[4.25rem] rounded-lg bg-white border border-white/80 shadow-sm flex items-center justify-center p-1 overflow-hidden">
            <img
              src="/saggin-logo.png"
              alt="Logo Saggin"
              className="h-full w-full object-contain"
              width="68"
              height="38"
              decoding="async"
            />
          </div>
          <span className="font-extrabold tracking-tight text-sm sm:text-base text-white whitespace-nowrap">
            {companySettings.companyName || 'MAGAZZINO EDILE'}
          </span>
          <span className="hidden sm:inline text-xs text-slate-400 font-medium">· WMS</span>
        </div>

        {/* Zone 2: Navigation Links (When logged in as Office or switching views) */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
          {currentRole === 'ufficio' && (
            <>
              <button
                onClick={() => onNavigate('ufficio_dashboard')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  activeView === 'ufficio_dashboard'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dashboard Ordini
              </button>
              <button
                onClick={() => onNavigate('ufficio_storico')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  activeView === 'ufficio_storico'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Storico Completo
              </button>
              <button
                onClick={() => onNavigate('ufficio_cestino')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  activeView === 'ufficio_cestino' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cestino
              </button>
              <button
                onClick={() => onNavigate('ufficio_catalogo')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  activeView === 'ufficio_catalogo'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Catalogo Excel
              </button>
              <button
                onClick={() => onNavigate('ufficio_impostazioni')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  activeView === 'ufficio_impostazioni'
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Impostazioni & Supabase
              </button>
            </>
          )}

          {currentRole === 'magazzino' && (
            <>
              <button
                onClick={() => onNavigate('magazzino')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${activeView === 'magazzino' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >Ordine</button>
              <button
                onClick={() => onNavigate('magazzino_storico')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${activeView === 'magazzino_storico' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >Storico ordini</button>
            </>
          )}
        </nav>

        {/* Zone 3: Primary Action & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connection status indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium ${
              isOnline ? 'text-emerald-400 bg-emerald-950/50' : 'text-amber-400 bg-amber-950/50'
            }`}
            title={isOnline ? 'Connesso al database in tempo reale' : 'Disconnesso - Operazioni in locale'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {currentRole === 'ufficio' && (
            <button
              onClick={onEnableNotifications}
              disabled={notificationPermission !== 'default'}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                notificationPermission === 'granted'
                  ? 'text-emerald-300 bg-emerald-950/50 cursor-default'
                  : notificationPermission === 'denied'
                  ? 'text-amber-300 bg-amber-950/50 cursor-not-allowed'
                  : 'text-blue-200 bg-blue-950/50 hover:bg-blue-900'
              }`}
              title={
                notificationPermission === 'granted'
                  ? 'Notifiche desktop attive'
                  : notificationPermission === 'denied'
                  ? 'Notifiche bloccate dal browser: abilitarle nelle impostazioni del sito'
                  : 'Attiva le notifiche desktop per i nuovi ordini'
              }
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">
                {notificationPermission === 'granted'
                  ? 'Notifiche attive'
                  : notificationPermission === 'denied'
                  ? 'Notifiche bloccate'
                  : 'Attiva notifiche'}
              </span>
            </button>
          )}

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleSound}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={soundOn ? 'Notifiche audio attive (disattiva)' : 'Notifiche audio disattivate (attiva)'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Role badge / Switcher */}
          {currentRole && (
            <button
              onClick={onSwitchRole}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              title="Cambia Ruolo (Magazzino / Ufficio)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
              <span className="capitalize">{currentRole}</span>
            </button>
          )}

          {currentRole && (
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
              title="Disconnetti"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {currentRole === 'magazzino' && (
        <div className="md:hidden max-w-7xl mx-auto px-4 pb-2 flex gap-2">
          <button
            onClick={() => onNavigate('magazzino')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold ${activeView === 'magazzino' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >Nuovo ordine</button>
          <button
            onClick={() => onNavigate('magazzino_storico')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold ${activeView === 'magazzino_storico' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >Storico ordini</button>
        </div>
      )}
    </header>
  );
};
