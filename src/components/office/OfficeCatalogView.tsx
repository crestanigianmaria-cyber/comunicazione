import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Upload,
  Download,
  FileDown,
  Package,
  Layers,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Product } from '../../types';
import { searchProducts } from '../../lib/search';
import { downloadSampleExcel, exportCatalogToExcel } from '../../services/excel';
import { clearAllProducts } from '../../services/db';

interface OfficeCatalogViewProps {
  products: Product[];
  onOpenExcelImport: () => void;
}

export const OfficeCatalogView: React.FC<OfficeCatalogViewProps> = ({
  products,
  onOpenExcelImport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredProducts = useMemo(() => {
    return searchProducts(products, searchQuery, 500);
  }, [products, searchQuery]);

  const handleClearConfirm = async () => {
    await clearAllProducts();
    setShowClearConfirm(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Actions */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <h2 className="text-base font-extrabold text-slate-900 uppercase">
              Catalogo Articoli Magazzino
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            {products.length} articoli registrati nel database · Colonne A (Codice), B (Descrizione), UM (Unità di Misura), N (Cod. Alternativo).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {products.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:border-red-200 border border-slate-200 text-slate-600 hover:text-red-600 text-xs font-bold flex items-center gap-1.5 transition"
              title="Svuota il catalogo (es. per rimuovere i dati di prova prima di caricare il file reale)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Svuota Catalogo</span>
            </button>
          )}

          <button
            onClick={() => downloadSampleExcel()}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="Scarica file Excel di esempio con le colonne previste"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Modello ARTICOLI.xlsx</span>
          </button>

          <button
            onClick={() => exportCatalogToExcel(products)}
            className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="Esporta tutti gli articoli attuali in formato Excel"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-600" />
            <span>Esporta Catalogo ({products.length})</span>
          </button>

          <button
            onClick={onOpenExcelImport}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition"
          >
            <Upload className="w-4 h-4" />
            <span>Importa da Excel (SheetJS)</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Clear Catalog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Vuoi svuotare il catalogo articoli?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Questa azione cancellerà tutti i {products.length} articoli attualmente registrati nel database (inclusi i dati dimostrativi iniziali), consentendoti di caricare da zero il tuo file Excel aziendale reale senza mescolare gli articoli.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                Annulla
              </button>
              <button
                onClick={handleClearConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-sm"
              >
                Sì, Svuota Catalogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Search & Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per codice con zeri iniziali, descrizione o barcode..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Products Table */}
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Package className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-300" />
            <h4 className="text-sm font-bold text-slate-700">Nessun articolo trovato</h4>
            <p className="text-xs text-slate-400 mt-1">
              Prova con un termine di ricerca differente o importa un nuovo file Excel.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-14 text-center">#</th>
                  <th className="py-3 px-4 w-40">Codice (Col. A)</th>
                  <th className="py-3 px-4">Descrizione (Col. B)</th>
                  <th className="py-3 px-4 w-40">Codice Alternativo (Col. N)</th>
                  <th className="py-3 px-4 w-24 text-center">UM (Col. UM)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p, idx) => (
                  <tr key={p.code} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                        {p.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {p.description}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {p.alternative_code || '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-blue-700 uppercase">
                      {p.unit_of_measure}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
