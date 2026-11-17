import React from 'react';
import {
  Volume2,
  VolumeX,
  LogOut,
  ArrowRightLeft,
  Bell,
  LayoutDashboard,
  History,
  Trash2,
  FileSpreadsheet,
  Settings,
  PlusCircle,
  ClipboardList
} from 'lucide-react';
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
  newOrdersCount: number;
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
  newOrdersCount,
}) => {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f19] border-b border-slate-800 text-white select-none no-print shadow-sm pt-safe">
      {/* Top 2px Saggin Corporate Accent Bar */}
      <div className="h-0.5 w-full bg-red-600" />

      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 min-h-14 py-1.5 flex items-center justify-between gap-2">
        {/* Zone 1: Brand Identity & Active Terminal Badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-15 sm:h-10 sm:w-[4.5rem] rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 overflow-hidden shrink-0">
            <img
              src="/saggin-logo.png"
              alt="Logo Saggin"
              className="h-full w-full object-contain"
              width="72"
              height="40"
              decoding="async"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold tracking-tight text-sm sm:text-base text-white truncate leading-tight">
                {companySettings.companyName || 'SAGGIN'}
              </span>
              <span className={`hidden sm:inline-flex text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                currentRole === 'magazzino'
                  ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}>
                {currentRole === 'magazzino' ? 'TERMINALE PIAZZALE' : 'ERP UFFICIO'}
              </span>
            </div>
            {/* Mobile compact subtitle + live status dot */}
            <div className="flex sm:hidden items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 truncate">
                {currentRole === 'magazzino' ? 'Magazzino' : 'Ufficio'} · {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <span className="hidden sm:inline text-[11px] text-slate-400 font-medium leading-tight mt-0.5 truncate">
              Saggin Guglielmo S.R.L. · Gestione Ordini & Logistica
            </span>
          </div>
        </div>

        {/* Zone 2: Desktop / Landscape Tablet Navigation */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {currentRole === 'ufficio' && (
            <>
              <button
                onClick={() => onNavigate('ufficio_dashboard')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeView === 'ufficio_dashboard'
                    ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard Ordini</span>
                {newOrdersCount > 0 && (
                  <span className="inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-mono font-black animate-pulse">
                    {newOrdersCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => onNavigate('ufficio_storico')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeView === 'ufficio_storico'
                    ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Archivio Storico</span>
              </button>
              <button
                onClick={() => onNavigate('ufficio_catalogo')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeView === 'ufficio_catalogo'
                    ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Listino & Excel</span>
              </button>
              <button
                onClick={() => onNavigate('ufficio_cestino')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeView === 'ufficio_cestino'
                    ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cestino</span>
              </button>
              <button
                onClick={() => onNavigate('ufficio_impostazioni')}
                className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeView === 'ufficio_impostazioni'
                    ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Impostazioni</span>
              </button>
            </>
          )}

          {currentRole === 'magazzino' && (
            <>
              <button
                onClick={() => onNavigate('magazzino')}
                className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeView === 'magazzino'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuovo Carico</span>
              </button>
              <button
                onClick={() => onNavigate('magazzino_storico')}
                className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeView === 'magazzino_storico'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Storico Invii</span>
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: System Status & Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Connection status badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
              isOnline
                ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
                : 'text-amber-400 bg-amber-950/40 border-amber-800/50'
            }`}
            title={isOnline ? 'Connesso a Supabase Realtime' : 'Modalità Offline - Salvataggio locale attivo'}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span>{isOnline ? 'SYNC ATTIVO' : 'OFFLINE'}</span>
          </div>

          {currentRole === 'ufficio' && newOrdersCount > 0 && (
            <button
              onClick={() => onNavigate('ufficio_dashboard')}
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-md shadow-red-600/25 animate-pulse"
              title="Visualizza nuovi ordini dal magazzino"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">NUOVI</span>
              <span className="min-w-5 h-5 rounded-full bg-white text-red-700 font-mono inline-flex items-center justify-center px-1 text-[11px]">
                {newOrdersCount}
              </span>
            </button>
          )}

          {currentRole === 'ufficio' && (
            <button
              onClick={onEnableNotifications}
              disabled={notificationPermission !== 'default'}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                notificationPermission === 'granted'
                  ? 'text-slate-300 bg-slate-900 border-slate-800 cursor-default'
                  : notificationPermission === 'denied'
                  ? 'text-amber-400 bg-amber-950/30 border-amber-800/40 cursor-not-allowed'
                  : 'text-white bg-slate-800 border-slate-700 hover:bg-slate-700'
              }`}
              title={
                notificationPermission === 'granted'
                  ? 'Notifiche desktop attive'
                  : notificationPermission === 'denied'
                  ? 'Notifiche bloccate dal browser'
                  : 'Attiva le notifiche desktop per i nuovi ordini'
              }
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {notificationPermission === 'granted'
                  ? 'Avvisi On'
                  : notificationPermission === 'denied'
                  ? 'Avvisi Bloccati'
                  : 'Attiva Avvisi'}
              </span>
            </button>
          )}

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg border transition touch-manipulation ${
              soundOn
                ? 'text-white bg-slate-900 border-slate-800 hover:bg-slate-800'
                : 'text-slate-500 bg-slate-900/50 border-slate-800/50 hover:text-slate-300'
            }`}
            title={soundOn ? 'Audio notifiche attivo (clicca per mutare)' : 'Audio notifiche disattivato (clicca per attivare)'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Role Switcher */}
          {currentRole && (
            <button
              onClick={onSwitchRole}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold transition touch-manipulation"
              title="Cambia Postazione (Magazzino / Ufficio)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-red-400" />
              <span className="capitalize hidden sm:inline">{currentRole}</span>
            </button>
          )}

          {currentRole && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition touch-manipulation"
              title="Disconnetti sessione"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation bar for Mobile & Portrait Tablets (< 1024px) */}
      {currentRole === 'magazzino' && (
        <div className="lg:hidden border-t border-slate-800/80 bg-slate-950/90 px-3 py-2">
          <div className="max-w-3xl mx-auto grid grid-cols-2 gap-2">
            <button
              onClick={() => onNavigate('magazzino')}
              className={`min-h-[42px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition touch-manipulation ${
                activeView === 'magazzino'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>NUOVO CARICO</span>
            </button>
            <button
              onClick={() => onNavigate('magazzino_storico')}
              className={`min-h-[42px] rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition touch-manipulation ${
                activeView === 'magazzino_storico'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>STORICO ORDINI</span>
            </button>
          </div>
        </div>
      )}

      {currentRole === 'ufficio' && (
        <div className="lg:hidden border-t border-slate-800/80 bg-slate-950/90 px-3 py-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              onClick={() => onNavigate('ufficio_dashboard')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                activeView === 'ufficio_dashboard' ? 'bg-white text-slate-950' : 'text-slate-300 bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Ordini</span>
              {newOrdersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-mono font-black">
                  {newOrdersCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onNavigate('ufficio_storico')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                activeView === 'ufficio_storico' ? 'bg-white text-slate-950' : 'text-slate-300 bg-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Storico</span>
            </button>
            <button
              onClick={() => onNavigate('ufficio_catalogo')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                activeView === 'ufficio_catalogo' ? 'bg-white text-slate-950' : 'text-slate-300 bg-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Catalogo</span>
            </button>
            <button
              onClick={() => onNavigate('ufficio_cestino')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                activeView === 'ufficio_cestino' ? 'bg-white text-slate-950' : 'text-slate-300 bg-slate-900'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cestino</span>
            </button>
            <button
              onClick={() => onNavigate('ufficio_impostazioni')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                activeView === 'ufficio_impostazioni' ? 'bg-white text-slate-950' : 'text-slate-300 bg-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Impostazioni</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

