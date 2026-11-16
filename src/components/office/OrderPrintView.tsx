import React from 'react';
import { Printer, X } from 'lucide-react';
import { Order, CompanySettings, ORDER_DOCUMENT_LABELS } from '../../types';

interface OrderPrintViewProps {
  order: Order;
  companySettings: CompanySettings;
  onClose: () => void;
}

export const OrderPrintView: React.FC<OrderPrintViewProps> = ({
  order,
  companySettings,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(order.created_at).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedTime = new Date(order.created_at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      {/* Container */}
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 border border-slate-200">
        {/* Top corporate bar (Hidden in Print) */}
        <div className="h-1 w-full bg-red-600 no-print" />

        {/* Floating Action Bar (Hidden in Print) */}
        <div className="p-4 bg-[#0b0f19] text-white flex items-center justify-between no-print border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-red-500" />
            <h3 className="font-extrabold text-sm text-white">
              Anteprima di Stampa A4 / Esportazione PDF
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>Stampa / Salva PDF</span>
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

        {/* Printable Document (Formatted for A4) */}
        <div className="p-8 sm:p-12 text-slate-900 bg-white font-sans text-sm printable-content">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-start gap-4">
              <img
                src="/saggin-logo.png"
                alt="Saggin Guglielmo S.R.L."
                className="w-24 h-16 object-contain shrink-0"
              />
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {companySettings.companyName || 'SAGGIN GUGLIELMO S.R.L.'}
                </h1>
                <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                  <p className="font-bold text-slate-800">{companySettings.legalName}</p>
                  <p>{companySettings.address}</p>
                  <p>
                    P.IVA: <span className="font-mono font-semibold">{companySettings.vatNumber}</span> · Tel: {companySettings.phone}
                  </p>
                  <p>{companySettings.email}</p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-500 block">
                {order.document_type ? ORDER_DOCUMENT_LABELS[order.document_type].toUpperCase() : 'DDT'} · DISTINTA DI CARICO
              </span>
              <div className="text-2xl font-black font-mono tracking-wider text-slate-900 mt-0.5">
                {order.order_number}
              </div>
              <div className="mt-1.5 text-xs font-medium text-slate-600">
                Data: <span className="font-bold font-mono">{formattedDate}</span> ore <span className="font-bold font-mono">{formattedTime}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-end gap-1.5">
                <span className="inline-block text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                  SEDE: {order.warehouse_location === 'DEPOSITO' ? 'DEPOSITO' : 'MAGAZZINO'}
                </span>
                <span className="inline-block text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                  {order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Customer / Jobsite Box */}
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 mb-6 grid grid-cols-3 gap-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Documento Richiesto
              </span>
              <div className="text-sm font-black text-slate-900 mt-0.5 uppercase">
                {order.document_type ? ORDER_DOCUMENT_LABELS[order.document_type] : 'DDT'}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Punto di Carico
              </span>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {order.warehouse_location === 'DEPOSITO' ? 'Deposito' : 'Magazzino'}
              </div>
            </div>
            <div className="col-span-3 pt-2 border-t border-slate-200">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Riferimento Cliente / Destinazione / Cantiere / Targa
              </span>
              <div className="text-base font-black text-slate-900 mt-0.5">
                {order.customer_reference || 'CARICO DIRETTO IN MAGAZZINO - CLIENTE AL BANCO'}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-700 bg-slate-100">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-32">Codice</th>
                <th className="py-2.5 px-3">Descrizione Materiale Caricato</th>
                <th className="py-2.5 px-3 w-28">Cod. Alt.</th>
                <th className="py-2.5 px-3 w-20 text-center">U.M.</th>
                <th className="py-2.5 px-3 w-28 text-right">Quantità</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {order.items.map((item, index) => (
                <tr key={item.id} className={item.line_type === 'DESCRIPTION' ? 'bg-amber-50 print:bg-transparent' : ''}>
                  {item.line_type === 'DESCRIPTION' ? (
                    <td colSpan={6} className="py-3 px-3 text-sm font-semibold text-slate-800 whitespace-pre-wrap">
                      <span className="mr-2 text-[9px] font-mono font-black uppercase tracking-wider text-slate-500">
                        [NOTA]
                      </span>
                      {item.manual_description || item.product_description_snapshot}
                    </td>
                  ) : (
                    <>
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">{item.product_code_snapshot}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{item.product_description_snapshot}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{item.alternative_code_snapshot || '—'}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">{item.unit_of_measure_snapshot}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm tabular-nums">{item.quantity}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-bold text-xs bg-slate-50">
                <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-slate-600">
                  Totale Articoli Caricati:
                </td>
                <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                  {order.items.filter(item => item.line_type !== 'DESCRIPTION').length} articoli
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Notes and Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 mt-12 print-break-inside-avoid">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Note Documento Interno
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {companySettings.notes || 'Materiale caricato su automezzo del cliente. Verificato da operatore di magazzino.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-8">
                  Firma Operatore Magazzino
                </span>
                <div className="border-b border-slate-400 w-full" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-8">
                  Firma Cliente per Ritiro
                </span>
                <div className="border-b border-slate-400 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

