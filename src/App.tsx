import React, { useState, useEffect } from 'react';
import { UserRole, Order, Product, CompanySettings } from './types';
import {
  fetchProducts,
  fetchOrders,
  subscribeToOrders,
  subscribeToCatalog,
  getCompanySettings,
} from './services/db';
import { Header } from './components/common/Header';
import { OfflineBanner } from './components/common/OfflineBanner';
import { LoginModal } from './components/auth/LoginModal';
import { WarehouseView } from './components/warehouse/WarehouseView';
import { OfficeDashboard } from './components/office/OfficeDashboard';
import { OfficeCatalogView } from './components/office/OfficeCatalogView';
import { SettingsModal } from './components/office/SettingsModal';
import { ExcelImportModal } from './components/office/ExcelImportModal';
import { useOnlineStatus } from './hooks/useOnlineStatus';

type ActiveView = 'magazzino' | 'ufficio_dashboard' | 'ufficio_storico' | 'ufficio_catalogo' | 'ufficio_impostazioni';

export default function App() {
  const { isOnline } = useOnlineStatus();

  // Role authentication state
  const [currentRole, setCurrentRole] = useState<UserRole | null>(() => {
    try {
      return (localStorage.getItem('magazzino_user_role') as UserRole) || null;
    } catch {
      return null;
    }
  });

  // Current active navigation view
  const [activeView, setActiveView] = useState<ActiveView>('magazzino');

  // Database state
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => getCompanySettings());

  // Real-time new order alert banner
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);

  // Global Excel Import Modal
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Role switch modal toggle
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Load initial products & orders
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [loadedProducts, loadedOrders] = await Promise.all([
          fetchProducts(),
          fetchOrders(),
        ]);
        if (isMounted) {
          setProducts(loadedProducts);
          setOrders(loadedOrders);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    }

    loadData();

    // Subscribe to live order updates (Supabase Realtime + BroadcastChannel)
    const unsubOrders = subscribeToOrders((updatedOrders, newOrderEvent) => {
      setOrders(updatedOrders);
      if (newOrderEvent) {
        setNewOrderAlert(newOrderEvent);
      }
    });

    // Subscribe to live catalog updates
    const unsubCatalog = subscribeToCatalog((updatedProducts) => {
      setProducts(updatedProducts);
    });

    return () => {
      isMounted = false;
      unsubOrders();
      unsubCatalog();
    };
  }, []);

  // Update default view based on role
  useEffect(() => {
    if (currentRole === 'magazzino') {
      setActiveView('magazzino');
    } else if (currentRole === 'ufficio' && activeView === 'magazzino') {
      setActiveView('ufficio_dashboard');
    }
  }, [currentRole]);

  const handleLoginSuccess = (role: UserRole) => {
    setCurrentRole(role);
    setShowRoleModal(false);
    try {
      localStorage.setItem('magazzino_user_role', role);
    } catch {
      // Ignore
    }
    if (role === 'magazzino') {
      setActiveView('magazzino');
    } else {
      setActiveView('ufficio_dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentRole(null);
    try {
      localStorage.removeItem('magazzino_user_role');
    } catch {
      // Ignore
    }
  };

  const handleSwitchRole = () => {
    setShowRoleModal(true);
  };

  // If not logged in, or switching roles, show LoginModal
  if (!currentRole || showRoleModal) {
    return (
      <LoginModal
        onLoginSuccess={handleLoginSuccess}
        defaultRole={currentRole || 'magazzino'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 select-none">
      {/* Offline Status Alert */}
      <OfflineBanner />

      {/* Primary Top Header */}
      <Header
        currentRole={currentRole}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
        companySettings={companySettings}
        isOnline={isOnline}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-6">
        {/* INTERFACCIA MAGAZZINO (Mobile First) */}
        {activeView === 'magazzino' && (
          <WarehouseView
            products={products}
            companySettings={companySettings}
            isOnline={isOnline}
            onOpenExcelModal={() => setShowExcelModal(true)}
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

        {/* INTERFACCIA UFFICIO: CATALOGO ARTICOLI & EXCEL */}
        {activeView === 'ufficio_catalogo' && (
          <OfficeCatalogView
            products={products}
            onOpenExcelImport={() => setShowExcelModal(true)}
          />
        )}

        {/* INTERFACCIA UFFICIO: IMPOSTAZIONI & SUPABASE */}
        {activeView === 'ufficio_impostazioni' && (
          <SettingsModal
            initialSettings={companySettings}
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
