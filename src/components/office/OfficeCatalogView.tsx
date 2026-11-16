import React, { useState, useMemo } from 'react';
import {
  Search,
  Upload,
  Download,
  FileDown,
  Package,
  Trash2,
  AlertTriangle,
  X
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
      <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">
              Anagrafica Listino Articoli Saggin
            </h2>
            <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-mono font-bold uppercase">
              Cloud Sync Attivo
            </span>
          </div>
          <p className="text-xs text-slate-500">
            <strong className="font-mono text-slate-800">{products.length}</strong> referenze a catalogo · Condivise in tempo reale con i terminali di magazzino e deposito.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-2 rounded-lg bg-white hover:bg-red-50 hover:border-red-200 border border-slate-300 text-slate-600 hover:text-red-600 text-xs font-bold flex items-center gap-1.5 transition"
              title="Svuota l'intero catalogo articoli"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Svuota Listino</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => downloadSampleExcel()}
            className="px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="Scarica tracciato Excel di esempio"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Tracciato ARTICOLI.xlsx</span>
          </button>

          <button
            type="button"
            onClick={() => exportCatalogToExcel(products)}
            className="px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            title="Esporta tutti gli articoli in Excel"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-600" />
            <span>Esporta Excel ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={onOpenExcelImport}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <Upload className="w-4 h-4" />
            <span>Importa Listino Excel</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Clear Catalog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Confermi lo svuotamento del listino?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Questa operazione rimuoverà tutti i {products.length} articoli presenti a catalogo, permettendoti di importare da zero un nuovo file Excel aziendale. Gli ordini storici rimarranno intatti.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold transition shadow-xs"
              >
                Conferma Svuotamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Search & Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per codice articolo, descrizione o codice alternativo..."
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
          <span className="text-[11px] font-mono text-slate-500">
            Visualizzati: <strong>{filteredProducts.length}</strong> di {products.length}
          </span>
        </div>

        {/* Products Table */}
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Package className="w-10 h-10 stroke-[1.5] mx-auto mb-2 text-slate-300" />
            <h4 className="text-sm font-extrabold text-slate-700">Nessun articolo trovato</h4>
            <p className="text-xs text-slate-400 mt-1">
              Modifica i termini di ricerca o importa un file Excel aggiornato.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-mono font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-14 text-center">#</th>
                  <th className="py-3 px-4 w-44">Codice Articolo (Col. A)</th>
                  <th className="py-3 px-4">Descrizione Materiale (Col. B)</th>
                  <th className="py-3 px-4 w-44">Cod. Alternativo (Col. N)</th>
                  <th className="py-3 px-4 w-24 text-center">U.M.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredProducts.map((p, idx) => (
                  <tr key={p.code} className="hover:bg-slate-50/90 transition">
                    <td className="py-2.5 px-4 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-black text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded">
                        {p.code}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {p.description}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {p.alternative_code || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="font-mono font-extrabold text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-800 uppercase">
                        {p.unit_of_measure}
                      </span>
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

