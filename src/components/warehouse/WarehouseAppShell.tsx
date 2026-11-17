import React, { useEffect, useState } from 'react';
import {
  PlusCircle,
  ClipboardList,
  QrCode,
  Volume2,
  VolumeX,
  ArrowRightLeft,
  LogOut,
  RefreshCw,
  WifiOff,
  Warehouse,
  Layers,
  MoreVertical,
  Edit3,
  AlertTriangle,
  X,
  ListTodo,
} from 'lucide-react';
import { AppView, CompanySettings, Order, WarehouseLocation } from '../../types';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { isSoundEnabled, setSoundEnabled } from '../../lib/audio';
import { OnlineStatusSnapshot } from '../common/OfflineBanner';
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';

interface WarehouseAppShellProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  onSwitchRole: () => void;
  companySettings: CompanySettings;
  onlineStatus: OnlineStatusSnapshot;
  warehouseLocation: WarehouseLocation;
  onWarehouseLocationChange: (loc: WarehouseLocation) => void;
  activeCommitmentsCount: number;
  dueRemindersCount?: number;
  hasUrgentReminders?: boolean;
  cartLinesCount: number;
  editingOrder: Order | null;
  children: React.ReactNode;
}

const VIEW_META: Record<string, { title: string; subtitle: string }> = {
  magazzino: {
    title: 'Nuovo Ordine di Carico',
    subtitle: 'Composizione distinta materiali da banco e piazzale',
  },
  magazzino_promemoria: {
    title: 'Attività & Promemoria',
    subtitle: 'To-Do giornaliera di magazzino e ordini da preparare',
  },
  magazzino_storico: {
    title: 'Storico Ordini Magazzino',
    subtitle: 'Consultazione, ristampa e integrazione ordini non ancora completati',
  },
  magazzino_impegni: {
    title: 'Impegni Clienti & VELUX',
    subtitle: 'Materiale impegnato pronto per caricamento rapido o ristampa QR',
  },
};

