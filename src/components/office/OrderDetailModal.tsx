import React, { useState } from 'react';
import {
  X,
  Printer,
  Clock,
  User,
  Hash,
  CheckCircle2,
  AlertCircle,
  Truck,
  ArrowRight
} from 'lucide-react';
import { Order, OrderStatus, CompanySettings } from '../../types';
import { updateOrderStatus } from '../../services/db';

interface OrderDetailModalProps {
  order: Order;
  companySettings: CompanySettings;
  onClose: () => void;
  onOrderUpdated: (updated: Order) => void;
  onOpenPrint: (order: Order) => void;
  readOnly?: boolean;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  companySettings,
  onClose,
  onOrderUpdated,
  onOpenPrint,
  readOnly = false,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === currentOrder.status || isUpdating) return;
    setIsUpdating(true);
    try {
      const updated = await updateOrderStatus(currentOrder.id, newStatus);
      setCurrentOrder(updated);
      onOrderUpdated(updated);
    } catch (err) {
      console.error('Failed to change status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const formattedDate = new Date(currentOrder.created_at).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedTime = new Date(currentOrder.created_at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl sm:text-2xl font-black text-blue-400">
              {currentOrder.order_number}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formattedDate} ore {formattedTime}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPrint(currentOrder)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Stampa / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Reference & Status Control Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Cliente / Riferimento Cantiere
            </span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {currentOrder.customer_reference || 'Carico al banco senza riferimento specificato'}
            </div>
          </div>

          {/* Status Buttons */}
          {!readOnly && <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Gestione Stato Ordine
            </span>
            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
              <button
                type="button"
                onClick={() => handleStatusChange('NUOVO')}
                disabled={isUpdating}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentOrder.status === 'NUOVO'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                NUOVO
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('PRESO IN CARICO')}
                disabled={isUpdating}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentOrder.status === 'PRESO IN CARICO'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                PRESO IN CARICO
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('COMPLETATO')}
                disabled={isUpdating}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentOrder.status === 'COMPLETATO'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                COMPLETATO
              </button>
            </div>
          </div>}
        </div>

        {/* Snapshot Items Table */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Materiali Caricati ({currentOrder.items.length} articoli)
            </h4>
            <span className="text-[11px] text-slate-500">
              Dati registrati come snapshot all'invio dell'ordine
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-32">Codice</th>
                  <th className="py-2.5 px-3">Descrizione</th>
                  <th className="py-2.5 px-3 w-32">Codice Alternativo</th>
                  <th className="py-2.5 px-3 w-20 text-center">UM</th>
                  <th className="py-2.5 px-3 w-24 text-right">Quantità</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentOrder.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">
                      {index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {item.product_code_snapshot}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {item.product_description_snapshot}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {item.alternative_code_snapshot || '—'}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-blue-700 uppercase">
                      {item.unit_of_measure_snapshot}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-sm text-slate-900">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Identificativo interno database: <span className="font-mono text-[10px]">{currentOrder.id}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
