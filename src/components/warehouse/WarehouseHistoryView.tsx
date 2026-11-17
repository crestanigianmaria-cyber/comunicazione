import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  Printer,
  Edit3,
  X,
  Inbox,
  Truck,
  UserCheck,
  AlignLeft,
  Copy,
  Check,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  Order,
  OrderStatus,
  CompanySettings,
  WarehouseLocation,
  ORDER_DOCUMENT_LABELS,
} from '../../types';
import { OrderPrintView } from '../office/OrderPrintView';
import {
  OrderStatusBadge,
  LocationBadge,
  DocumentTypeBadge,
} from './ui/StatusBadge';
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';
import { EmptyState } from './ui/EmptyState';

interface WarehouseHistoryViewProps {
  orders: Order[];
  companySettings: CompanySettings;
  onEditOrder: (order: Order) => void;
}

export const WarehouseHistoryView: React.FC<WarehouseHistoryViewProps> = ({
  orders,
  companySettings,
  onEditOrder,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [locationFilter, setLocationFilter] = useState<'ALL' | WarehouseLocation>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  const stats = useMemo(() => {
    let nuovi = 0;
    let inCarico = 0;
    let completati = 0;
    for (const ord of orders) {
      if (ord.status === 'NUOVO') nuovi++;
      else if (ord.status === 'PRESO IN CARICO') inCarico++;
      else if (ord.status === 'COMPLETATO') completati++;
    }
    return { total: orders.length, nuovi, inCarico, completati };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;

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
          if (orderDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
        } else if (dateFilter === 'MONTH') {
          if (orderDate < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
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
  }, [orders, statusFilter, locationFilter, dateFilter, searchQuery]);

  const handleCopyAllRows = (order: Order) => {
    const lines = order.items.map(item => {
      if (item.line_type === 'DESCRIPTION') {
        return `NOTA\t${(item.manual_description || item.product_description_snapshot || '').replace(
          /\s+/g,
          ' '
        )}\t\t`;
      }
      return `${item.product_code_snapshot}\t${item.product_description_snapshot}\t${item.unit_of_measure_snapshot}\t${item.quantity}`;
    });
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1800);
  };

  const canModifyOrder = (order: Order) =>
    order.status !== 'COMPLETATO' && !order.archived_at;

  const liveSelectedOrder = useMemo(
    () => (selectedOrder ? orders.find(o => o.id === selectedOrder.id) || selectedOrder : null),
    [selectedOrder, orders]
  );

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className={printOrder ? 'space-y-4 no-print' : 'space-y-4'}>
        {/* Quick Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {(
          [
            {
              key: 'ALL' as const,
              label: 'Tutti gli Ordini',
              count: stats.total,
              tone: 'border-slate-200 text-slate-900',
              active: 'border-slate-900 ring-2 ring-slate-900/10 bg-white',
            },
            {
              key: 'NUOVO' as const,
              label: 'Nuovi in Attesa',
              count: stats.nuovi,
              tone: 'border-slate-200 text-red-600',
              active: 'border-red-600 ring-2 ring-red-600/15 bg-red-50/30',
            },
            {
              key: 'PRESO IN CARICO' as const,
              label: 'In Lavorazione',
              count: stats.inCarico,
              tone: 'border-slate-200 text-amber-600',
              active: 'border-amber-500 ring-2 ring-amber-500/15 bg-amber-50/30',
            },
            {
              key: 'COMPLETATO' as const,
              label: 'Completati',
              count: stats.completati,
              tone: 'border-slate-200 text-emerald-600',
              active: 'border-emerald-600 ring-2 ring-emerald-600/15 bg-emerald-50/30',
            },
          ]
        ).map(card => {
          const selected = statusFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setStatusFilter(card.key)}
              className={`min-h-[68px] bg-white rounded-xl border p-3 sm:p-3.5 text-left transition active:scale-[0.98] touch-manipulation ${
                selected ? card.active : `${card.tone} hover:border-slate-300 shadow-2xs`
              }`}
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block truncate">
                {card.label}
              </span>
              <span
                className={`text-2xl font-black font-mono tabular-nums mt-0.5 block ${
                  card.key === 'NUOVO'
                    ? 'text-red-600'
                    : card.key === 'PRESO IN CARICO'
                    ? 'text-amber-600'
                    : card.key === 'COMPLETATO'
                    ? 'text-emerald-600'
                    : 'text-slate-900'
                }`}
              >
                {card.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Filters Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 lg:max-w-md flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cerca N° ordine, cliente, operatore o articolo..."
              className="w-full h-11 pl-10 pr-10 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Cancella ricerca storico"
                className="absolute right-0 pr-2 flex items-center justify-center min-w-[40px] h-11 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Location Filter */}
            <div className="flex items-center p-1 bg-slate-200/70 rounded-xl border border-slate-200">
              {(
                [
                  { value: 'ALL', label: 'Tutte Sedi' },
                  { value: 'MAGAZZINO', label: 'Magazzino' },
                  { value: 'DEPOSITO', label: 'Deposito' },
                ] as const
              ).map(loc => (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => setLocationFilter(loc.value)}
                  className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-extrabold transition touch-manipulation ${
                    locationFilter === loc.value
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as 'ALL' | 'TODAY' | 'WEEK' | 'MONTH')}
              aria-label="Filtra per data"
              className="h-11 px-3 bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-800 focus:outline-none focus:border-slate-900 touch-manipulation"
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
          <EmptyState
            icon={Inbox}
            title="Nessun ordine trovato"
            description={
              searchQuery || statusFilter !== 'ALL' || locationFilter !== 'ALL' || dateFilter !== 'ALL'
                ? 'Prova a modificare o azzerare i filtri di ricerca.'
                : 'Gli ordini trasmessi dal magazzino appariranno qui.'
            }
          />
        ) : (
          <>
            {/* DESKTOP & LANDSCAPE TABLET ERP TABLE (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-mono font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-2.5 xl:px-3 whitespace-nowrap">N° Ordine</th>
                    <th className="py-3 px-2.5 xl:px-3 whitespace-nowrap">Data</th>
                    <th className="py-3 px-2.5 xl:px-3">Cliente</th>
                    <th className="py-3 px-2.5 xl:px-3 whitespace-nowrap">Sede</th>
                    <th className="py-3 px-2.5 xl:px-3 whitespace-nowrap">Documento</th>
                    <th className="py-3 px-2 xl:px-2.5 text-center whitespace-nowrap">Righe</th>
                    <th className="py-3 px-2.5 xl:px-3 whitespace-nowrap">Stato</th>
                    <th className="py-3 px-2.5 xl:px-3 whitespace-nowrap">Operatore</th>
                    <th className="py-3 px-2.5 xl:px-3 text-right whitespace-nowrap">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {filteredOrders.map(order => {
                    const dateObj = new Date(order.created_at);
                    const formattedDate = dateObj.toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    });
                    const formattedTime = dateObj.toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const productItems = order.items.filter(it => it.line_type !== 'DESCRIPTION');
                    const noteCount = order.items.filter(it => it.line_type === 'DESCRIPTION').length;
                    const editable = canModifyOrder(order);

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`group cursor-pointer transition ${
                          order.status === 'NUOVO'
                            ? 'bg-red-50/35 hover:bg-red-50/70'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-2.5 xl:px-3 align-middle whitespace-nowrap">
                          <span className="font-mono font-black text-xs xl:text-sm text-slate-900 group-hover:text-red-600 transition">
                            {order.order_number}
                          </span>
                        </td>

                        <td className="py-3 px-2.5 xl:px-3 align-middle font-mono whitespace-nowrap">
                          <div className="font-bold text-slate-800">{formattedDate}</div>
                          <div className="text-[11px] text-slate-400">{formattedTime}</div>
                        </td>

                        <td className="py-3 px-2.5 xl:px-3 align-middle max-w-[180px] xl:max-w-[230px]">
                          <div className="font-extrabold text-slate-900 truncate">
                            {order.customer_reference || (
                              <span className="text-slate-500 font-semibold">
                                Carico diretto al banco
                              </span>
                            )}
                          </div>
                          {productItems.length > 0 && (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {productItems[0].quantity} {productItems[0].unit_of_measure_snapshot}{' '}
                              {productItems[0].product_description_snapshot}
                              {productItems.length > 1 && ` (+${productItems.length - 1})`}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-2.5 xl:px-3 align-middle whitespace-nowrap">
                          <LocationBadge location={order.warehouse_location} />
                        </td>

                        <td className="py-3 px-2.5 xl:px-3 align-middle whitespace-nowrap">
                          <DocumentTypeBadge documentType={order.document_type} />
                        </td>

                        <td className="py-3 px-2 xl:px-2.5 align-middle text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <span className="inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-mono font-extrabold text-slate-900 tabular-nums">
                              {productItems.length}
                            </span>
                            {noteCount > 0 && (
                              <span
                                title={`${noteCount} note descrittive`}
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold"
                              >
                                +{noteCount}N
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-2.5 xl:px-3 align-middle whitespace-nowrap">
                          <OrderStatusBadge status={order.status} compact />
                        </td>

                        <td className="py-3 px-2.5 xl:px-3 align-middle whitespace-nowrap">
                          {order.completed_by ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                              <UserCheck className="w-3 h-3 shrink-0" />
                              <span>{order.completed_by}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>

                        <td
                          className="py-3 px-2.5 xl:px-3 align-middle text-right whitespace-nowrap"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1">
                            {editable && (
                              <button
                                type="button"
                                onClick={() => onEditOrder(order)}
                                title="Modifica o aggiungi articoli"
                                className="min-h-[36px] px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] inline-flex items-center gap-1 transition touch-manipulation"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Modifica</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedOrder(order)}
                              title="Apri dettaglio ordine"
                              aria-label="Apri dettaglio ordine"
                              className="w-9 h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition touch-manipulation"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintOrder(order)}
                              title="Stampa Distinta / PDF"
                              aria-label="Stampa Distinta / PDF"
                              className="w-9 h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 inline-flex items-center justify-center transition touch-manipulation"
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

            {/* SMARTPHONE & PORTRAIT TABLET TOUCH CARDS (< 1024px) */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:gap-3 md:p-3.5 md:bg-slate-50/70">
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
                const productItems = order.items.filter(it => it.line_type !== 'DESCRIPTION');
                const noteCount = order.items.filter(it => it.line_type === 'DESCRIPTION').length;
                const editable = canModifyOrder(order);

                return (
                  <div
                    key={order.id}
                    className={`p-4 space-y-2.5 md:rounded-xl md:border md:shadow-2xs flex flex-col justify-between ${
                      order.status === 'NUOVO'
                        ? 'bg-red-50/30 md:bg-white border-l-4 border-l-red-600 md:border-red-200'
                        : 'bg-white md:border-slate-200'
                    }`}
                  >
                    <div
                      onClick={() => setSelectedOrder(order)}
                      className="space-y-2 cursor-pointer touch-manipulation"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-black text-base text-slate-900">
                          {order.order_number}
                        </span>
                        <OrderStatusBadge status={order.status} compact />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <LocationBadge location={order.warehouse_location} />
                        <DocumentTypeBadge documentType={order.document_type} />
                        <span className="text-[11px] font-mono text-slate-500 ml-auto">
                          {formattedDate} · {formattedTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                        <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {order.customer_reference || 'Carico diretto al banco'}
                        </span>
                      </div>

                      {order.completed_by && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                          <UserCheck className="w-3 h-3 shrink-0" />
                          <span>Operatore: {order.completed_by}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                        <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-600">
                          {productItems.length} art.
                        </span>
                        {noteCount > 0 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">
                            +{noteCount}N
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {editable && (
                          <button
                            type="button"
                            onClick={() => onEditOrder(order)}
                            className="min-h-[40px] px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-extrabold inline-flex items-center gap-1 touch-manipulation whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5 shrink-0" />
                            <span>Modifica</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPrintOrder(order)}
                          aria-label="Stampa"
                          className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 inline-flex items-center justify-center touch-manipulation shrink-0"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="min-h-[40px] px-2.5 rounded-xl bg-slate-900 text-white text-[11px] sm:text-xs font-extrabold inline-flex items-center gap-1 touch-manipulation whitespace-nowrap"
                        >
                          <span>Dettaglio</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>

      {/* ORDER DETAIL MODAL / BOTTOM SHEET */}
      <ResponsiveSheetModal
        isOpen={Boolean(liveSelectedOrder)}
        onClose={() => setSelectedOrder(null)}
        maxWidthClass="sm:max-w-4xl"
        headerTone="dark"
        title={liveSelectedOrder ? `Dettaglio Ordine ${liveSelectedOrder.order_number}` : ''}
        subtitle={
          liveSelectedOrder
            ? `${new Date(liveSelectedOrder.created_at).toLocaleDateString('it-IT')} · ${new Date(
                liveSelectedOrder.created_at
              ).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
            : ''
        }
        footer={
          liveSelectedOrder && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopyAllRows(liveSelectedOrder)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-extrabold inline-flex items-center gap-1.5 hover:bg-slate-100 touch-manipulation"
                >
                  {copiedAll ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>{copiedAll ? 'Copiato!' : 'Copia Righe'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintOrder(liveSelectedOrder)}
                  className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 touch-manipulation"
                >
                  <Printer className="w-4 h-4" />
                  <span>Stampa / PDF</span>
                </button>

                {canModifyOrder(liveSelectedOrder) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = liveSelectedOrder;
                      setSelectedOrder(null);
                      onEditOrder(target);
                    }}
                    className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 touch-manipulation"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Modifica / Aggiungi</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="min-h-[44px] px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold touch-manipulation ml-auto"
              >
                Chiudi
              </button>
            </div>
          )
        }
      >
        {liveSelectedOrder && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-1">
                  Documento
                </span>
                <span className="font-extrabold text-slate-900">
                  {liveSelectedOrder.document_type
                    ? ORDER_DOCUMENT_LABELS[liveSelectedOrder.document_type]
                    : 'DDT'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-1">
                  Punto di Carico
                </span>
                <LocationBadge location={liveSelectedOrder.warehouse_location} />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-1">
                  Stato Lavorazione
                </span>
                <OrderStatusBadge status={liveSelectedOrder.status} compact />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-1">
                  Operatore Ufficio
                </span>
                <span className="font-extrabold text-slate-900">
                  {liveSelectedOrder.completed_by || 'In attesa'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-4 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block">
                  Cliente / Riferimento Cantiere
                </span>
                <span className="text-sm font-extrabold text-slate-900">
                  {liveSelectedOrder.customer_reference || 'Carico diretto al banco'}
                </span>
              </div>
            </div>

            {/* Snapshot Items */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-mono font-extrabold uppercase text-slate-600">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 w-32">Codice</th>
                      <th className="py-2.5 px-3">Descrizione Materiale</th>
                      <th className="py-2.5 px-3 w-28">Cod. Alt.</th>
                      <th className="py-2.5 px-3 w-16 text-center">U.M.</th>
                      <th className="py-2.5 px-3 w-24 text-right">Quantità</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {liveSelectedOrder.items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={item.line_type === 'DESCRIPTION' ? 'bg-amber-50/80' : 'bg-white'}
                      >
                        {item.line_type === 'DESCRIPTION' ? (
                          <td colSpan={6} className="py-3 px-4 text-sm font-semibold text-slate-900">
                            <span className="mr-2 inline-flex items-center gap-1 rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-mono font-black uppercase text-amber-950">
                              <AlignLeft className="w-3 h-3" /> Nota
                            </span>
                            {item.manual_description || item.product_description_snapshot}
                          </td>
                        ) : (
                          <>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                              {item.product_code_snapshot}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {item.product_description_snapshot}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {item.alternative_code_snapshot || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-700 uppercase">
                              {item.unit_of_measure_snapshot}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-slate-900 tabular-nums">
                              {item.quantity}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Items List inside modal */}
              <div className="sm:hidden divide-y divide-slate-200">
                {liveSelectedOrder.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 ${
                      item.line_type === 'DESCRIPTION' ? 'bg-amber-50/80' : 'bg-white'
                    }`}
                  >
                    {item.line_type === 'DESCRIPTION' ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-mono font-black uppercase text-amber-950 mb-1">
                          <AlignLeft className="w-3 h-3" /> Nota #{idx + 1}
                        </span>
                        <p className="text-xs font-semibold text-slate-900 whitespace-pre-wrap">
                          {item.manual_description || item.product_description_snapshot}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-[11px] bg-slate-900 text-white px-2 py-0.5 rounded">
                              {item.product_code_snapshot}
                            </span>
                            {item.alternative_code_snapshot && (
                              <span className="font-mono text-[10px] text-slate-500">
                                {item.alternative_code_snapshot}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 mt-1">
                            {item.product_description_snapshot}
                          </p>
                        </div>
                        <div className="font-mono font-black text-sm text-slate-900 whitespace-nowrap tabular-nums">
                          {item.quantity}{' '}
                          <span className="text-xs text-red-600">{item.unit_of_measure_snapshot}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {liveSelectedOrder.status === 'COMPLETATO' && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ordine già evaso dall&apos;ufficio: non più modificabile dal magazzino.</span>
              </div>
            )}
          </div>
        )}
      </ResponsiveSheetModal>

      {/* Print Preview Modal (rendered above detail sheet when triggered from inside) */}
      {printOrder && (
        <div className="relative z-[80]">
          <OrderPrintView
            order={printOrder}
            companySettings={companySettings}
            onClose={() => setPrintOrder(null)}
          />
        </div>
      )}
    </div>
  );
};
