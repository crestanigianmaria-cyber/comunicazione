import React from 'react';
import { Package, Volume2, VolumeX, LogOut, ArrowRightLeft } from 'lucide-react';
import { UserRole, CompanySettings } from '../../types';
import { PWAInstallButton } from './PWAInstallButton';
import { isSoundEnabled, setSoundEnabled } from '../../lib/audio';

interface HeaderProps {
  currentRole: UserRole | null;
  activeView: 'magazzino' | 'ufficio_dashboard' | 'ufficio_storico' | 'ufficio_catalogo' | 'ufficio_impostazioni';
  onNavigate: (view: 'magazzino' | 'ufficio_dashboard' | 'ufficio_storico' | 'ufficio_catalogo' | 'ufficio_impostazioni') => void;
  onLogout: () => void;
  onSwitchRole: () => void;
  companySettings: CompanySettings;
  isOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  activeView,
  onNavigate,
  onLogout,
  onSwitchRole,
  companySettings,
  isOnline,
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
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Package className="w-4 h-4 stroke-[2.5]" />
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
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
              Interfaccia Operatore Magazzino
            </span>
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
    </header>
  );
};
