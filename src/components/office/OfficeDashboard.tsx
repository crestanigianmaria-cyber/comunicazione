import React, { useState, useMemo } from 'react';
import {
  Inbox,
  Clock,
  CheckCircle2,
  Layers,
  Search,
  Filter,
  Eye,
  Printer,
  Calendar,
  Truck,
  ArrowUpDown,
  BellRing,
  RotateCcw,
  FileSpreadsheet
} from 'lucide-react';
import { Order, OrderStatus, CompanySettings, Product } from '../../types';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderPrintView } from './OrderPrintView';
import { updateOrderStatus } from '../../services/db';

interface OfficeDashboardProps {
  orders: Order[];
  products: Product[];
  companySettings: CompanySettings;
  newOrderAlert: Order | null;
  onClearNewOrderAlert: () => void;
  onOpenExcelModal: () => void;
  isHistoricView?: boolean;
}

export const OfficeDashboard: React.FC<OfficeDashboardProps> = ({
  orders,
  products,
  companySettings,
  newOrderAlert,
  onClearNewOrderAlert,
  onOpenExcelModal,
  isHistoricView = false,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // KPI calculations
  const kpiStats = useMemo(() => {
    let nuovi = 0;
    let inLavorazione = 0;
    let completati = 0;

    for (const order of orders) {
      if (order.status === 'NUOVO') nuovi++;
      else if (order.status === 'PRESO IN CARICO') inLavorazione++;
      else if (order.status === 'COMPLETATO') completati++;
    }

    return {
      nuovi,
      inLavorazione,
      completati,
      totale: orders.length,
    };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      // Date filter
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

      // Text search (Order Number or Customer Reference)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = order.order_number?.toLowerCase().includes(q);
        const custMatch = order.customer_reference?.toLowerCase().includes(q);
        const itemMatch = order.items.some(
          it =>
            it.product_code_snapshot?.toLowerCase().includes(q) ||
            it.product_description_snapshot?.toLowerCase().includes(q)
        );
        if (!numMatch && !custMatch && !itemMatch) return false;
      }

      return true;
    });
  }, [orders, statusFilter, dateFilter, searchQuery]);

  const handleQuickStatusChange = async (e: React.MouseEvent, orderId: string, newStatus: OrderStatus) => {
    e.stopPropagation();
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch (err) {
      console.error('Failed to quick change status:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time New Order Banner Alert */}
      {newOrderAlert && (
        <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-200">
                Nuovo Ordine Ricevuto dal Magazzino!
              </div>
              <div className="text-sm font-black">
                {newOrderAlert.order_number} {newOrderAlert.customer_reference ? `· ${newOrderAlert.customer_reference}` : ''} ({newOrderAlert.items.length} articoli)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedOrder(newOrderAlert);
                onClearNewOrderAlert();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-white text-blue-900 text-xs font-black hover:bg-blue-50 transition"
            >
              Apri Dettaglio
            </button>
            <button
              onClick={onClearNewOrderAlert}
              className="px-2.5 py-1.5 rounded-lg text-blue-200 hover:text-white text-xs font-semibold"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Top 4 KPI Indicators */}
      {!isHistoricView && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Nuovi Ordini */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Nuovi Ordini
              </span>
              <div className="text-3xl font-black font-mono tracking-tight text-amber-600 mt-1">
                {kpiStats.nuovi}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Da prendere in carico</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Inbox className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: In Lavorazione */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                In Lavorazione
              </span>
              <div className="text-3xl font-black font-mono tracking-tight text-blue-600 mt-1">
                {kpiStats.inLavorazione}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Presi in carico</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Completati */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Completati
              </span>
              <div className="text-3xl font-black font-mono tracking-tight text-emerald-600 mt-1">
                {kpiStats.completati}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Bollati / Chiusi</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Totale Ordini */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Totale Ordini
              </span>
              <div className="text-3xl font-black font-mono tracking-tight text-slate-900 mt-1">
                {kpiStats.totale}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Registrati nel sistema</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card with Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca ordine, cliente, cantiere o codice articolo..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {/* Status and Date Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tutti
              </button>
              <button
                onClick={() => setStatusFilter('NUOVO')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'NUOVO'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nuovi
              </button>
              <button
                onClick={() => setStatusFilter('PRESO IN CARICO')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'PRESO IN CARICO'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                In Lavorazione
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETATO')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                  statusFilter === 'COMPLETATO'
                    ? 'bg-emerald-600 text-white shadow-sm'
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
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Qualsiasi Data</option>
              <option value="TODAY">Oggi</option>
              <option value="WEEK">Ultimi 7 Giorni</option>
              <option value="MONTH">Ultimi 30 Giorni</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Inbox className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">Nessun ordine trovato</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'ALL' || dateFilter !== 'ALL'
                ? 'Prova a modificare i filtri di ricerca.'
                : 'Quando gli operatori invieranno un ordine dallo smartphone, comparirà qui in tempo reale.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-36">Numero Ordine</th>
                  <th className="py-3 px-4">Cliente / Riferimento</th>
                  <th className="py-3 px-4 w-28">Data</th>
                  <th className="py-3 px-4 w-24">Ora</th>
                  <th className="py-3 px-4 w-28 text-center">Articoli</th>
                  <th className="py-3 px-4 w-36 text-center">Stato</th>
                  <th className="py-3 px-4 w-24 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-blue-50/50 cursor-pointer transition"
                    >
                      {/* Order Number */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-sm text-blue-700">
                          {order.order_number}
                        </span>
                      </td>

                      {/* Customer Reference */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {order.customer_reference ? (
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-xs">{order.customer_reference}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal italic">
                            Carico diretto al banco
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {formattedDate}
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-600">
                        {formattedTime}
                      </td>

                      {/* Items Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 font-mono font-bold text-slate-800">
                          {order.items.length} {order.items.length === 1 ? 'riga' : 'righe'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            order.status === 'NUOVO'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : order.status === 'PRESO IN CARICO'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Visualizza Dettaglio"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPrintOrder(order)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Stampa / Esporta PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  );
};
