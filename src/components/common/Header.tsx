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
  ClipboardList,
  QrCode,
  ListTodo,
} from 'lucide-react';
import { UserRole, CompanySettings, AppView } from '../../types';
import { PWAInstallButton } from './PWAInstallButton';
import { isSoundEnabled, setSoundEnabled } from '../../lib/audio';

interface HeaderProps {
  currentRole: UserRole | null;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  onSwitchRole: () => void;
  companySettings: CompanySettings;
  isOnline: boolean;
  notificationPermission: NotificationPermission;
  onEnableNotifications: () => void;
  newOrdersCount: number;
  activeCommitmentsCount?: number;
  pendingTodayRemindersCount?: number;
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
  activeCommitmentsCount = 0,
  pendingTodayRemindersCount = 0,
}) => {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0b0f19] border-b border-slate-800 text-white select-none no-print shadow-md pt-safe">
      {/* Top 2px Saggin Corporate Accent Bar */}
      <div className="h-0.5 w-full bg-red-600" />

      {/* ROW 1: Brand Identity (Left) + System Controls & Session Actions (Right) */}
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
        {/* Left: Brand Identity & Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-15 sm:h-9 sm:w-16 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 overflow-hidden shrink-0">
            <img
              src="/saggin-logo.png"
              alt="Logo Saggin"
              className="h-full w-full object-contain"
              width="64"
              height="36"
              decoding="async"
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold tracking-tight text-sm sm:text-base text-white truncate leading-tight">
                {companySettings.companyName || 'SAGGIN'}
              </span>
              <span
                className={`inline-flex text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${
                  currentRole === 'magazzino'
                    ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                {currentRole === 'magazzino' ? 'MAGAZZINO' : 'PORTALE UFFICIO'}
              </span>
              <div
                className={`hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  isOnline
                    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50'
                    : 'text-amber-400 bg-amber-950/40 border-amber-800/50'
                }`}
                title={
                  isOnline
                    ? 'Sincronizzazione Cloud Attiva'
                    : 'Modalità Offline - Salvataggio locale attivo'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span>{isOnline ? 'CLOUD SYNC' : 'OFFLINE'}</span>
              </div>
            </div>

            <span className="hidden sm:inline text-[11px] text-slate-400 font-medium leading-tight truncate">
              Saggin Guglielmo S.R.L. · Gestione Ordini, Impegni Clienti &amp; Logistica QR
            </span>
          </div>
        </div>

        {/* Right: Cleanly Grouped System Controls & User Session */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {currentRole === 'ufficio' && newOrdersCount > 0 && (
            <button
              onClick={() => onNavigate('ufficio_dashboard')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-sm shadow-red-600/25 animate-pulse"
              title="Visualizza nuovi ordini dal magazzino"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">NUOVI</span>
              <span className="min-w-5 h-5 rounded-full bg-white text-red-700 font-mono inline-flex items-center justify-center px-1 text-[11px]">
                {newOrdersCount}
              </span>
            </button>
          )}

          {currentRole === 'ufficio' && (
            <button
              onClick={onEnableNotifications}
              disabled={notificationPermission !== 'default'}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
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
              <span className="hidden lg:inline">
                {notificationPermission === 'granted'
                  ? 'Avvisi On'
                  : notificationPermission === 'denied'
                  ? 'Avvisi Off'
                  : 'Attiva Avvisi'}
              </span>
            </button>
          )}

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleSound}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border transition touch-manipulation flex items-center gap-1.5 text-[11px] font-semibold ${
              soundOn
                ? 'text-white bg-slate-900 border-slate-800 hover:bg-slate-800'
                : 'text-slate-500 bg-slate-900/50 border-slate-800/50 hover:text-slate-300'
            }`}
            title={
              soundOn
                ? 'Audio notifiche attivo (clicca per mutare)'
                : 'Audio notifiche disattivato (clicca per attivare)'
            }
          >
            {soundOn ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
            <span className="hidden xl:inline">{soundOn ? 'Audio On' : 'Muto'}</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          <div className="hidden sm:block h-5 w-px bg-slate-800 mx-0.5" />

          {/* Role Switcher */}
          {currentRole && (
            <button
              onClick={onSwitchRole}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold transition touch-manipulation"
              title="Cambia Postazione (Magazzino / Ufficio)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden md:inline">Cambia Ruolo</span>
            </button>
          )}

          {currentRole && (
            <button
              onClick={onLogout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition touch-manipulation flex items-center gap-1 text-xs font-semibold"
              title="Disconnetti sessione"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline">Esci</span>
            </button>
          )}
        </div>
      </div>

      {/* ROW 2: Dedicated, Ordered Navigation Bar (Fits all Office & Warehouse functions cleanly) */}
      <div className="border-t border-slate-800/90 bg-slate-950/90">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-1.5 overflow-x-auto no-scrollbar">
          {currentRole === 'ufficio' && (
            <nav className="flex items-center justify-between gap-2 min-w-max">
              {/* Primary Operational Functions */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onNavigate('ufficio_dashboard')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeView === 'ufficio_dashboard'
                      ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-red-500" />
                  <span>Ordini Attivi</span>
                  {newOrdersCount > 0 && (
                    <span className="inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-mono font-black">
                      {newOrdersCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onNavigate('ufficio_promemoria')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeView === 'ufficio_promemoria'
                      ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <ListTodo className="w-4 h-4 text-amber-400" />
                  <span>Promemoria</span>
                  {pendingTodayRemindersCount > 0 && (
                    <span
                      className={`inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full text-[10px] font-mono font-black ${
                        activeView === 'ufficio_promemoria'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      {pendingTodayRemindersCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onNavigate('ufficio_impegni')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeView === 'ufficio_impegni'
                      ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-[#e30613]" />
                  <span>Impegni Clienti</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider ${
                      activeView === 'ufficio_impegni'
                        ? 'bg-[#e30613] text-white'
                        : 'bg-[#e30613]/90 text-white'
                    }`}
                  >
                    VELUX
                  </span>
                  {activeCommitmentsCount > 0 && (
                    <span
                      className={`inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full text-[10px] font-mono font-black ${
                        activeView === 'ufficio_impegni'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      {activeCommitmentsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onNavigate('ufficio_catalogo')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeView === 'ufficio_catalogo'
                      ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Listino &amp; Stampa QR</span>
                </button>

                <button
                  onClick={() => onNavigate('ufficio_storico')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    activeView === 'ufficio_storico'
                      ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <History className="w-4 h-4 text-sky-400" />
                  <span>Archivio Storico</span>
                </button>
              </div>

              {/* Secondary / System Management Functions aligned right */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
                <button
                  onClick={() => onNavigate('ufficio_cestino')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeView === 'ufficio_cestino'
                      ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cestino</span>
                </button>

                <button
                  onClick={() => onNavigate('ufficio_impostazioni')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeView === 'ufficio_impostazioni'
                      ? 'bg-white text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Impostazioni</span>
                </button>
              </div>
            </nav>
          )}

          {currentRole === 'magazzino' && (
            <nav className="max-w-3xl mx-auto grid grid-cols-3 gap-2">
              <button
                onClick={() => onNavigate('magazzino')}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation whitespace-nowrap ${
                  activeView === 'magazzino'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
                }`}
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Nuovo Carico</span>
              </button>

              <button
                onClick={() => onNavigate('magazzino_impegni')}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation whitespace-nowrap ${
                  activeView === 'magazzino_impegni'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>Impegni &amp; VELUX</span>
                {activeCommitmentsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white text-slate-900 text-[10px] font-mono font-black">
                    {activeCommitmentsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onNavigate('magazzino_storico')}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation whitespace-nowrap ${
                  activeView === 'magazzino_storico'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
                }`}
              >
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span>Storico Invii</span>
              </button>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};
