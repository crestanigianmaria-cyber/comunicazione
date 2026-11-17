import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Printer,
  Download,
  X,
  QrCode,
  Check,
  Scissors,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  FileDown,
  Layers,
  Tag
} from 'lucide-react';
import { Product, CompanySettings } from '../../types';
import { searchProducts } from '../../lib/search';
import {
  QR_SHEET_PRESETS,
  QrSheetPresetId,
  QrRenderOptions,
  renderA4SheetToCanvas,
  downloadQrSheetsAsPdf,
  printQrSheetsDirectly,
} from '../../lib/qrSheetGenerator';
import {
  renderProductDymoSheetCanvas,
  printDymoCanvasesBatch,
  DYMO_PRODUCT_LAYOUTS,
  DymoProductLayout,
} from '../../lib/dymoPrinter';

interface BatchQrPrintModalProps {
  allCatalogProducts: Product[];
  selectedCodes: Set<string>;
  onUpdateSelectedCodes: (next: Set<string>) => void;
  companySettings: CompanySettings;
  onClose: () => void;
}

export const BatchQrPrintModal: React.FC<BatchQrPrintModalProps> = ({
  allCatalogProducts,
  selectedCodes,
  onUpdateSelectedCodes,
  companySettings,
  onClose,
}) => {
  // Target mode: A4 vs DYMO 99015 (70x54 mm)
  const [printTarget, setPrintTarget] = useState<'A4' | 'DYMO'>('A4');
  const [dymoLayout, setDymoLayout] = useState<DymoProductLayout>('6_ferramenta');

  // Print & Layout options (A4)
  const [presetId, setPresetId] = useState<QrSheetPresetId>('qr_3x3_20');
  const [showHeaderLogo, setShowHeaderLogo] = useState(true);
  const [showLogoInQrCenter, setShowLogoInQrCenter] = useState(true);
  const [showUnitBadge, setShowUnitBadge] = useState(true);
  const [showCutLines, setShowCutLines] = useState(true);
  const [darkHeaderStyle, setDarkHeaderStyle] = useState(true);

  // Fast list sidebar state
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [rangeStart, setRangeStart] = useState<string>('1');
  const [rangeEnd, setRangeEnd] = useState<string>('20');
  const lastClickedIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragTargetValueRef = useRef<boolean>(true);

  // Pagination & Preview state
  const [currentPage, setCurrentPage] = useState(0);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingDymo, setIsPrintingDymo] = useState(false);

  // Stop mouse drag selection when mouse button is released anywhere
  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Filtered catalog list inside the fast selector sidebar
  const filteredCatalog = useMemo(() => {
    return searchProducts(allCatalogProducts, sidebarSearch, 1000);
  }, [allCatalogProducts, sidebarSearch]);

  // Resolved list of products to print (in catalog order)
  const productsToPrint = useMemo(() => {
    if (selectedCodes.size === 0) return [];
    return allCatalogProducts.filter((p) => selectedCodes.has(p.code));
  }, [allCatalogProducts, selectedCodes]);

  const activePreset = useMemo(
    () => QR_SHEET_PRESETS.find((p) => p.id === presetId) || QR_SHEET_PRESETS[0],
    [presetId]
  );

  const activeDymoLayout = useMemo(
    () => DYMO_PRODUCT_LAYOUTS.find((l) => l.id === dymoLayout) || DYMO_PRODUCT_LAYOUTS[0],
    [dymoLayout]
  );

  const itemsPerPage =
    printTarget === 'DYMO'
      ? activeDymoLayout.slotsPerLabel
      : activePreset.cols * activePreset.rows;
  const totalPages = Math.max(1, Math.ceil(productsToPrint.length / itemsPerPage));

  // Keep currentPage within bounds
  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentPage]);

  const renderOptions: QrRenderOptions = useMemo(
    () => ({
      presetId,
      showHeaderLogo,
      showLogoInQrCenter,
      showUnitBadge,
      showCutLines,
      darkHeaderStyle,
      companyName: companySettings.companyName || 'SAGGIN GUGLIELMO S.R.L.',
    }),
    [
      presetId,
      showHeaderLogo,
      showLogoInQrCenter,
      showUnitBadge,
      showCutLines,
      darkHeaderStyle,
      companySettings.companyName,
    ]
  );

  // Render live A4 or DYMO 70x54 preview whenever page, products, or options change
  useEffect(() => {
    let isMounted = true;
    if (productsToPrint.length === 0) {
      setPreviewDataUrl('');
      return;
    }

    setIsRenderingPreview(true);
    const pageSlice = productsToPrint.slice(
      currentPage * itemsPerPage,
      (currentPage + 1) * itemsPerPage
    );

    const renderPromise =
      printTarget === 'DYMO'
        ? renderProductDymoSheetCanvas(pageSlice, dymoLayout, '70x54')
        : renderA4SheetToCanvas(
            pageSlice,
            currentPage,
            totalPages,
            productsToPrint.length,
            renderOptions
          );

    renderPromise
      .then((canvas) => {
        if (isMounted) {
          setPreviewDataUrl(canvas.toDataURL('image/png'));
          setIsRenderingPreview(false);
        }
      })
      .catch((err) => {
        console.error('Error rendering preview:', err);
        if (isMounted) setIsRenderingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productsToPrint, currentPage, totalPages, itemsPerPage, renderOptions, printTarget, dymoLayout]);

  // Handle single click, Shift+Click range selection, or drag start
  const handleItemMouseDown = (index: number, code: string, e: React.MouseEvent) => {
    e.preventDefault();
    const currentlySelected = selectedCodes.has(code);
    const targetState = !currentlySelected;

    if (e.shiftKey && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const next = new Set(selectedCodes);
      for (let i = start; i <= end; i++) {
        const item = filteredCatalog[i];
        if (item) {
          if (targetState) next.add(item.code);
          else next.delete(item.code);
        }
      }
      onUpdateSelectedCodes(next);
    } else {
      isDraggingRef.current = true;
      dragTargetValueRef.current = targetState;
      const next = new Set(selectedCodes);
      if (targetState) next.add(code);
      else next.delete(code);
      onUpdateSelectedCodes(next);
    }

    lastClickedIndexRef.current = index;
  };

  // Handle mouse drag over contiguous items ("uno sopra l'altro")
  const handleItemMouseEnter = (index: number, code: string) => {
    if (!isDraggingRef.current) return;
    const next = new Set(selectedCodes);
    if (dragTargetValueRef.current) {
      next.add(code);
    } else {
      next.delete(code);
    }
    onUpdateSelectedCodes(next);
    lastClickedIndexRef.current = index;
  };

  // Select contiguous range by row numbers (1-indexed)
  const handleSelectRange = () => {
    const startIdx = Math.max(1, parseInt(rangeStart, 10) || 1) - 1;
    const endIdx = Math.min(filteredCatalog.length, parseInt(rangeEnd, 10) || filteredCatalog.length) - 1;
    if (startIdx > endIdx) return;

    const next = new Set(selectedCodes);
    for (let i = startIdx; i <= endIdx; i++) {
      if (filteredCatalog[i]) {
        next.add(filteredCatalog[i].code);
      }
    }
    onUpdateSelectedCodes(next);
  };

  // Add all currently filtered items to selection
  const handleAddFilteredToSelection = () => {
    const next = new Set(selectedCodes);
    filteredCatalog.forEach((p) => next.add(p.code));
    onUpdateSelectedCodes(next);
  };

  // Remove all currently filtered items from selection
  const handleRemoveFilteredFromSelection = () => {
    const next = new Set(selectedCodes);
    filteredCatalog.forEach((p) => next.delete(p.code));
    onUpdateSelectedCodes(next);
  };

  const handleDownloadPdf = async () => {
    if (productsToPrint.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      await downloadQrSheetsAsPdf(
        productsToPrint,
        renderOptions,
        `Etichette_QR_Saggin_${activePreset.qrSizeCm.replace(/[^a-zA-Z0-9]/g, '')}_${productsToPrint.length}art_${dateStr}.pdf`
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDirectPrint = async () => {
    if (productsToPrint.length === 0 || isPrinting) return;
    setIsPrinting(true);
    try {
      await printQrSheetsDirectly(productsToPrint, renderOptions);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintDymoBatch = async () => {
    if (productsToPrint.length === 0 || isPrintingDymo) return;
    setIsPrintingDymo(true);
    try {
      const slots = activeDymoLayout.slotsPerLabel;
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < productsToPrint.length; i += slots) {
        const chunk = productsToPrint.slice(i, i + slots);
        const c = await renderProductDymoSheetCanvas(chunk, dymoLayout, '70x54');
        canvases.push(c);
      }
      await printDymoCanvasesBatch(canvases, '70x54');
    } finally {
      setIsPrintingDymo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 select-none">
      <div className="bg-white w-full max-w-[1400px] h-[95vh] rounded-2xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col">
        {/* Top Corporate Red Accent */}
        <div className="h-1.5 w-full bg-red-600 shrink-0" />

        {/* Header Bar */}
        <div className="px-4 py-3 bg-[#0b0f19] text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <QrCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white">
                  {printTarget === 'DYMO'
                    ? 'Stampa Etichette DYMO 99015 (70×54 mm)'
                    : 'Impaginatore A4 Etichette QR Code · Pronto per Taglierina'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-mono text-[11px] font-black">
                  {productsToPrint.length} ARTICOLI ({totalPages}{' '}
                  {printTarget === 'DYMO'
                    ? totalPages === 1
                      ? 'ETICHETTA'
                      : 'ETICHETTE'
                    : totalPages === 1
                    ? 'FOGLIO A4'
                    : 'FOGLI A4'}
                  )
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {printTarget === 'DYMO'
                  ? 'QR ad alto contrasto con logo Saggin e descrizione articolo, pronti per stampa termica DYMO 70×54 mm'
                  : 'Nome articolo sempre completo (zero tagli), logo Saggin integrato e griglia a taglio unico continuo per taglierina'}
              </p>
            </div>
          </div>

          {/* Mode Switch + Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* A4 vs DYMO 99015 Mode Toggle */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setPrintTarget('A4');
                  setCurrentPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
                  printTarget === 'A4'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Fogli A4
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintTarget('DYMO');
                  setCurrentPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer ${
                  printTarget === 'DYMO'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                DYMO 99015
              </button>
            </div>

            {printTarget === 'DYMO' ? (
              <button
                type="button"
                onClick={handlePrintDymoBatch}
                disabled={productsToPrint.length === 0 || isPrintingDymo}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black flex items-center gap-2 transition shadow-md disabled:opacity-40 cursor-pointer"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {isPrintingDymo
                    ? 'Preparazione DYMO...'
                    : `STAMPA ${totalPages} ${totalPages === 1 ? 'ETICHETTA' : 'ETICHETTE'} DYMO`}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={productsToPrint.length === 0 || isExportingPdf}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black flex items-center gap-2 transition shadow-md shadow-emerald-600/20 disabled:opacity-40 cursor-pointer"
                >
                  <FileDown className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isExportingPdf ? 'Generazione PDF...' : 'SCARICA PDF A4 (.pdf)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectPrint}
                  disabled={productsToPrint.length === 0 || isPrinting}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-black flex items-center gap-2 transition shadow-md shadow-red-600/25 disabled:opacity-40 cursor-pointer"
                >
                  <Printer className="w-4 h-4 stroke-[2.5]" />
                  <span>{isPrinting ? 'Preparazione...' : 'STAMPA FOGLI A4'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Bar: QR Size Presets / DYMO Layouts & Visual Toggles */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {printTarget === 'DYMO' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono font-extrabold text-slate-500 uppercase mr-1">
                Formato DYMO 99015 (70×54 mm):
              </span>
              {DYMO_PRODUCT_LAYOUTS.map((layout) => {
                const active = dymoLayout === layout.id;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => {
                      setDymoLayout(layout.id);
                      setCurrentPage(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] transition cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs ring-2 ring-amber-500/60'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                    title={layout.description}
                  >
                    {layout.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono font-extrabold text-slate-500 uppercase mr-1">
                Formato & Dimensione QR:
              </span>
              {QR_SHEET_PRESETS.map((preset) => {
                const active = presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPresetId(preset.id)}
                    className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] transition cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs ring-2 ring-red-600/40'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                    title={preset.description}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Style Options */}
          <div className="flex flex-wrap items-center gap-3.5 text-[11px]">
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={showLogoInQrCenter}
                onChange={(e) => setShowLogoInQrCenter(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>Logo dentro QR</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={showHeaderLogo}
                onChange={(e) => setShowHeaderLogo(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>Logo in Testata</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={darkHeaderStyle}
                onChange={(e) => setDarkHeaderStyle(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>Testata Nera Saggin</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={showCutLines}
                onChange={(e) => setShowCutLines(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span className="inline-flex items-center gap-1 text-red-700">
                <Scissors className="w-3.5 h-3.5" />
                Guide Taglierina
              </span>
            </label>
          </div>
        </div>

        {/* Main Workspace: Left Fast List Selector + Right Live A4 Sheet Preview */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* LEFT PANEL: ULTRA-FAST CONTIGUOUS ARTICLE SELECTOR */}
          <div className="w-full lg:w-[440px] border-r border-slate-200 bg-white flex flex-col min-h-0 shrink-0">
            {/* Search & Quick Batch Actions */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-slate-700">
                  1. Selezione Veloce Articoli ({filteredCatalog.length})
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  Trascina col mouse o usa Shift+Click
                </span>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  placeholder='Filtra es. "acc", "curva", "tubo", "mapei"...'
                  className="w-full h-9 pl-9 pr-8 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                />
                {sidebarSearch && (
                  <button
                    type="button"
                    onClick={() => setSidebarSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Add/Remove Filtered Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddFilteredToSelection}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Aggiunge tutti gli articoli attualmente filtrati alla coda di stampa"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                  <span>Aggiungi Filtrati ({filteredCatalog.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveFilteredFromSelection}
                  className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                  title="Rimuove gli articoli filtrati dalla selezione"
                >
                  Rimuovi Filtrati
                </button>

                {selectedCodes.size > 0 && (
                  <button
                    type="button"
                    onClick={() => onUpdateSelectedCodes(new Set())}
                    className="py-1.5 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] transition cursor-pointer"
                    title="Svuota tutta la selezione"
                  >
                    Svuota
                  </button>
                )}
              </div>

              {/* Range Selector: "Da riga X a riga Y" */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/80 text-[11px]">
                <span className="font-bold text-slate-500">Blocco da riga:</span>
                <input
                  type="number"
                  min={1}
                  max={filteredCatalog.length || 1}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="w-14 h-7 px-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-slate-900"
                />
                <span className="font-bold text-slate-500">a:</span>
                <input
                  type="number"
                  min={1}
                  max={filteredCatalog.length || 1}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="w-14 h-7 px-1.5 bg-white border border-slate-300 rounded text-center font-mono font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleSelectRange}
                  className="ml-auto px-2.5 h-7 rounded bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] transition cursor-pointer"
                >
                  Seleziona Blocco
                </button>
              </div>
            </div>

            {/* Contiguous Drag-Select Product List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredCatalog.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nessun articolo corrisponde a "{sidebarSearch}"
                </div>
              ) : (
                filteredCatalog.map((item, idx) => {
                  const isSelected = selectedCodes.has(item.code);
                  return (
                    <div
                      key={item.code}
                      onMouseDown={(e) => handleItemMouseDown(idx, item.code, e)}
                      onMouseEnter={() => handleItemMouseEnter(idx, item.code)}
                      className={`px-3 py-2 flex items-start gap-2.5 text-xs cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-red-50/90 hover:bg-red-100/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="pt-0.5 shrink-0 flex items-center gap-1.5">
                        <span className="w-6 text-right font-mono text-[10px] text-slate-400">
                          {idx + 1}
                        </span>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-red-600 fill-red-50" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-black text-[11px] px-1.5 py-0.2 rounded ${
                              isSelected
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            {item.code}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 rounded">
                            {item.unit_of_measure}
                          </span>
                        </div>
                        <p className="font-bold text-slate-800 text-[11px] leading-snug mt-0.5 break-words">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANEL: REAL A4 SHEET PREVIEW WITH GUILLOTINE CROP MARKS */}
          <div className="flex-1 bg-slate-200/80 flex flex-col min-h-0 overflow-hidden">
            {/* Sheet Pagination Bar */}
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-red-600" />
                <span className="font-bold text-slate-700">
                  {printTarget === 'DYMO'
                    ? `Anteprima Reale DYMO 99015 (${activeDymoLayout.description})`
                    : `Anteprima Reale Foglio A4 (${activePreset.description})`}
                </span>
              </div>

              {productsToPrint.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="p-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono font-black text-slate-900 text-xs px-2">
                    {printTarget === 'DYMO' ? 'Etichetta' : 'Foglio'} {currentPage + 1} di {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                    }
                    disabled={currentPage >= totalPages - 1}
                    className="p-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Canvas Sheet Preview Container */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
              {productsToPrint.length === 0 ? (
                <div className="my-auto bg-white rounded-2xl p-10 text-center max-w-md border border-slate-300 shadow-sm">
                  <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
                  <h4 className="text-sm font-black text-slate-800">
                    Nessun Articolo in Coda di Stampa
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Usa la lista a sinistra per selezionare gli articoli: puoi{' '}
                    <strong>trascinare col mouse dall'alto in basso</strong> per
                    selezionarne tanti in fila, usare{' '}
                    <strong>Shift + Click</strong>, oppure filtrare (es. "acc" o
                    "mapei") e premere <strong>Aggiungi Filtrati</strong>.
                  </p>
                </div>
              ) : (
                <div
                  className={`relative bg-white shadow-2xl border border-slate-400 rounded-sm overflow-hidden w-full ${
                    printTarget === 'DYMO'
                      ? 'max-w-[540px] aspect-[70/54] my-auto rounded-xl border-2'
                      : 'max-w-[680px] aspect-[210/297]'
                  }`}
                >
                  {isRenderingPreview && (
                    <div className="absolute inset-0 bg-white/75 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {printTarget === 'DYMO'
                          ? 'Rendering etichetta DYMO 99015...'
                          : 'Impaginazione A4 ad alta definizione...'}
                      </span>
                    </div>
                  )}
                  {previewDataUrl && (
                    <img
                      src={previewDataUrl}
                      alt={`Anteprima ${currentPage + 1}`}
                      className="w-full h-full object-contain block"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