export const WarehouseAppShell: React.FC<WarehouseAppShellProps> = ({
  activeView,
  onNavigate,
  onLogout,
  onSwitchRole,
  companySettings,
  onlineStatus,
  warehouseLocation,
  onWarehouseLocationChange,
  activeCommitmentsCount,
  dueRemindersCount = 0,
  hasUrgentReminders = false,
  cartLinesCount,
  editingOrder,
  children,
}) => {
  const { isOnline, pendingCount, isSyncing, syncMessage, triggerManualSync } = onlineStatus;
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isMobileTyping, setIsMobileTyping] = useState(false);

  useEffect(() => {
    setBannerDismissed(false);
  }, [pendingCount, isOnline]);

  // Hide mobile fixed bottom navigation cleanly while typing on narrow screens
  useEffect(() => {
    const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 768;

    const handleFocusIn = (e: FocusEvent) => {
      if (!isNarrow()) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        const inputType = (target as HTMLInputElement).type;
        if (!['checkbox', 'radio', 'button', 'submit', 'file'].includes(inputType)) {
          setIsMobileTyping(true);
        }
      }
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
          setIsMobileTyping(false);
        }
      }, 90);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const currentMeta = VIEW_META[activeView] || VIEW_META.magazzino;

  const navItems: {
    id: AppView;
    label: string;
    tabletLabel: string;
    mobileLabel: string;
    icon: typeof PlusCircle;
    badge?: number | string;
    badgeTone?: 'red' | 'amber' | 'slate';
  }[] = [
    {
      id: 'magazzino',
      label: editingOrder ? `Modifica ${editingOrder.order_number}` : 'Nuovo Ordine',
      tabletLabel: editingOrder ? 'Modifica' : 'Nuovo',
      mobileLabel: editingOrder ? 'Modifica' : 'Nuovo',
      icon: editingOrder ? Edit3 : PlusCircle,
      badge: cartLinesCount > 0 ? cartLinesCount : undefined,
      badgeTone: editingOrder ? 'amber' : 'red',
    },
    {
      id: 'magazzino_promemoria',
      label: 'Attività & To-Do',
      tabletLabel: 'Attività',
      mobileLabel: 'Attività',
      icon: ListTodo,
      badge: dueRemindersCount > 0 ? dueRemindersCount : undefined,
      badgeTone: hasUrgentReminders ? 'red' : 'amber',
    },
    {
      id: 'magazzino_storico',
      label: 'Storico Ordini',
      tabletLabel: 'Storico',
      mobileLabel: 'Storico',
      icon: ClipboardList,
    },
    {
      id: 'magazzino_impegni',
      label: 'Impegni & VELUX',
      tabletLabel: 'Impegni',
      mobileLabel: 'Impegni',
      icon: QrCode,
      badge: activeCommitmentsCount > 0 ? activeCommitmentsCount : undefined,
      badgeTone: 'red',
    },
  ];

  const showSyncBar = !bannerDismissed && (!isOnline || pendingCount > 0);

  return (
    <div
      className="min-h-screen bg-[#f4f6f8] flex font-sans text-slate-900 select-none"
      data-mobile-typing={isMobileTyping ? 'true' : 'false'}
    >
      {/* DESKTOP LEFT SIDEBAR (>= 1200px / xl) */}
      <aside className="hidden xl:flex xl:flex-col w-[248px] shrink-0 bg-[#0b0f19] text-white border-r border-slate-800 sticky top-0 h-screen no-print">
        <div className="h-1 w-full bg-red-600 shrink-0" />

        {/* Sidebar Brand Header */}
        <div className="p-4 border-b border-slate-800/90 flex items-center gap-3">
          <div className="w-12 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0">
            <img
              src="/saggin-logo.png"
              alt="Logo Saggin"
              className="w-full h-full object-contain"
              width="48"
              height="36"
            />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-sm tracking-tight text-white truncate">
              {companySettings.companyName || 'SAGGIN'}
            </div>
            <span className="inline-flex text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-red-600/20 text-red-400 border border-red-500/30 mt-0.5">
              MAGAZZINO WMS
            </span>
          </div>
        </div>

        {/* Primary Sidebar Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Navigazione Magazzino">
          <div className="px-2.5 pb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Menu Operativo
          </div>
          {navItems.map(item => {
            const active = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full min-h-[48px] px-3 py-2.5 rounded-xl flex items-center justify-between gap-2.5 text-left transition relative touch-manipulation ${
                  active
                    ? 'bg-red-600 text-white font-extrabold shadow-sm shadow-red-600/25'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900 font-bold'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs sm:text-sm truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-mono font-black flex items-center justify-center tabular-nums shrink-0 ${
                      active
                        ? 'bg-white text-red-700'
                        : item.badgeTone === 'amber'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Station & Session Controls */}
        <div className="p-3 border-t border-slate-800/90 space-y-2 bg-slate-950/60">
          <div className="px-2.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-400">
                Postazione
              </div>
              <div className="text-xs font-extrabold text-white truncate">
                Operatore Magazzino
              </div>
            </div>
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundOn ? 'Disattiva audio' : 'Attiva audio'}
              title={soundOn ? 'Audio attivo' : 'Audio muto'}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                soundOn
                  ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>

          <PWAInstallButton />

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onSwitchRole}
              className="min-h-[42px] px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition touch-manipulation"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>Ruolo</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[42px] px-2.5 rounded-xl bg-slate-900 hover:bg-red-950/50 border border-slate-800 hover:border-red-900/60 text-slate-300 hover:text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 transition touch-manipulation"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Esci</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* DESKTOP OPERATIONAL TOP BAR (>= 1200px) */}
        <header className="hidden xl:flex sticky top-0 z-40 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 items-center justify-between gap-4 no-print">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-black text-slate-900 tracking-tight truncate">
                {currentMeta.title}
              </h1>
              {editingOrder && activeView === 'magazzino' && (
                <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 font-mono text-[11px] font-black">
                  MODIFICA {editingOrder.order_number}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium truncate">{currentMeta.subtitle}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Synced Location Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              {(
                [
                  { value: 'MAGAZZINO', label: 'Magazzino', icon: Warehouse },
                  { value: 'DEPOSITO', label: 'Deposito', icon: Layers },
                ] as const
              ).map(loc => {
                const selected = warehouseLocation === loc.value;
                const Icon = loc.icon;
                return (
                  <button
                    key={loc.value}
                    type="button"
                    onClick={() => onWarehouseLocationChange(loc.value)}
                    aria-pressed={selected}
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition ${
                      selected
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{loc.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Connection & Pending Queue Sync Status Pill */}
            <div className="flex items-center gap-2">
              <div
                className={`h-9 px-3 rounded-xl border text-xs font-mono font-extrabold inline-flex items-center gap-2 ${
                  !isOnline
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : pendingCount > 0 || isSyncing
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    !isOnline
                      ? 'bg-red-600 animate-pulse'
                      : isSyncing
                      ? 'bg-amber-500 animate-ping'
                      : pendingCount > 0
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span>
                  {!isOnline
                    ? 'OFFLINE'
                    : isSyncing
                    ? 'SINCRONIZZAZIONE...'
                    : pendingCount > 0
                    ? `${pendingCount} IN CODA`
                    : 'ONLINE · SYNC OK'}
                </span>
              </div>

              {(pendingCount > 0 || isSyncing) && isOnline && (
                <button
                  type="button"
                  onClick={() => void triggerManualSync()}
                  disabled={isSyncing}
                  className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sincronizza</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* TABLET & SMARTPHONE TOP HEADER (< 1200px) */}
        <header className="xl:hidden sticky top-0 z-40 bg-[#0b0f19] text-white border-b border-slate-800 pt-safe shadow-md no-print">
          <div className="h-0.5 w-full bg-red-600" />

          {/* Main Compact Row */}
          <div className="px-3 sm:px-5 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-14 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0">
                <img
                  src="/saggin-logo.png"
                  alt="Logo Saggin"
                  className="h-full w-full object-contain"
                  width="56"
                  height="36"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm text-white truncate">
                    {companySettings.companyName || 'SAGGIN'}
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 shrink-0">
                    MAGAZZINO
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate leading-tight">
                  {currentMeta.title}
                </div>
              </div>
            </div>

            {/* Right Status & Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Connection Pill (Clickable to sync when pendingCount > 0) */}
              <button
                type="button"
                onClick={() => {
                  if (pendingCount > 0 && isOnline) void triggerManualSync();
                }}
                className={`min-h-[38px] px-2.5 rounded-xl border text-[10px] sm:text-xs font-mono font-extrabold inline-flex items-center gap-1.5 transition touch-manipulation ${
                  !isOnline
                    ? 'bg-red-950/60 text-red-300 border-red-700/60'
                    : pendingCount > 0 || isSyncing
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                }`}
                title="Stato connessione e sincronizzazione"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      !isOnline
                        ? 'bg-red-400 animate-pulse'
                        : pendingCount > 0
                        ? 'bg-slate-950'
                        : 'bg-emerald-400'
                    }`}
                  />
                )}
                <span>
                  {!isOnline
                    ? 'OFFLINE'
                    : isSyncing
                    ? 'SYNC'
                    : pendingCount > 0
                    ? `${pendingCount} CODA`
                    : 'ONLINE'}
                </span>
              </button>

              {/* Tablet Inline Utility Buttons (md..lg) */}
              <div className="hidden md:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-label="Audio notifiche"
                  className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition touch-manipulation"
                >
                  {soundOn ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={onSwitchRole}
                  className="h-10 px-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-800 inline-flex items-center gap-1.5 transition touch-manipulation"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-red-400" />
                  <span>Ruolo</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Esci"
                  className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-red-400 transition touch-manipulation"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Smartphone Menu Trigger (< md) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Apri opzioni postazione"
                className="md:hidden w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-800 touch-manipulation"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* TABLET 4-TAB NAV BAR (768px - 1199px) */}
          <div className="hidden md:flex items-center justify-between gap-2.5 border-t border-slate-800/90 bg-slate-950/90 px-4 lg:px-5 py-2">
            <nav className="grid grid-cols-4 gap-1.5 flex-1 max-w-3xl" aria-label="Sezioni Magazzino">
              {navItems.map(item => {
                const active = activeView === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`min-h-[44px] px-2 lg:px-3 rounded-xl text-[11px] lg:text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation whitespace-nowrap ${
                      active
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
                    <span className="truncate lg:hidden">{item.tabletLabel}</span>
                    <span className="hidden lg:inline truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-mono font-black flex items-center justify-center shrink-0 ${
                          active
                            ? 'bg-white text-red-700'
                            : item.badgeTone === 'amber'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Location Toggle for Tablet */}
            <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800 shrink-0">
              {(
                [
                  { value: 'MAGAZZINO', label: 'Magazzino' },
                  { value: 'DEPOSITO', label: 'Deposito' },
                ] as const
              ).map(loc => (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => onWarehouseLocationChange(loc.value)}
                  className={`min-h-[36px] px-2.5 lg:px-3 rounded-lg text-[11px] font-extrabold transition ${
                    warehouseLocation === loc.value
                      ? 'bg-white text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* OFFLINE / PENDING QUEUE INLINE ALERT BANNER */}
        {showSyncBar && (
          <div className="bg-amber-400 text-slate-950 px-3 sm:px-6 py-2 border-b border-amber-500 flex items-center justify-between gap-2.5 text-xs font-bold no-print">
            <div className="flex items-center gap-2 min-w-0">
              {!isOnline ? (
                <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block truncate">
                  {!isOnline
                    ? `Connessione assente${
                        pendingCount > 0 ? ` · ${pendingCount} ordini in attesa sul dispositivo` : ''
                      }`
                    : `${pendingCount} ${
                        pendingCount === 1 ? 'ordine in sospeso' : 'ordini in sospeso'
                      } da sincronizzare`}
                </span>
                {syncMessage && (
                  <span className="block text-[11px] font-semibold opacity-90 truncate">
                    {syncMessage}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {pendingCount > 0 && isOnline && (
                <button
                  type="button"
                  onClick={() => void triggerManualSync()}
                  disabled={isSyncing}
                  className="min-h-[36px] px-3 rounded-lg bg-slate-950 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 hover:bg-slate-800 disabled:opacity-50 touch-manipulation"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sync...' : 'Sincronizza'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Nascondi barra avviso"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-amber-500/50 touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PAGE CONTENT WORKSPACE */}
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6 pt-3.5 sm:pt-5">
          {children}
        </main>
      </div>

      {/* SMARTPHONE BOTTOM FIXED NAVIGATION BAR (< 768px) */}
      {!isMobileTyping && (
        <nav
          aria-label="Menu rapido magazzino"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 pt-1.5 pb-safe shadow-[0_-4px_20px_rgba(15,23,42,0.08)] no-print"
        >
          <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
            {navItems.map(item => {
              const active = activeView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition active:scale-95 touch-manipulation ${
                    active
                      ? 'bg-red-50 text-red-600 font-black'
                      : 'text-slate-500 hover:text-slate-900 font-bold'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                    {item.badge !== undefined && (
                      <span
                        className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-black flex items-center justify-center tabular-nums ${
                          item.badgeTone === 'amber'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] leading-none">{item.mobileLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* SMARTPHONE UTILITY MENU BOTTOM SHEET */}
      <ResponsiveSheetModal
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        headerTone="dark"
        title="Postazione Magazzino"
        subtitle={`${companySettings.companyName || 'Saggin'} · Controlli Rapidi`}
      >
        <div className="p-4 space-y-3 pb-safe">
          {/* Punto di Carico */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Punto di Carico Attivo
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'MAGAZZINO', label: 'Magazzino', icon: Warehouse },
                  { value: 'DEPOSITO', label: 'Deposito', icon: Layers },
                ] as const
              ).map(loc => {
                const selected = warehouseLocation === loc.value;
                const Icon = loc.icon;
                return (
                  <button
                    key={loc.value}
                    type="button"
                    onClick={() => onWarehouseLocationChange(loc.value)}
                    className={`min-h-[46px] rounded-xl border-2 font-extrabold text-xs flex items-center justify-center gap-2 touch-manipulation ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{loc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sync Status */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Stato Rete &amp; Coda
              </span>
              <span className="text-xs font-extrabold text-slate-900">
                {!isOnline
                  ? `Offline · ${pendingCount} in coda locale`
                  : pendingCount > 0
                  ? `Online · ${pendingCount} ordini da inviare`
                  : 'Online · Tutti gli ordini sincronizzati'}
              </span>
            </div>
            {pendingCount > 0 && isOnline && (
              <button
                type="button"
                onClick={() => void triggerManualSync()}
                disabled={isSyncing}
                className="min-h-[42px] px-3 rounded-xl bg-slate-900 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sincronizza</span>
              </button>
            )}
          </div>

          {/* Audio + Install */}
          <button
            type="button"
            onClick={toggleSound}
            className="w-full min-h-[48px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between text-xs font-extrabold text-slate-900 touch-manipulation"
          >
            <span className="flex items-center gap-2.5">
              {soundOn ? (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <span>Audio Notifiche Ordini</span>
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {soundOn ? 'ATTIVO' : 'MUTO'}
            </span>
          </button>

          <div className="flex justify-center">
            <PWAInstallButton />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onSwitchRole();
              }}
              className="min-h-[48px] px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-extrabold flex items-center justify-center gap-2 touch-manipulation"
            >
              <ArrowRightLeft className="w-4 h-4 text-red-600" />
              <span>Cambia Ruolo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="min-h-[48px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 touch-manipulation"
            >
              <LogOut className="w-4 h-4" />
              <span>Esci</span>
            </button>
          </div>
        </div>
      </ResponsiveSheetModal>
    </div>
  );
};
