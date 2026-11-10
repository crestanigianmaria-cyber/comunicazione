import React from 'react';
import { Printer, X, Download } from 'lucide-react';
import { Order, CompanySettings } from '../../types';

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      {/* Container */}
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8">
        {/* Floating Action Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm text-white">Anteprima di Stampa / Esportazione PDF</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Stampa / Salva in PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document (Formatted for A4) */}
        <div className="p-8 sm:p-12 text-slate-900 bg-white font-sans text-sm printable-content">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                {companySettings.companyName || 'AZIENDA MATERIALI EDILI'}
              </h1>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                <p>{companySettings.legalName}</p>
                <p>{companySettings.address}</p>
                <p>P.IVA: <span className="font-mono">{companySettings.vatNumber}</span> · Tel: {companySettings.phone}</p>
                <p>{companySettings.email}</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                DISTINTA DI CARICO MAGAZZINO
              </span>
              <div className="text-2xl font-black font-mono tracking-wider text-slate-900 mt-0.5">
                {order.order_number}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-600">
                Data: <span className="font-bold font-mono">{formattedDate}</span> ore <span className="font-bold font-mono">{formattedTime}</span>
              </div>
              <div className="mt-1">
                <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                  STATO: {order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Customer / Jobsite Box */}
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 mb-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Riferimento Cliente / Destinazione / Cantiere
            </span>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {order.customer_reference || 'CARICO DIRETTO IN MAGAZZINO - CLIENTE AL BANCO'}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100">
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
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 text-center text-slate-400 font-mono">
                    {index + 1}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {item.product_code_snapshot}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900">
                    {item.product_description_snapshot}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-500">
                    {item.alternative_code_snapshot || '—'}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-700">
                    {item.unit_of_measure_snapshot}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                    {item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-bold text-xs bg-slate-50">
                <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-slate-600">
                  Totale Righe Caricate:
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-900">
                  {order.items.length} articoli
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Notes and Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 mt-12 print-break-inside-avoid">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Note Documento Interno
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {companySettings.notes || 'Materiale caricato su automezzo del cliente. Verificato da operatore di magazzino.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-8">
                  Firma Operatore Magazzino
                </span>
                <div className="border-b border-slate-400 w-full" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-8">
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
