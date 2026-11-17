import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Upload,
  Download,
  FileDown,
  Package,
  Trash2,
  AlertTriangle,
  X,
  QrCode,
  CheckSquare,
  Square,
  Printer,
  Plus
} from 'lucide-react';
import { Product, CompanySettings } from '../../types';
import { searchProducts } from '../../lib/search';
import { downloadSampleExcel, exportCatalogToExcel } from '../../services/excel';
import { clearAllProducts } from '../../services/db';
import { ProductQrModal } from './ProductQrModal';
import { BatchQrPrintModal } from './BatchQrPrintModal';

interface OfficeCatalogViewProps {
  products: Product[];
  onOpenExcelImport: () => void;
  companySettings?: CompanySettings;
}

export const OfficeCatalogView: React.FC<OfficeCatalogViewProps> = ({
  products,
  onOpenExcelImport,
  companySettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedQrProduct, setSelectedQrProduct] = useState<Product | null>(null);
  const [selectedProductCodes, setSelectedProductCodes] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Range selector inputs ("Da riga X a riga Y")
  const [rangeStart, setRangeStart] = useState<string>('1');
  const [rangeEnd, setRangeEnd] = useState<string>('20');

  // Drag & Shift+Click selection refs
  const lastClickedIdxRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragModeRef = useRef<boolean>(true);

  useEffect(() => {
    const stopDrag = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', stopDrag);
    return () => window.removeEventListener('mouseup', stopDrag);
  }, []);

  const filteredProducts = useMemo(() => {
    return searchProducts(products, searchQuery, 1000);
  }, [products, searchQuery]);

  // Additive quick preset selections
  const handleSelectQuickFilter = (type: 'acciai' | 'mapei' | 'all-filtered' | 'clear') => {
    if (type === 'clear') {
      setSelectedProductCodes(new Set());
      return;
    }
    if (type === 'all-filtered') {
      setSelectedProductCodes((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.add(p.code));
        return next;
      });
      return;
    }
    if (type === 'acciai') {
      const matched = products.filter((p) => {
        const desc = p.description.toLowerCase();
        const code = p.code.toLowerCase();
        return (
          code.includes('acc') ||
          desc.includes('acc') ||
          desc.includes('tubo') ||
          desc.includes('curva') ||
          desc.includes('ferro') ||
          desc.includes('rete elettrosaldata') ||
          desc.includes('trave') ||
          desc.includes('scatolare') ||
          desc.includes('tondo')
        );
      });
      setSelectedProductCodes((prev) => {
        const next = new Set(prev);
        matched.forEach((p) => next.add(p.code));
        return next;
      });
      return;
    }
    if (type === 'mapei') {
      const matched = products.filter((p) => {
        const text = (p.description + ' ' + p.code + ' ' + (p.alternative_code || '')).toLowerCase();
        return text.includes('mapei') || text.includes('keraflex');
      });
      setSelectedProductCodes((prev) => {
        const next = new Set(prev);
        matched.forEach((p) => next.add(p.code));
        return next;
      });
      return;
    }
  };

  // Select contiguous block by row number (1-indexed)
  const handleSelectRange = () => {
    const s = Math.max(1, parseInt(rangeStart, 10) || 1) - 1;
    const e = Math.min(filteredProducts.length, parseInt(rangeEnd, 10) || filteredProducts.length) - 1;
    if (s > e) return;
    setSelectedProductCodes((prev) => {
      const next = new Set(prev);
      for (let i = s; i <= e; i++) {
        if (filteredProducts[i]) next.add(filteredProducts[i].code);
      }
      return next;
    });
  };

  // Mouse Down on row: supports Shift+Click block selection and Click+Drag start
  const handleRowMouseDown = (index: number, code: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();

    const currentlySelected = selectedProductCodes.has(code);
    const nextState = !currentlySelected;

    if (e.shiftKey && lastClickedIdxRef.current !== null) {
      const start = Math.min(lastClickedIdxRef.current, index);
      const end = Math.max(lastClickedIdxRef.current, index);
      setSelectedProductCodes((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          const item = filteredProducts[i];
          if (item) {
            if (nextState) next.add(item.code);
            else next.delete(item.code);
          }
        }
        return next;
      });
    } else {
      isDraggingRef.current = true;
      dragModeRef.current = nextState;
      setSelectedProductCodes((prev) => {
        const next = new Set(prev);
        if (nextState) next.add(code);
        else next.delete(code);
        return next;
      });
    }

    lastClickedIdxRef.current = index;
  };

  // Mouse Enter while holding left click ("uno sopra l'altro" drag selection)
  const handleRowMouseEnter = (index: number, code: string) => {
    if (!isDraggingRef.current) return;
    setSelectedProductCodes((prev) => {
      const next = new Set(prev);
      if (dragModeRef.current) next.add(code);
      else next.delete(code);
      return next;
    });
    lastClickedIdxRef.current = index;
  };

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
            <strong className="font-mono text-slate-800">{products.length}</strong> referenze a catalogo · Trascina col mouse sulle righe o usa Shift+Click per selezionare blocchi di articoli da stampare in QR.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {products.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBatchModal(true)}
              className={`px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition shadow-sm cursor-pointer ${
                selectedProductCodes.size > 0
                  ? 'bg-slate-900 text-white hover:bg-slate-800 ring-2 ring-red-600'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
              title="Apri l'impaginatore A4 QR Code con taglio per taglierina"
            >
              <Printer className="w-4 h-4 text-red-500 stroke-[2.5]" />
              <span>
                Impaginatore QR A4 {selectedProductCodes.size > 0 ? `(${selectedProductCodes.size})` : ''}
              </span>
            </button>
          )}

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

      {/* Catalog Search, Multi-Select Toolbar & Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Search Input Bar + Quick Additive Selection Buttons */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Cerca es. "acc", "curva", "tubo", "mapei" o codice...'
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

            {/* Quick Additive Group Selection Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mr-1">
                Aggiungi Rapido:
              </span>
              <button
                type="button"
                onClick={() => handleSelectQuickFilter('acciai')}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 font-bold text-slate-800 text-[11px] flex items-center gap-1 transition cursor-pointer"
                title="Aggiungi tutti gli acciai (tubi, curve, travi, tondi c.a., reti)"
              >
                <Plus className="w-3 h-3 text-red-600 stroke-[3]" />
                <span>Acciai / Tubi / Curve</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickFilter('mapei')}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 font-bold text-slate-800 text-[11px] flex items-center gap-1 transition cursor-pointer"
                title="Aggiungi tutti gli articoli Mapei"
              >
                <Plus className="w-3 h-3 text-red-600 stroke-[3]" />
                <span>Articoli Mapei</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickFilter('all-filtered')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400 stroke-[3]" />
                <span>Aggiungi Filtrati ({filteredProducts.length})</span>
              </button>
              {selectedProductCodes.size > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectQuickFilter('clear')}
                  className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-mono font-black text-[11px] transition cursor-pointer"
                >
                  Azzera ({selectedProductCodes.size})
                </button>
              )}
            </div>
          </div>

          {/* Row Interval Selector + Drag Hint */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600">
                Seleziona Blocco Consecutivo da riga #:
              </span>
              <input
                type="number"
                min={1}
                max={filteredProducts.length || 1}
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-16 h-7 px-2 bg-white border border-slate-300 rounded-md font-mono font-bold text-center text-slate-900"
              />
              <span className="text-[11px] font-bold text-slate-600">a riga #:</span>
              <input
                type="number"
                min={1}
                max={filteredProducts.length || 1}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-16 h-7 px-2 bg-white border border-slate-300 rounded-md font-mono font-bold text-center text-slate-900"
              />
              <button
                type="button"
                onClick={handleSelectRange}
                className="px-3 h-7 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] transition cursor-pointer"
              >
                Seleziona Intervallo
              </button>
            </div>

            <span className="text-[11px] text-slate-500 font-medium">
              💡 <strong>Suggerimento</strong>: tieni premuto il mouse e trascina dall'alto in basso (o usa <strong>Shift + Click</strong>) per selezionare più righe una sopra l'altra.
            </span>
          </div>
        </div>

        {/* Selected Sticky Action Bar */}
        {selectedProductCodes.size > 0 && (
          <div className="px-4 py-3 bg-[#0b0f19] text-white flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-extrabold text-sm">
                {selectedProductCodes.size}{' '}
                {selectedProductCodes.size === 1
                  ? 'articolo pronto in coda di stampa'
                  : 'articoli pronti in coda di stampa'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-black text-white text-xs flex items-center gap-2 transition shadow-md shadow-red-600/25 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>APRI IMPAGINATORE A4 & SALVA PDF ({selectedProductCodes.size})</span>
              </button>
            </div>
          </div>
        )}

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
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        filteredProducts.every((p) => selectedProductCodes.has(p.code))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleSelectQuickFilter('all-filtered');
                        } else {
                          setSelectedProductCodes((prev) => {
                            const next = new Set(prev);
                            filteredProducts.forEach((p) => next.delete(p.code));
                            return next;
                          });
                        }
                      }}
                      className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                      title="Seleziona o deseleziona tutti gli articoli visualizzati"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-40">Codice Articolo (Col. A)</th>
                  <th className="py-3 px-4">Descrizione Materiale Completa (Col. B)</th>
                  <th className="py-3 px-4 w-40">Cod. Alternativo (Col. N)</th>
                  <th className="py-3 px-4 w-20 text-center">U.M.</th>
                  <th className="py-3 px-4 w-28 text-center">Etichetta QR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredProducts.map((p, idx) => {
                  const isSelected = selectedProductCodes.has(p.code);
                  return (
                    <tr
                      key={p.code}
                      onMouseDown={(e) => handleRowMouseDown(idx, p.code, e)}
                      onMouseEnter={() => handleRowMouseEnter(idx, p.code)}
                      className={`cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-red-50/80 hover:bg-red-100/60'
                          : 'hover:bg-slate-50/90'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-600 mx-auto" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 mx-auto" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`font-mono font-black text-xs px-2.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
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
                      <td
                        className="py-2.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedQrProduct(p)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-red-600 hover:text-white text-slate-700 font-mono text-[11px] font-bold border border-slate-200 transition cursor-pointer"
                          title={`Genera e stampa etichetta singola per ${p.code}`}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR Singolo</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Single QR Code Modal */}
      {selectedQrProduct && (
        <ProductQrModal
          product={selectedQrProduct}
          companySettings={
            companySettings || {
              companyName: 'SAGGIN',
              legalName: '',
              address: '',
              vatNumber: '',
              phone: '',
              email: '',
              notes: '',
            }
          }
          onClose={() => setSelectedQrProduct(null)}
        />
      )}

      {/* Batch QR Multi-Label Print & Layout Modal */}
      {showBatchModal && (
        <BatchQrPrintModal
          allCatalogProducts={products}
          selectedCodes={selectedProductCodes}
          onUpdateSelectedCodes={setSelectedProductCodes}
          companySettings={
            companySettings || {
              companyName: 'SAGGIN',
              legalName: '',
              address: '',
              vatNumber: '',
              phone: '',
              email: '',
              notes: '',
            }
          }
          onClose={() => setShowBatchModal(false)}
        />
      )}
    </div>
  );
};
