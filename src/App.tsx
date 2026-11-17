import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppView,
  UserRole,
  Order,
  Product,
  CompanySettings,
  CustomerCommitment,
  WarehouseLocation,
  WarehouseReminder,
} from './types';
import {
  fetchProducts,
  fetchOrders,
  fetchCommitments,
  fetchReminders,
  subscribeToOrders,
  subscribeToCommitments,
  subscribeToCatalog,
  subscribeToReminders,
  completeWarehouseReminder,
  getCompanySettings,
  getAuthenticatedRole,
  signOutRole,
  archiveOrder,
  restoreOrder,
} from './services/db';
import { getLocalDateKey, sortReminders } from './lib/reminders';
import { Header } from './components/common/Header';
import { OfflineBanner } from './components/common/OfflineBanner';
import { LoginModal } from './components/auth/LoginModal';
import { WarehouseView } from './components/warehouse/WarehouseView';
import { WarehouseAppShell } from './components/warehouse/WarehouseAppShell';
import { WarehouseHistoryView } from './components/warehouse/WarehouseHistoryView';
import { WarehouseCommitmentsView } from './components/warehouse/WarehouseCommitmentsView';
import { WarehouseRemindersView } from './components/warehouse/WarehouseRemindersView';
import { DailyRemindersBriefModal } from './components/warehouse/DailyRemindersBriefModal';
import { CompleteReminderModal } from './components/warehouse/CompleteReminderModal';
import { ToastProvider, useToast } from './components/warehouse/ui/ToastProvider';
import { OfficeDashboard } from './components/office/OfficeDashboard';
import { OfficeCatalogView } from './components/office/OfficeCatalogView';
import { OfficeRemindersView } from './components/office/OfficeRemindersView';
import { CommitmentsView } from './components/office/CommitmentsView';
import { SettingsModal } from './components/office/SettingsModal';
import { ExcelImportModal } from './components/office/ExcelImportModal';
import { useOnlineStatus } from './hooks/useOnlineStatus';

