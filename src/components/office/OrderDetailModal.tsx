import React, { useState } from 'react';
import {
  X,
  Printer,
  Clock,
  Check,
  Copy,
  FileText,
  Warehouse,
  AlignLeft,
  Edit3,
  UserCheck,
  Download,
  Keyboard
} from 'lucide-react';
import { Order, OrderStatus, CompanySettings, ORDER_DOCUMENT_LABELS } from '../../types';
import { updateOrderStatus } from '../../services/db';
import {
  downloadWindowsErpMacroScript,
  formatOrderRowsEnterSeparated,
  formatOrderRowsTabSeparated,
} from '../../lib/erpMacro';
import { CompleteOrderOperatorModal } from './CompleteOrderOperatorModal';

interface OrderDetailModalProps {
  order: Order;
  companySettings: CompanySettings;
  onClose: () => void;
  onOrderUpdated: (updated: Order) => void;
  onOpenPrint: (order: Order) => void;
  readOnly?: boolean;
  onEditOrder?: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  companySettings,
  onClose,
  onOrderUpdated,
  onOpenPrint,
  readOnly = false,
  onEditOrder,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCompleteOperatorModal, setShowCompleteOperatorModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedEnter, setCopiedEnter] = useState(false);
  const [showErpHelper, setShowErpHelper] = useState(false);
  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(`saggin_checked_items_${order.id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const toggleItemChecked = (itemId: string, forceValue?: boolean) => {
    setCheckedItemIds(prev => {
      const next = { ...prev, [itemId]: forceValue !== undefined ? forceValue : !prev[itemId] };
      try {
        localStorage.setItem(`saggin_checked_items_${currentOrder.id}`, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === currentOrder.status || isUpdating) return;
    if (newStatus === 'COMPLETATO') {
      setShowCompleteOperatorModal(true);
      return;
    }
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

  const handleConfirmComplete = async (operatorName: string) => {
    setIsUpdating(true);
    try {
      const updated = await updateOrderStatus(currentOrder.id, 'COMPLETATO', operatorName);
      setCurrentOrder(updated);
      onOrderUpdated(updated);
      setShowCompleteOperatorModal(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyCode = (code: string, itemId?: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    if (itemId && !readOnly) {
      toggleItemChecked(itemId, true);
    }
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handleCopyAllRows = () => {
    const text = formatOrderRowsTabSeparated(currentOrder.items);
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyEnterRows = () => {
    const text = formatOrderRowsEnterSeparated(currentOrder.items);
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedEnter(true);
    setTimeout(() => setCopiedEnter(false), 2000);
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

  const productItems = currentOrder.items.filter(i => i.line_type !== 'DESCRIPTION');
  const productItemsCount = productItems.length;
  const checkedProductsCount = productItems.filter(i => checkedItemIds[i.id]).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Top corporate bar */}
        <div className="h-1 w-full bg-red-600" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#0b0f19] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">
              {currentOrder.order_number}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-red-400" />
              <span>{formattedDate} · {formattedTime}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllRows}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition"
              title="Copia tutte le righe per incollarle nel gestionale o in Excel"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{copiedAll ? 'Righe Copiate!' : 'Copia Righe'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                handleCopyAllRows();
                setShowErpHelper(true);
              }}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-extrabold text-white flex items-center gap-1.5 transition shadow-xs"
              title="Inserimento automatico sul gestionale Windows (Invio + Freccia giù)"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Gestionale PC</span>
            </button>
            {onEditOrder && !readOnly && currentOrder.status !== 'COMPLETATO' && (
              <button
                type="button"
                onClick={() => {
                  onEditOrder(currentOrder);
                  onClose();
                }}
                className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-black text-slate-950 flex items-center gap-1.5 transition shadow-xs"
                title="Riapri l'ordine al magazzino per aggiungere o modificare articoli"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Modifica / Aggiungi</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenPrint(currentOrder)}
              className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-extrabold text-white flex items-center gap-1.5 transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stampa Distinta / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Reference & Status Control Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 block">
                Tipo Documento
              </span>
              <span className="inline-flex items-center gap-1.5 mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-black text-slate-900 shadow-2xs">
                <FileText className="w-3.5 h-3.5 text-red-600" />
                {currentOrder.document_type ? ORDER_DOCUMENT_LABELS[currentOrder.document_type] : 'DDT'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 block">
                Punto di Carico
              </span>
              <span className="inline-flex items-center gap-1.5 mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-black text-slate-900 shadow-2xs">
                <Warehouse className="w-3.5 h-3.5 text-slate-600" />
                {currentOrder.warehouse_location === 'DEPOSITO' ? 'Deposito' : 'Magazzino'}
              </span>
            </div>

            <div className="min-w-[200px]">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 block">
                Cliente / Riferimento Cantiere
              </span>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">
                {currentOrder.customer_reference || 'Carico diretto al banco'}
              </div>
            </div>
          </div>

          {/* Status Buttons */}
          {!readOnly && (
            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Stato Lavorazione Ufficio
              </span>
              <div className="inline-flex items-center gap-1 p-1 bg-slate-200/80 border border-slate-300/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleStatusChange('NUOVO')}
                  disabled={isUpdating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                    currentOrder.status === 'NUOVO'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  NUOVO
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('PRESO IN CARICO')}
                  disabled={isUpdating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                    currentOrder.status === 'PRESO IN CARICO'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  PRESO IN CARICO
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('COMPLETATO')}
                  disabled={isUpdating}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                    currentOrder.status === 'COMPLETATO'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  COMPLETATO
                </button>
              </div>
              {currentOrder.status === 'COMPLETATO' && currentOrder.completed_by && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Evaso da: {currentOrder.completed_by}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Snapshot Items Table */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Distinta Articoli ({productItemsCount} articoli · {currentOrder.items.length} righe)
              </h4>
              {!readOnly && productItemsCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  checkedProductsCount === productItemsCount
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  Inserite a gestionale: {checkedProductsCount}/{productItemsCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-[11px] text-slate-400 font-medium">
              Clicca sul codice per copiarlo e spuntare automaticamente la riga
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 font-mono font-extrabold text-slate-600 uppercase tracking-wider text-[10px]">
                  {!readOnly && <th className="py-2.5 px-3 w-11 text-center" title="Spunta riga inserita in fattura/DDT">✓</th>}
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-36">Codice Articolo</th>
                  <th className="py-2.5 px-3">Descrizione Materiale</th>
                  <th className="py-2.5 px-3 w-32">Cod. Alternativo</th>
                  <th className="py-2.5 px-3 w-20 text-center">U.M.</th>
                  <th className="py-2.5 px-3 w-28 text-right">Quantità</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {currentOrder.items.map((item, index) => {
                  const isChecked = Boolean(checkedItemIds[item.id]);
                  return (
                    <tr
                      key={item.id}
                      className={
                        item.line_type === 'DESCRIPTION'
                          ? 'bg-amber-50/70'
                          : isChecked
                          ? 'bg-emerald-50/40 transition'
                          : 'hover:bg-slate-50 transition'
                      }
                    >
                      {item.line_type === 'DESCRIPTION' ? (
                        <td colSpan={readOnly ? 6 : 7} className="py-3 px-4 text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                          <span className="mr-2 inline-flex items-center gap-1 rounded bg-amber-200/80 px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wide text-amber-950">
                            <AlignLeft className="w-3 h-3" /> Nota
                          </span>
                          {item.manual_description || item.product_description_snapshot}
                        </td>
                      ) : (
                        <>
                          {!readOnly && (
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleItemChecked(item.id)}
                                className={`w-5 h-5 rounded border flex items-center justify-center mx-auto transition ${
                                  isChecked
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-white border-slate-300 hover:border-slate-500'
                                }`}
                                title={isChecked ? 'Riga già inserita a gestionale' : 'Segna come inserita a gestionale'}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>
                            </td>
                          )}
                          <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold">
                            {index + 1}
                          </td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.product_code_snapshot, item.id)}
                              title="Clicca per copiare il codice e spuntare la riga"
                              className={`inline-flex items-center gap-1.5 font-mono font-black text-xs px-2.5 py-1 rounded transition ${
                                isChecked
                                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                  : 'bg-slate-900 hover:bg-red-600 text-white'
                              }`}
                            >
                              <span>{item.product_code_snapshot}</span>
                              {copiedCode === item.product_code_snapshot ? (
                                <Check className="w-3 h-3 text-emerald-300" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-60" />
                              )}
                            </button>
                          </td>
                          <td className={`py-3 px-3 font-bold text-xs sm:text-sm ${
                            isChecked ? 'text-emerald-950 line-through decoration-emerald-600/50' : 'text-slate-900'
                          }`}>
                            {item.product_description_snapshot}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {item.alternative_code_snapshot || '—'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-extrabold text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-800 uppercase">
                              {item.unit_of_measure_snapshot}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-base text-slate-900 tabular-nums">
                            {item.quantity}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
            ID: {currentOrder.id}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition"
          >
            Chiudi Scheda
          </button>
        </div>
      </div>

      {showCompleteOperatorModal && (
        <CompleteOrderOperatorModal
          order={currentOrder}
          onCancel={() => setShowCompleteOperatorModal(false)}
          onConfirm={handleConfirmComplete}
        />
      )}

      {showErpHelper && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="h-1 w-full bg-emerald-600" />
            <div className="p-4 sm:p-5 bg-[#0b0f19] text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight">
                    Incolla Veloce su Gestionale PC
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sequenza: Codice → Invio → Descrizione → Invio → U.M. → Invio → Q.tà → Freccia ↓
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowErpHelper(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm text-slate-700">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-950 space-y-2">
                <p className="font-extrabold text-emerald-900">
                  Come funziona (nessun programma da installare su Windows):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 font-medium">
                  <li>
                    Scarica una sola volta il file{' '}
                    <span className="font-mono font-bold">Saggin_Incolla_Gestionale.bat</span> e salvalo sul{' '}
                    <strong>Desktop</strong> del PC.
                  </li>
                  <li>
                    Quando devi inserire un ordine, clicca <strong>Copia Righe</strong> (già copiato ora!) e fai doppio clic sul file sul Desktop.
                  </li>
                  <li>
                    Hai <strong>4 secondi</strong> per cliccare nella casella <strong>Codice</strong> della prima riga del gestionale: compilerà tutto da solo!
                  </li>
                </ol>
              </div>

              <button
                type="button"
                onClick={downloadWindowsErpMacroScript}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Download className="w-4 h-4" />
                <span>Scarica Macro Windows (.bat)</span>
              </button>

              <div className="pt-2 border-t border-slate-200 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Copia manuale negli appunti
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllRows}
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                  >
                    {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAll ? 'Copiato (TAB)!' : 'Copia Righe (TAB)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyEnterRows}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                  >
                    {copiedEnter ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedEnter ? 'Copiato (Invio)!' : 'Copia con solo Invio (\\n)'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowErpHelper(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

