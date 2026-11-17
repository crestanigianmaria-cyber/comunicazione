import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Clock,
  CheckCircle2,
  Layers,
  Search,
  Eye,
  Printer,
  Truck,
  BellRing,
  Trash2,
  ArchiveRestore,
  Warehouse,
  FileText,
  AlignLeft,
  ChevronRight,
  X,
  UserCheck
} from 'lucide-react';
import { Order, OrderStatus, CompanySettings, Product, ORDER_DOCUMENT_LABELS, WarehouseLocation } from '../../types';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderPrintView } from './OrderPrintView';
import { CompleteOrderOperatorModal } from './CompleteOrderOperatorModal';
import { updateOrderStatus } from '../../services/db';

interface OfficeDashboardProps {
  orders: Order[];
  products: Product[];
  companySettings: CompanySettings;
  newOrderAlert: Order | null;
  onClearNewOrderAlert: () => void;
  onOpenExcelModal: () => void;
  isHistoricView?: boolean;
  isTrashView?: boolean;
  readOnly?: boolean;
  onArchiveOrder?: (order: Order) => Promise<void>;
  onRestoreOrder?: (order: Order) => Promise<void>;
  onEditOrder?: (order: Order) => void;
}

export const OfficeDashboard: React.FC<OfficeDashboardProps> = ({
  orders,
  products,
  companySettings,
  newOrderAlert,
  onClearNewOrderAlert,
  onOpenExcelModal,
  isHistoricView = false,
  isTrashView = false,
  readOnly = false,
  onArchiveOrder,
  onRestoreOrder,
  onEditOrder,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [pendingCompleteOrder, setPendingCompleteOrder] = useState<Order | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [locationFilter, setLocationFilter] = useState<'ALL' | WarehouseLocation>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // KPI calculations: archived orders must not count in the active office dashboard.
  const kpiStats = useMemo(() => {
    const activeOrders = orders.filter(order => !order.archived_at);
    let nuovi = 0;
    let inLavorazione = 0;
    let completati = 0;
    let oggi = 0;
    let magazzino = 0;
    let deposito = 0;

    const now = new Date();

    for (const order of activeOrders) {
      if (order.status === 'NUOVO') nuovi++;
      else if (order.status === 'PRESO IN CARICO') inLavorazione++;
      else if (order.status === 'COMPLETATO') completati++;

      if (order.warehouse_location === 'DEPOSITO') deposito++;
      else magazzino++;

      const d = new Date(order.created_at);
      if (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      ) {
        oggi++;
      }
    }

    return {
      nuovi,
      inLavorazione,
      completati,
      totale: activeOrders.length,
      oggi,
      magazzino,
      deposito,
    };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (isTrashView ? !order.archived_at : (!readOnly && order.archived_at)) return false;

      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      if (locationFilter !== 'ALL') {
        const loc = order.warehouse_location || 'MAGAZZINO';
        if (loc !== locationFilter) return false;
      }

      if (dateFilter !== 'ALL') {
        const orderDate = new Date(order.created_at);
        const now = new Date();

        if (dateFilter === 'TODAY') {
          const isToday =
            orderDate.getDate() === now.getDate() &&
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateFilter === 'WEEK') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < weekAgo) return false;
        } else if (dateFilter === 'MONTH') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (orderDate < monthAgo) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = order.order_number?.toLowerCase().includes(q);
        const custMatch = order.customer_reference?.toLowerCase().includes(q);
        const completedByMatch = order.completed_by?.toLowerCase().includes(q);
        const itemMatch = order.items.some(
          it =>
            it.product_code_snapshot?.toLowerCase().includes(q) ||
            it.product_description_snapshot?.toLowerCase().includes(q) ||
            it.manual_description?.toLowerCase().includes(q)
        );
        if (!numMatch && !custMatch && !completedByMatch && !itemMatch) return false;
      }

      return true;
    });
  }, [orders, statusFilter, locationFilter, dateFilter, searchQuery, isTrashView, readOnly]);

  const handleQuickStatusChange = async (e: React.MouseEvent, orderId: string, newStatus: OrderStatus) => {
    e.stopPropagation();
    if (newStatus === 'COMPLETATO') {
      const target = orders.find(o => o.id === orderId);
      if (!target || target.status === 'COMPLETATO') return;
      setPendingCompleteOrder(target);
      return;
    }
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch (err) {
      console.error('Failed to quick change status:', err);
    }
  };

  const handleConfirmCompleteOrder = async (operatorName: string) => {
    if (!pendingCompleteOrder) return;
    await updateOrderStatus(pendingCompleteOrder.id, 'COMPLETATO', operatorName);
    setPendingCompleteOrder(null);
  };

  return (
    <div className="space-y-5">
      {/* Real-time New Order Alert Banner */}
      {newOrderAlert && (
        <div className="bg-red-600 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-red-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-red-100">
                NUOVO ORDINE IN INGRESSO DAL PIAZZALE
              </div>
              <div className="text-sm sm:text-base font-black">
                {newOrderAlert.order_number}
                {newOrderAlert.customer_reference ? ` · ${newOrderAlert.customer_reference}` : ''}
                <span className="ml-2 font-mono text-xs font-bold bg-black/25 px-2 py-0.5 rounded">
                  {newOrderAlert.items.filter(i => i.line_type !== 'DESCRIPTION').length} articoli
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedOrder(newOrderAlert);
                onClearNewOrderAlert();
              }}
              className="px-4 py-2 rounded-lg bg-white text-red-700 text-xs font-black hover:bg-red-50 transition shadow-xs"
            >
              Apri Distinta
            </button>
            <button
              onClick={onClearNewOrderAlert}
              className="p-2 rounded-lg text-red-100 hover:text-white hover:bg-red-700/50 transition"
              aria-label="Chiudi avviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Executive Header for Historic / Trash / ReadOnly Views */}
      {isHistoricView && (
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isTrashView ? 'bg-red-500' : 'bg-slate-900'}`} />
              <h1 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">
                {isTrashView
                  ? 'Cestino Ordini Archiviati'
                  : readOnly
                  ? 'Storico Ordini Trasmessi dal Magazzino'
                  : 'Archivio Storico Completo'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isTrashView
                ? 'Gli ordini nel cestino vengono conservati per 60 giorni prima della rimozione definitiva.'
                : 'Consultazione e ristampa di tutte le distinte di carico registrate a sistema.'}
            </p>
          </div>
          <div className="text-right font-mono text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'documento' : 'documenti'}
          </div>
        </div>
      )}

      {/* Top 4 ERP KPI Cards */}
      {!isHistoricView && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: Nuovi Ordini */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'NUOVO' ? 'ALL' : 'NUOVO')}
            className={`bg-white rounded-xl p-4 sm:p-5 border text-left transition flex items-center justify-between cursor-pointer ${
              statusFilter === 'NUOVO'
                ? 'border-red-600 ring-2 ring-red-600/15 bg-red-50/20'
                : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${kpiStats.nuovi > 0 ? 'bg-red-600 animate-ping' : 'bg-slate-300'}`} />
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Nuovi in Attesa
                </span>
              </div>
              <div className="text-3xl font-black font-mono tracking-tight text-red-600 mt-1.5 tabular-nums">
                {kpiStats.nuovi}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                Da prendere in carico
              </span>
            </div>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              kpiStats.nuovi > 0 ? 'bg-red-600 text-white shadow-sm shadow-red-600/20' : 'bg-slate-100 text-slate-400'
            }`}>
              <Inbox className="w-5 h-5" />
            </div>
          </button>

          {/* KPI 2: In Lavorazione */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'PRESO IN CARICO' ? 'ALL' : 'PRESO IN CARICO')}
            className={`bg-white rounded-xl p-4 sm:p-5 border text-left transition flex items-center justify-between cursor-pointer ${
              statusFilter === 'PRESO IN CARICO'
                ? 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/20'
                : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div>
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                In Lavorazione
              </span>
              <div className="text-3xl font-black font-mono tracking-tight text-amber-600 mt-1.5 tabular-nums">
                {kpiStats.inLavorazione}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                Presi in carico in ufficio
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </button>

          {/* KPI 3: Completati */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'COMPLETATO' ? 'ALL' : 'COMPLETATO')}
            className={`bg-white rounded-xl p-4 sm:p-5 border text-left transition flex items-center justify-between cursor-pointer ${
              statusFilter === 'COMPLETATO'
                ? 'border-emerald-600 ring-2 ring-emerald-600/15 bg-emerald-50/20'
                : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div>
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Completati / Evasi
              </span>
              <div className="text-3xl font-black font-mono tracking-tight text-emerald-600 mt-1.5 tabular-nums">
                {kpiStats.completati}
              </div>
              <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                Bollati / Fatturati
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </button>

          {/* KPI 4: Totale Ordini & Flusso Sedi */}
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`bg-white rounded-xl p-4 sm:p-5 border text-left transition flex items-center justify-between cursor-pointer ${
              statusFilter === 'ALL'
                ? 'border-slate-900 ring-2 ring-slate-900/10'
                : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <div>
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Totale Attivi (Oggi: {kpiStats.oggi})
              </span>
              <div className="text-3xl font-black font-mono tracking-tight text-slate-900 mt-1.5 tabular-nums">
                {kpiStats.totale}
              </div>
              <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">
                Mag: {kpiStats.magazzino} · Dep: {kpiStats.deposito}
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Main ERP Data Container */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Toolbar: Search + Location + Status + Date */}
        <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/50">
          {/* Search input */}
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca N° ordine, cliente, cantiere, codice o descrizione materiale..."
              className="w-full h-10 pl-10 pr-8 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Location Filter */}
            <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg border border-slate-200 text-xs">
              {(
                [
                  { value: 'ALL', label: 'Tutte le Sedi' },
                  { value: 'MAGAZZINO', label: 'Magazzino' },
                  { value: 'DEPOSITO', label: 'Deposito' },
                ] as const
              ).map(loc => (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => setLocationFilter(loc.value)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition ${
                    locationFilter === loc.value
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center p-0.5 bg-slate-200/70 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tutti
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('NUOVO')}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition ${
                  statusFilter === 'NUOVO'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nuovi
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PRESO IN CARICO')}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition ${
                  statusFilter === 'PRESO IN CARICO'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                In Carico
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('COMPLETATO')}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition ${
                  statusFilter === 'COMPLETATO'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completati
              </button>
            </div>

            {/* Date Quick Select */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-slate-900"
            >
              <option value="ALL">Tutte le Date</option>
              <option value="TODAY">Solo Oggi</option>
              <option value="WEEK">Ultimi 7 Giorni</option>
              <option value="MONTH">Ultimi 30 Giorni</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredOrders.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-6 h-6 stroke-[1.75]" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-800">
              {isTrashView ? 'Il cestino è vuoto' : 'Nessun ordine corrisponde ai criteri selezionati'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'ALL' || dateFilter !== 'ALL' || locationFilter !== 'ALL'
                ? 'Prova a reimpostare i filtri di ricerca per visualizzare tutti gli ordini.'
                : 'Le distinte inviate dagli operatori di magazzino compariranno qui in tempo reale.'}
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP ERP TABLE VIEW (md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-mono font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 w-44">N° Documento & Sede</th>
                    <th className="py-3 px-4">Cliente / Cantiere & Anteprima Carico</th>
                    <th className="py-3 px-4 w-36">Tipo Doc.</th>
                    <th className="py-3 px-4 w-32">Data e Ora</th>
                    <th className="py-3 px-4 w-24 text-center">Righe</th>
                    <th className="py-3 px-4 w-52 text-center">Stato Lavorazione</th>
                    <th className="py-3 px-4 w-28 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {filteredOrders.map(order => {
                    const dateObj = new Date(order.created_at);
                    const formattedDate = dateObj.toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });
                    const formattedTime = dateObj.toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const diffMin = Math.max(0, Math.floor((Date.now() - dateObj.getTime()) / 60000));
                    const waitLabel =
                      diffMin < 1
                        ? 'Adesso'
                        : diffMin < 60
                        ? `${diffMin} min fa`
                        : diffMin < 1440
                        ? `${Math.floor(diffMin / 60)}h fa`
                        : null;
                    const productItems = order.items.filter(item => item.line_type !== 'DESCRIPTION');
                    const noteItems = order.items.filter(item => item.line_type === 'DESCRIPTION');
                    const isNew = order.status === 'NUOVO' && !isTrashView;

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`group cursor-pointer transition ${
                          isNew
                            ? 'bg-red-50/40 hover:bg-red-50/80'
                            : 'bg-white hover:bg-slate-50/90'
                        }`}
                      >
                        {/* Order Number & Location */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-5 rounded-full shrink-0 ${
                              order.status === 'NUOVO'
                                ? 'bg-red-600'
                                : order.status === 'PRESO IN CARICO'
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                            }`} />
                            <span className="font-mono font-black text-sm text-slate-900 group-hover:text-red-600 transition">
                              {order.order_number}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 pl-3.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase ${
                              order.warehouse_location === 'DEPOSITO'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {order.warehouse_location === 'DEPOSITO' ? 'DEPOSITO' : 'MAGAZZINO'}
                            </span>
                            {isNew && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-600 text-[9px] font-mono font-black text-white uppercase animate-pulse">
                                NUOVO
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Customer Reference + Inline Items Preview */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="font-extrabold text-sm text-slate-900">
                            {order.customer_reference ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{order.customer_reference}</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 font-semibold">
                                Carico diretto al banco
                              </span>
                            )}
                          </div>

                          {/* Preview of first 2 items for fast office triage */}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            {productItems.slice(0, 2).map(it => (
                              <span
                                key={it.id}
                                className="inline-flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 px-2 py-0.5 rounded text-slate-700 max-w-[260px] truncate"
                              >
                                <span className="font-mono font-bold text-[10px] text-slate-900">
                                  {it.quantity} {it.unit_of_measure_snapshot}
                                </span>
                                <span className="truncate">{it.product_description_snapshot}</span>
                              </span>
                            ))}
                            {productItems.length > 2 && (
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                +{productItems.length - 2} altri
                              </span>
                            )}
                            {noteItems.length > 0 && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-800">
                                <AlignLeft className="w-2.5 h-2.5" /> {noteItems.length} {noteItems.length === 1 ? 'nota' : 'note'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Document Type */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-[10px] font-mono font-extrabold uppercase tracking-wide text-slate-800">
                            <FileText className="w-3 h-3 text-slate-500" />
                            {order.document_type ? ORDER_DOCUMENT_LABELS[order.document_type] : 'DDT'}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-4 align-top font-mono">
                          <div className="font-bold text-slate-800 text-xs">{formattedDate}</div>
                          <div className="text-[11px] text-slate-400">ore {formattedTime}</div>
                          {order.status !== 'COMPLETATO' && waitLabel && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/70">
                              {waitLabel}
                            </span>
                          )}
                        </td>

                        {/* Items Count */}
                        <td className="py-3.5 px-4 align-top text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 font-mono font-extrabold text-slate-900 tabular-nums">
                            {productItems.length}
                          </span>
                        </td>

                        {/* Status Badge & 1-Click Quick Status Action */}
                        <td className="py-3.5 px-4 align-top text-center" onClick={(e) => e.stopPropagation()}>
                          {!readOnly && !isTrashView ? (
                            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                              <button
                                type="button"
                                onClick={(e) => handleQuickStatusChange(e, order.id, 'NUOVO')}
                                title="Imposta come Nuovo"
                                className={`px-2 py-1 rounded text-[10px] font-extrabold transition ${
                                  order.status === 'NUOVO'
                                    ? 'bg-red-600 text-white shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-900'
                                }`}
                              >
                                NUOVO
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleQuickStatusChange(e, order.id, 'PRESO IN CARICO')}
                                title="Prendi in Carico"
                                className={`px-2 py-1 rounded text-[10px] font-extrabold transition ${
                                  order.status === 'PRESO IN CARICO'
                                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-900'
                                }`}
                              >
                                IN CARICO
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleQuickStatusChange(e, order.id, 'COMPLETATO')}
                                title="Segna come Completato"
                                className={`px-2 py-1 rounded text-[10px] font-extrabold transition ${
                                  order.status === 'COMPLETATO'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-900'
                                }`}
                              >
                                EVASO
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-mono font-extrabold uppercase ${
                                order.status === 'NUOVO'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : order.status === 'PRESO IN CARICO'
                                  ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {order.status}
                            </span>
                          )}
                          {order.status === 'COMPLETATO' && order.completed_by && (
                            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                              <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Evaso da: {order.completed_by}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                              title="Apri Dettaglio Ordine"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintOrder(order)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                              title="Stampa Distinta A4 / PDF"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {!readOnly && !isTrashView && onArchiveOrder && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm('Spostare questo ordine nel cestino? Sarà recuperabile per 60 giorni.')) {
                                    await onArchiveOrder(order);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Sposta nel cestino"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {isTrashView && onRestoreOrder && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm('Ripristinare questo ordine nella dashboard attiva?')) {
                                    await onRestoreOrder(order);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                title="Ripristina ordine"
                              >
                                <ArchiveRestore className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE & PORTRAIT TABLET CARDS VIEW (< 768px) */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredOrders.map(order => {
                const dateObj = new Date(order.created_at);
                const formattedDate = dateObj.toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: '2-digit',
                });
                const formattedTime = dateObj.toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const productItems = order.items.filter(item => item.line_type !== 'DESCRIPTION');

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 active:bg-slate-50 transition flex flex-col gap-2.5 touch-manipulation ${
                      order.status === 'NUOVO' && !isTrashView ? 'bg-red-50/30 border-l-4 border-l-red-600' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-slate-900">
                          {order.order_number}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                          {order.warehouse_location === 'DEPOSITO' ? 'Deposito' : 'Magazzino'}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white uppercase">
                          {order.document_type ? ORDER_DOCUMENT_LABELS[order.document_type] : 'DDT'}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold uppercase ${
                          order.status === 'NUOVO'
                            ? 'bg-red-600 text-white'
                            : order.status === 'PRESO IN CARICO'
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-slate-800 truncate">
                        {order.customer_reference || 'Carico diretto al banco'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 shrink-0">
                        {formattedDate} · {formattedTime}
                      </div>
                    </div>

                    {order.status === 'COMPLETATO' && order.completed_by && (
                      <div className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                        <span>Evaso da: {order.completed_by}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="font-mono font-bold text-slate-600">
                        {productItems.length} {productItems.length === 1 ? 'articolo' : 'articoli'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-red-600 text-[11px]">
                        <span>Apri dettaglio</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          companySettings={companySettings}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={(updated) => setSelectedOrder(updated)}
          onOpenPrint={(ord) => setPrintOrder(ord)}
          readOnly={readOnly || isTrashView}
          onEditOrder={onEditOrder}
        />
      )}

      {/* Order Print / PDF Modal */}
      {printOrder && (
        <OrderPrintView
          order={printOrder}
          companySettings={companySettings}
          onClose={() => setPrintOrder(null)}
        />
      )}

      {/* Office Operator Confirmation Modal for COMPLETATO */}
      {pendingCompleteOrder && (
        <CompleteOrderOperatorModal
          order={pendingCompleteOrder}
          onCancel={() => setPendingCompleteOrder(null)}
          onConfirm={handleConfirmCompleteOrder}
        />
      )}
    </div>
  );
};