function AppContent() {
  const { showToast } = useToast();
  const onlineStatus = useOnlineStatus();
  const { isOnline, refreshPendingCount } = onlineStatus;

  // Role authentication state
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getAuthenticatedRole()
      .then((role) => {
        if (isMounted) setCurrentRole(role);
      })
      .catch((error) => console.error('Errore ripristino sessione:', error))
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Current active navigation view
  const [activeView, setActiveView] = useState<AppView>('magazzino');

  // Shared Warehouse loading location (synced with localStorage & App Shell Header)
  const [warehouseLocation, setWarehouseLocation] = useState<WarehouseLocation>(() => {
    try {
      return (localStorage.getItem('saggin_warehouse_location') as WarehouseLocation) || 'MAGAZZINO';
    } catch {
      return 'MAGAZZINO';
    }
  });

  const handleWarehouseLocationChange = useCallback((loc: WarehouseLocation) => {
    setWarehouseLocation(loc);
    try {
      localStorage.setItem('saggin_warehouse_location', loc);
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  // Database state
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [commitments, setCommitments] = useState<CustomerCommitment[]>([]);
  const [reminders, setReminders] = useState<WarehouseReminder[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => getCompanySettings());

  // Local calendar date key ('YYYY-MM-DD'), kept fresh across midnight rollovers
  const [todayKey, setTodayKey] = useState<string>(() => getLocalDateKey());
  useEffect(() => {
    const syncDayKey = () => {
      const current = getLocalDateKey();
      setTodayKey((prev) => (prev === current ? prev : current));
    };
    const timer = window.setInterval(syncDayKey, 60000);
    window.addEventListener('focus', syncDayKey);
    document.addEventListener('visibilitychange', syncDayKey);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', syncDayKey);
      document.removeEventListener('visibilitychange', syncDayKey);
    };
  }, []);

  // Live Warehouse Cart badge stats
  const [warehouseCartStats, setWarehouseCartStats] = useState({ lines: 0, units: 0 });

  // Daily Reminders Brief + Mandatory Operator Attribution state
  const [showDailyBrief, setShowDailyBrief] = useState(false);
  const briefShownForSessionRef = useRef(false);
  const briefDayKeyRef = useRef<string>(todayKey);
  const [pendingCompleteReminder, setPendingCompleteReminder] = useState<WarehouseReminder | null>(null);
  const [pendingReminderCustomerRef, setPendingReminderCustomerRef] = useState<string | null>(null);

  // Real-time new order alert banner
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const notifiedOrderIds = useRef<Set<string>>(new Set());
  const newOrdersCount =
    currentRole === 'ufficio'
      ? orders.filter(order => order.status === 'NUOVO' && !order.archived_at).length
      : 0;
  const activeCommitmentsCount = commitments.filter(c => c.status === 'ATTIVO').length;

  const dueReminders = reminders.filter(r => r.status === 'DA_FARE' && r.due_date <= todayKey);
  const dueRemindersCount = dueReminders.length;
  const urgentDueRemindersCount = dueReminders.filter(r => r.priority === 'URGENTE').length;
  const overdueRemindersCount = dueReminders.filter(r => r.due_date < todayKey).length;

  // Badge numerico sull'icona PWA, se il browser/sistema operativo lo supporta.
  useEffect(() => {
    if (currentRole !== 'ufficio' || typeof navigator === 'undefined') return;
    const badgeNavigator = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (newOrdersCount > 0 && badgeNavigator.setAppBadge) {
      void badgeNavigator.setAppBadge(newOrdersCount).catch(() => {});
    } else if (badgeNavigator.clearAppBadge) {
      void badgeNavigator.clearAppBadge().catch(() => {});
    }
  }, [currentRole, newOrdersCount]);

  // Global Excel Import Modal
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Role switch modal toggle
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Active order being edited/appended in WarehouseView
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  // Commitment selected from Warehouse Commitments view to load into order
  const [pendingCommitmentToLoad, setPendingCommitmentToLoad] = useState<CustomerCommitment | null>(null);

  // Load shared data only after a valid Supabase session has been restored.
  useEffect(() => {
    if (!currentRole) return;
    let isMounted = true;

    async function loadData() {
      setIsProductsLoading(true);
      const productsTask = fetchProducts()
        .then((loadedProducts) => {
          if (isMounted) setProducts(loadedProducts);
        })
        .catch((err) => {
          console.error('[Catalog] Initial load failed:', err);
        })
        .finally(() => {
          if (isMounted) setIsProductsLoading(false);
        });

      const ordersTask = fetchOrders()
        .then((loadedOrders) => {
          if (isMounted) setOrders(loadedOrders);
        })
        .catch((err) => {
          console.error('[Orders] Initial load failed:', err);
        });

      const commitmentsTask = fetchCommitments()
        .then((loadedCommitments) => {
          if (isMounted) setCommitments(loadedCommitments);
        })
        .catch((err) => {
          console.error('[Commitments] Initial load failed:', err);
        });

      const remindersTask = fetchReminders()
        .then((loadedReminders) => {
          if (isMounted) setReminders(loadedReminders);
        })
        .catch((err) => {
          console.error('[Reminders] Initial load failed:', err);
        });

      await Promise.all([productsTask, ordersTask, commitmentsTask, remindersTask]);
    }

    loadData();

    // Subscribe to live order updates (Supabase Realtime + BroadcastChannel)
    const unsubOrders = subscribeToOrders((updatedOrders, newOrderEvent) => {
      setOrders(updatedOrders);
      if (newOrderEvent && currentRole === 'ufficio') {
        setNewOrderAlert(newOrderEvent);

        const orderId = newOrderEvent.id;
        if (
          orderId &&
          !notifiedOrderIds.current.has(orderId) &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted'
        ) {
          notifiedOrderIds.current.add(orderId);
          const reference = newOrderEvent.customer_reference
            ? ` · ${newOrderEvent.customer_reference}`
            : '';
          const notification = new Notification('Nuovo ordine ricevuto', {
            body: `${newOrderEvent.order_number || 'Nuovo ordine'}${reference}`,
            icon: '/pwa-192x192.png',
            tag: `magazzino-order-${orderId}`,
          });
          notification.onclick = () => {
            window.focus();
            setActiveView('ufficio_dashboard');
            notification.close();
          };
        }
      }
    });

    // Subscribe to live commitment updates
    const unsubCommitments = subscribeToCommitments((updatedCommitments) => {
      setCommitments(updatedCommitments);
    });

    // Subscribe to live warehouse reminder updates
    const unsubReminders = subscribeToReminders((updatedReminders) => {
      if (isMounted) setReminders(sortReminders(updatedReminders));
    });

    // Subscribe to live catalog updates
    const unsubCatalog = subscribeToCatalog((updatedProducts) => {
      setProducts(updatedProducts);
    });

    // Background safety poll every 30s for the office terminal to guarantee fresh data even if Windows dropped WebSocket
    let safetyPollTimer: ReturnType<typeof setInterval> | null = null;
    if (currentRole === 'ufficio') {
      safetyPollTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        void fetchOrders(true)
          .then((fresh) => {
            if (isMounted) setOrders(fresh);
          })
          .catch(() => {});
        void fetchCommitments(true)
          .then((freshCommitments) => {
            if (isMounted) setCommitments(freshCommitments);
          })
          .catch(() => {});
      }, 30000);
    }

    return () => {
      isMounted = false;
      if (safetyPollTimer) clearInterval(safetyPollTimer);
      unsubOrders();
      unsubCommitments();
      unsubReminders();
      unsubCatalog();
    };
  }, [currentRole]);

  // Show daily operational reminders brief automatically when Warehouse connects/logs in
  useEffect(() => {
    if (currentRole !== 'magazzino') return;
    if (briefDayKeyRef.current !== todayKey) {
      briefDayKeyRef.current = todayKey;
      briefShownForSessionRef.current = false;
    }
    if (!briefShownForSessionRef.current && dueRemindersCount > 0) {
      briefShownForSessionRef.current = true;
      setShowDailyBrief(true);
    }
  }, [currentRole, todayKey, dueRemindersCount]);

  useEffect(() => {
    if (showDailyBrief && dueRemindersCount === 0) {
      setShowDailyBrief(false);
    }
  }, [showDailyBrief, dueRemindersCount]);

  // Update default view based on role
  useEffect(() => {
    if (currentRole === 'magazzino') {
      setActiveView('magazzino');
    } else if (
      currentRole === 'ufficio' &&
      (activeView === 'magazzino' ||
        activeView === 'magazzino_promemoria' ||
        activeView === 'magazzino_impegni' ||
        activeView === 'magazzino_storico')
    ) {
      setActiveView('ufficio_dashboard');
    }
  }, [currentRole]);

  const handleStartOrderFromReminder = useCallback(
    (reminder: WarehouseReminder) => {
      const ref = reminder.customer_reference?.trim() || reminder.title.trim();
      if (reminder.warehouse_location === 'MAGAZZINO' || reminder.warehouse_location === 'DEPOSITO') {
        handleWarehouseLocationChange(reminder.warehouse_location);
      }
      setPendingReminderCustomerRef(ref);
      setShowDailyBrief(false);
      setActiveView('magazzino');
    },
    [handleWarehouseLocationChange]
  );

  const handleConfirmCompleteReminder = async (operatorName: string, completionNote?: string) => {
    if (!pendingCompleteReminder) return;
    const target = pendingCompleteReminder;
    await completeWarehouseReminder(target.id, {
      completedBy: operatorName,
      completionNote,
    });
    refreshPendingCount();
    setPendingCompleteReminder(null);
    showToast({
      message: 'Attività completata',
      detail: `${target.title} · Operatore: ${operatorName}`,
      tone: 'success',
    });
  };

  const handleLoginSuccess = (role: UserRole) => {
    briefShownForSessionRef.current = false;
    briefDayKeyRef.current = getLocalDateKey();
    setShowDailyBrief(false);
    setPendingCompleteReminder(null);
    setCurrentRole(role);
    setShowRoleModal(false);
    if (role === 'magazzino') {
      setActiveView('magazzino');
    } else {
      setActiveView('ufficio_dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await signOutRole();
    } catch (error) {
      console.error('Errore durante la disconnessione:', error);
    } finally {
      briefShownForSessionRef.current = false;
      setShowDailyBrief(false);
      setPendingCompleteReminder(null);
      setCurrentRole(null);
      setShowRoleModal(false);
    }
  };

  const handleSwitchRole = () => {
    setShowRoleModal(true);
  };

  const handleEnableNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (error) {
      console.warn('Impossibile richiedere il permesso per le notifiche:', error);
    }
  };

  // Wait for Supabase to restore the persisted authentication session.
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] wms-grid-bg flex flex-col items-center justify-center text-white gap-4">
        <div className="bg-white rounded-xl px-4 py-2.5 shadow-lg">
          <img
            src="/saggin-logo.png"
            alt="Saggin Guglielmo S.R.L."
            className="h-9 w-auto object-contain"
          />
        </div>
        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          <span>Inizializzazione Sistema ERP...</span>
        </div>
      </div>
    );
  }

  // If not logged in, or switching roles, show LoginModal
  if (!currentRole || showRoleModal) {
    return (
      <LoginModal
        onLoginSuccess={handleLoginSuccess}
        defaultRole={currentRole || 'magazzino'}
        onCancel={currentRole ? () => setShowRoleModal(false) : undefined}
      />
    );
  }

  // --------------------------------------------------------------------------
  // PORTALE MAGAZZINO (Dedicated Responsive App Shell & Warehouse Views)
  // --------------------------------------------------------------------------
  if (currentRole === 'magazzino') {
    return (
      <>
        <WarehouseAppShell
          activeView={activeView}
          onNavigate={view => setActiveView(view)}
          onLogout={handleLogout}
          onSwitchRole={handleSwitchRole}
          companySettings={companySettings}
          onlineStatus={onlineStatus}
          warehouseLocation={warehouseLocation}
          onWarehouseLocationChange={handleWarehouseLocationChange}
          activeCommitmentsCount={activeCommitmentsCount}
          dueRemindersCount={dueRemindersCount}
          hasUrgentReminders={urgentDueRemindersCount > 0}
          cartLinesCount={warehouseCartStats.lines}
          editingOrder={editingOrder}
        >
          {/* Keep WarehouseView mounted across tab switches to preserve search/context */}
          <div className={activeView === 'magazzino' ? 'block' : 'hidden'}>
            <WarehouseView
              products={products}
              isProductsLoading={isProductsLoading}
              companySettings={companySettings}
              isOnline={isOnline}
              warehouseLocation={warehouseLocation}
              onWarehouseLocationChange={handleWarehouseLocationChange}
              editingOrder={editingOrder}
              onCancelEditOrder={() => setEditingOrder(null)}
              onOrderSaved={() => setEditingOrder(null)}
              commitments={commitments}
              pendingCommitmentToLoad={pendingCommitmentToLoad}
              onCommitmentLoaded={() => setPendingCommitmentToLoad(null)}
              onOrdersQueueChanged={refreshPendingCount}
              onCartStatsChange={setWarehouseCartStats}
              todayRemindersSummary={{
                totalOpen: dueRemindersCount,
                urgentOpen: urgentDueRemindersCount,
                overdueCount: overdueRemindersCount,
              }}
              onOpenReminders={() => setActiveView('magazzino_promemoria')}
              pendingReminderCustomerRef={pendingReminderCustomerRef}
              onReminderCustomerRefConsumed={() => setPendingReminderCustomerRef(null)}
            />
          </div>

          {activeView === 'magazzino_promemoria' && (
            <WarehouseRemindersView
              reminders={reminders}
              onRefreshReminders={async () => {
                const refreshed = await fetchReminders(true);
                setReminders(refreshed);
              }}
              onRequestComplete={(reminder) => setPendingCompleteReminder(reminder)}
              onStartOrderFromReminder={handleStartOrderFromReminder}
            />
          )}

          {activeView === 'magazzino_impegni' && (
            <WarehouseCommitmentsView
              commitments={commitments}
              onRefreshCommitments={async () => {
                const refreshed = await fetchCommitments(true);
                setCommitments(refreshed);
              }}
              onLoadCommitmentIntoOrder={(commitment) => {
                setPendingCommitmentToLoad(commitment);
                setActiveView('magazzino');
              }}
            />
          )}

          {activeView === 'magazzino_storico' && (
            <WarehouseHistoryView
              orders={orders}
              companySettings={companySettings}
              onEditOrder={(order) => {
                if (order.status === 'COMPLETATO' || order.archived_at) return;
                setEditingOrder(order);
                setActiveView('magazzino');
              }}
            />
          )}
        </WarehouseAppShell>

        {/* Daily login briefing modal (yields cleanly while CompleteReminderModal is active) */}
        <DailyRemindersBriefModal
          isOpen={showDailyBrief && !pendingCompleteReminder}
          reminders={reminders}
          onClose={() => setShowDailyBrief(false)}
          onOpenFullTodoList={() => {
            setShowDailyBrief(false);
            setActiveView('magazzino_promemoria');
          }}
          onRequestComplete={(reminder) => setPendingCompleteReminder(reminder)}
          onStartOrderFromReminder={handleStartOrderFromReminder}
        />

        {/* Mandatory operator attribution modal before completing any reminder */}
        <CompleteReminderModal
          reminder={pendingCompleteReminder}
          operatorMode="magazzino"
          onCancel={() => setPendingCompleteReminder(null)}
          onConfirm={handleConfirmCompleteReminder}
        />
      </>
    );
  }

  // --------------------------------------------------------------------------
  // PORTALE UFFICIO (Unchanged workflows & layout + Office Reminders tab)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f4f6f8] flex flex-col font-sans text-slate-900 select-none">
      {/* Offline Status Alert */}
      <OfflineBanner statusOverride={onlineStatus} />

      {/* Primary Top Header */}
      <Header
        currentRole={currentRole}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
        companySettings={companySettings}
        isOnline={isOnline}
        notificationPermission={notificationPermission}
        onEnableNotifications={handleEnableNotifications}
        newOrdersCount={newOrdersCount}
        activeCommitmentsCount={activeCommitmentsCount}
        pendingTodayRemindersCount={dueRemindersCount}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-3 sm:p-5 lg:p-6">
        {/* Edit order requested from Office Dashboard */}
        {activeView === 'magazzino' && (
          <WarehouseView
            products={products}
            isProductsLoading={isProductsLoading}
            companySettings={companySettings}
            isOnline={isOnline}
            warehouseLocation={warehouseLocation}
            onWarehouseLocationChange={handleWarehouseLocationChange}
            editingOrder={editingOrder}
            onCancelEditOrder={() => {
              setEditingOrder(null);
              setActiveView('ufficio_dashboard');
            }}
            onOrderSaved={() => {
              setEditingOrder(null);
              setActiveView('ufficio_dashboard');
            }}
            commitments={commitments}
            pendingCommitmentToLoad={pendingCommitmentToLoad}
            onCommitmentLoaded={() => setPendingCommitmentToLoad(null)}
            onOrdersQueueChanged={refreshPendingCount}
          />
        )}

        {/* INTERFACCIA UFFICIO: DASHBOARD */}
        {activeView === 'ufficio_dashboard' && (
          <OfficeDashboard
            orders={orders}
            products={products}
            companySettings={companySettings}
            newOrderAlert={newOrderAlert}
            onClearNewOrderAlert={() => setNewOrderAlert(null)}
            onOpenExcelModal={() => setShowExcelModal(true)}
            isHistoricView={false}
            onArchiveOrder={async (order) => {
              await archiveOrder(order.id);
              setOrders(await fetchOrders(true));
            }}
            onEditOrder={(order) => {
              setEditingOrder(order);
              setActiveView('magazzino');
            }}
          />
        )}

        {/* INTERFACCIA UFFICIO: PROMEMORIA & TO-DO MAGAZZINO */}
        {activeView === 'ufficio_promemoria' && (
          <OfficeRemindersView
            reminders={reminders}
            onRefreshReminders={async () => {
              const refreshed = await fetchReminders(true);
              setReminders(refreshed);
            }}
          />
        )}

        {/* INTERFACCIA UFFICIO: IMPEGNI CLIENTI & SEZIONE VELUX */}
        {activeView === 'ufficio_impegni' && (
          <CommitmentsView
            commitments={commitments}
            products={products}
            readOnly={false}
            onRefreshCommitments={async () => {
              const refreshed = await fetchCommitments(true);
              setCommitments(refreshed);
            }}
          />
        )}

        {/* INTERFACCIA UFFICIO: STORICO COMPLETO */}
        {activeView === 'ufficio_storico' && (
          <OfficeDashboard
            orders={orders}
            products={products}
            companySettings={companySettings}
            newOrderAlert={newOrderAlert}
            onClearNewOrderAlert={() => setNewOrderAlert(null)}
            onOpenExcelModal={() => setShowExcelModal(true)}
            isHistoricView={true}
          />
        )}

        {activeView === 'ufficio_cestino' && (
          <OfficeDashboard
            orders={orders}
            products={products}
            companySettings={companySettings}
            newOrderAlert={null}
            onClearNewOrderAlert={() => {}}
            onOpenExcelModal={() => {}}
            isHistoricView={true}
            isTrashView={true}
            onRestoreOrder={async (order) => {
              await restoreOrder(order.id);
              setOrders(await fetchOrders(true));
            }}
          />
        )}

        {/* INTERFACCIA UFFICIO: CATALOGO ARTICOLI & EXCEL */}
        {activeView === 'ufficio_catalogo' && (
          <OfficeCatalogView
            products={products}
            companySettings={companySettings}
            onOpenExcelImport={() => setShowExcelModal(true)}
          />
        )}

        {/* INTERFACCIA UFFICIO: IMPOSTAZIONI & SUPABASE */}
        {activeView === 'ufficio_impostazioni' && (
          <SettingsModal
            initialSettings={companySettings}
            currentRole={currentRole}
            onSettingsSaved={(newSettings) => setCompanySettings(newSettings)}
          />
        )}
      </main>

      {/* Global Excel Import Modal (SheetJS) */}
      {showExcelModal && (
        <ExcelImportModal
          products={products}
          onClose={() => setShowExcelModal(false)}
          onImportCompleted={async () => {
            const reloaded = await fetchProducts();
            setProducts(reloaded);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
