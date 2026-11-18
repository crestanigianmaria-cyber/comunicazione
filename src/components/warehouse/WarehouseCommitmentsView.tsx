import React, { useEffect, useMemo, useState } from 'react';
import {
  QrCode,
  Search,
  Wrench,
  CheckCircle2,
  MessageSquareText,
  Layers,
  RefreshCw,
  X,
  Tag,
  Printer,
  FileDown,
  Download,
} from 'lucide-react';
import { CustomerCommitment } from '../../types';
import {
  renderCommitmentLabelCanvas,
  printCommitmentSheets,
  downloadCommitmentPdfA4,
} from '../../lib/commitmentQr';
import {
  DYMO_LABEL_FORMATS,
  DymoLabelSizeId,
  DymoPrinterInfo,
  DymoImageFormat,
  detectDymoPrinters,
  renderCommitmentDymoCanvas,
  downloadCanvasAsImage,
  printViaDymoWebService,
  printDymoViaBrowserDriver,
} from '../../lib/dymoPrinter';
import { CommitmentStatusBadge } from './ui/StatusBadge';
import { ResponsiveSheetModal } from './ui/ResponsiveSheetModal';
import { EmptyState } from './ui/EmptyState';

interface WarehouseCommitmentsViewProps {
  commitments: CustomerCommitment[];
  onRefreshCommitments: () => Promise<void>;
  onLoadCommitmentIntoOrder: (commitment: CustomerCommitment) => void;
}

type SectionTab = 'ALL' | 'STANDARD' | 'VELUX';

export const WarehouseCommitmentsView: React.FC<WarehouseCommitmentsViewProps> = ({
  commitments,
  onRefreshCommitments,
  onLoadCommitmentIntoOrder,
}) => {
  const [sectionTab, setSectionTab] = useState<SectionTab>('ALL');
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ATTIVO' | 'CARICATO'>('ALL');
  const [installerFilter, setInstallerFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // QR Label Print Preview Modal state
  const [previewCommitment, setPreviewCommitment] = useState<CustomerCommitment | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [printMode, setPrintMode] = useState<'DYMO' | 'A4'>('DYMO');
  const [printLayout, setPrintLayout] = useState<'1_big' | '2_half' | '4_grid'>('4_grid');
  const [dymoFormat, setDymoFormat] = useState<DymoLabelSizeId>('70x54');
  const [dymoPrinters, setDymoPrinters] = useState<DymoPrinterInfo[]>([]);
  const [selectedDymoPrinter, setSelectedDymoPrinter] = useState('');
  const [isProbingDymo, setIsProbingDymo] = useState(false);
  const [dymoStatusMsg, setDymoStatusMsg] = useState<string | null>(null);
  const [packagesCount, setPackagesCount] = useState<number>(1);
  const [isExporting, setIsExporting] = useState(false);

  const counts = useMemo(() => {
    let standard = 0;
    let velux = 0;
    let active = 0;
    for (const c of commitments) {
      if (c.category === 'VELUX') velux++;
      else standard++;
      if (c.status === 'ATTIVO') active++;
    }
    return { total: commitments.length, standard, velux, active };
  }, [commitments]);

  const visibleCommitments = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return commitments.filter(c => {
      if (sectionTab === 'STANDARD' && c.category === 'VELUX') return false;
      if (sectionTab === 'VELUX' && c.category !== 'VELUX') return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (installerFilter === 'PIAZZA' && c.installer_name?.toLowerCase() !== 'piazza') {
        return false;
      }
      if (installerFilter === 'PAULETTO' && c.installer_name?.toLowerCase() !== 'pauletto') {
        return false;
      }
      if (
        installerFilter === 'OTHER' &&
        (!c.installer_name ||
          c.installer_name.toLowerCase() === 'piazza' ||
          c.installer_name.toLowerCase() === 'pauletto')
      ) {
        return false;
      }
      if (!q) return true;
      return (
        c.customer_name.toLowerCase().includes(q) ||
        c.commitment_number.toLowerCase().includes(q) ||
        (c.installer_name && c.installer_name.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    });
  }, [commitments, sectionTab, statusFilter, installerFilter, listSearch]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshCommitments();
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshDymoPrinters = async () => {
    setIsProbingDymo(true);
    setDymoStatusMsg(null);
    try {
      const found = await detectDymoPrinters();
      setDymoPrinters(found);
      if (found.length > 0) {
        const connected = found.find(p => p.isConnected) || found[0];
        setSelectedDymoPrinter(connected.name);
        setDymoStatusMsg(`Stampante DYMO collegata: ${connected.name}`);
      } else {
        setSelectedDymoPrinter('');
      }
    } finally {
      setIsProbingDymo(false);
    }
  };

  useEffect(() => {
    if (previewCommitment && printMode === 'DYMO') {
      void refreshDymoPrinters();
    }
  }, [previewCommitment, printMode]);

  useEffect(() => {
    if (!previewCommitment) {
      setPreviewDataUrl('');
      return;
    }
    let active = true;
    setIsRenderingPreview(true);
    const renderTask =
      printMode === 'DYMO'
        ? renderCommitmentDymoCanvas(previewCommitment, dymoFormat)
        : renderCommitmentLabelCanvas(
            previewCommitment,
            packagesCount > 1 ? { current: 1, total: packagesCount } : undefined
          );

    renderTask
      .then(canvas => {
        if (active) setPreviewDataUrl(canvas.toDataURL('image/png'));
      })
      .finally(() => {
        if (active) setIsRenderingPreview(false);
      });

    return () => {
      active = false;
    };
  }, [previewCommitment, printMode, dymoFormat, packagesCount]);

  const handleDownloadSinglePng = async () => {
    if (!previewCommitment) return;
    const canvas =
      printMode === 'DYMO'
        ? await renderCommitmentDymoCanvas(previewCommitment, dymoFormat)
        : await renderCommitmentLabelCanvas(previewCommitment);
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_Impegno_${previewCommitment.commitment_number}_${previewCommitment.customer_name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 24)}.png`;
    link.click();
  };

  const handleDownloadPdf = async () => {
    if (!previewCommitment) return;
    setIsExporting(true);
    try {
      await downloadCommitmentPdfA4(previewCommitment, printLayout, packagesCount);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintA4 = async () => {
    if (!previewCommitment) return;
    setIsExporting(true);
    try {
      await printCommitmentSheets(previewCommitment, printLayout, packagesCount);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintDymoDirect = async () => {
    if (!previewCommitment) return;
    setIsExporting(true);
    setDymoStatusMsg(null);
    try {
      const canvas = await renderCommitmentDymoCanvas(previewCommitment, dymoFormat);
      const printer = dymoPrinters.find(p => p.name === selectedDymoPrinter) || dymoPrinters[0];
      if (printer) {
        await printViaDymoWebService(printer, canvas, dymoFormat, packagesCount);
        setDymoStatusMsg(`Inviato con successo a ${printer.name} (${packagesCount} etichette)!`);
      } else {
        printDymoViaBrowserDriver(canvas, dymoFormat, packagesCount);
      }
    } catch {
      const canvas = await renderCommitmentDymoCanvas(previewCommitment, dymoFormat);
      printDymoViaBrowserDriver(canvas, dymoFormat, packagesCount);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDymoImage = async (format: DymoImageFormat) => {
    if (!previewCommitment) return;
    setIsExporting(true);
    try {
      const canvas = await renderCommitmentDymoCanvas(previewCommitment, dymoFormat);
      const safeCustomer = (previewCommitment.customer_name || 'Cliente')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .slice(0, 30);
      downloadCanvasAsImage(canvas, `Impegno_DYMO_${safeCustomer}_${dymoFormat}`, format);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Category Separation Header Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Segmented Category Tabs */}
        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSectionTab('ALL')}
            className={`min-h-[42px] px-3 sm:px-4 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation ${
              sectionTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Tutti</span>
            <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
              {counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('STANDARD')}
            className={`min-h-[42px] px-3 sm:px-4 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation ${
              sectionTab === 'STANDARD'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 shrink-0" />
            <span>Standard</span>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                sectionTab === 'STANDARD'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200/70 text-slate-700'
              }`}
            >
              {counts.standard}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSectionTab('VELUX')}
            className={`min-h-[42px] px-3 sm:px-4 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation ${
              sectionTab === 'VELUX'
                ? 'bg-[#e30613] text-white shadow-xs'
                : 'text-slate-700 hover:bg-red-50 hover:text-[#e30613]'
            }`}
          >
            <img
              src="/velux-logo.png"
              alt="VELUX"
              className="h-3.5 w-auto rounded-2xs bg-white px-0.5 object-contain shrink-0"
            />
            <span>VELUX</span>
            <span
              className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                sectionTab === 'VELUX'
                  ? 'bg-red-800/70 text-white'
                  : 'bg-red-100 text-[#e30613]'
              }`}
            >
              {counts.velux}
            </span>
          </button>
        </div>

        {/* Status Quick Filters + Installer + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            {(
              [
                { value: 'ALL', label: 'Tutti' },
                { value: 'ATTIVO', label: `Attivi (${counts.active})` },
                { value: 'CARICATO', label: 'Caricati' },
              ] as const
            ).map(st => (
              <button
                key={st.value}
                type="button"
                onClick={() => setStatusFilter(st.value)}
                className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-extrabold transition touch-manipulation ${
                  statusFilter === st.value
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <select
            value={installerFilter}
            onChange={e => setInstallerFilter(e.target.value)}
            aria-label="Filtra per installatore"
            className="h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-extrabold text-slate-800 focus:outline-none focus:border-slate-900 touch-manipulation"
          >
            <option value="ALL">Tutti installatori</option>
            <option value="PIAZZA">Piazza</option>
            <option value="PAULETTO">Pauletto</option>
            <option value="OTHER">Altri Personalizzati</option>
          </select>

          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={isRefreshing}
            title="Aggiorna elenco impegni"
            className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-extrabold text-slate-800 inline-flex items-center gap-1.5 transition touch-manipulation"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Search Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-3.5">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={listSearch}
            onChange={e => setListSearch(e.target.value)}
            placeholder="Cerca per cliente, numero impegno, installatore VELUX o note..."
            className="w-full h-12 pl-10 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
          />
          {listSearch && (
            <button
              type="button"
              onClick={() => setListSearch('')}
              aria-label="Cancella ricerca impegni"
              className="absolute right-0 pr-2 flex items-center justify-center min-w-[44px] h-12 text-slate-400 hover:text-slate-700 touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Commitments Cards Grid */}
      {visibleCommitments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300">
          <EmptyState
            icon={QrCode}
            title="Nessun impegno cliente trovato"
            description="Quando l'ufficio registrerà un nuovo impegno cliente o VELUX apparirà qui in tempo reale."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3.5">
          {visibleCommitments.map(c => {
            const isVelux = c.category === 'VELUX';
            return (
              <div
                key={c.id}
                className={`bg-white rounded-2xl border shadow-xs overflow-hidden flex flex-col justify-between transition hover:shadow-md ${
                  isVelux
                    ? 'border-red-200/90 border-t-4 border-t-[#e30613]'
                    : 'border-slate-200/90 border-t-4 border-t-slate-900'
                }`}
              >
                <div className="p-4 space-y-2.5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isVelux ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200">
                          <img
                            src="/velux-logo.png"
                            alt="VELUX"
                            className="h-4 w-auto object-contain"
                          />
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-extrabold uppercase text-slate-700">
                          STANDARD
                        </span>
                      )}

                      <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-xs font-mono font-black">
                        IMPEGNO N° {c.commitment_number}
                      </span>
                    </div>

                    <CommitmentStatusBadge status={c.status} />
                  </div>

                  {/* Customer Name */}
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug break-words">
                    {c.customer_name}
                  </h3>

                  {/* Installer (when present) */}
                  {c.installer_name && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-xs font-extrabold text-[#e30613]">
                      <Wrench className="w-3.5 h-3.5 shrink-0" />
                      <span>Installatore: {c.installer_name}</span>
                    </div>
                  )}

                  {/* Notes */}
                  {c.notes && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/80 text-xs font-semibold text-amber-950">
                      <MessageSquareText className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                      <span className="break-words">{c.notes}</span>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadCommitmentIntoOrder(c)}
                    className="flex-1 min-h-[48px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs transition touch-manipulation"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Carica nell&apos;Ordine</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPackagesCount(1);
                      setPreviewCommitment(c);
                    }}
                    className={`min-h-[48px] px-3.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] transition touch-manipulation shrink-0 ${
                      isVelux
                        ? 'bg-[#e30613] hover:bg-red-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>QR &amp; Stampa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR LABEL PREVIEW & PRINT MODAL (DYMO + A4) */}
      <ResponsiveSheetModal
        isOpen={Boolean(previewCommitment)}
        onClose={() => setPreviewCommitment(null)}
        maxWidthClass="sm:max-w-4xl"
        headerTone={previewCommitment?.category === 'VELUX' ? 'velux' : 'dark'}
        title={
          previewCommitment
            ? `Etichetta QR Impegno N° ${previewCommitment.commitment_number} · ${previewCommitment.customer_name}`
            : ''
        }
        subtitle="Stampa su rotolo termico DYMO oppure su foglio A4 / PDF"
      >
        {previewCommitment && (
          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pb-safe">
            {/* Rendered Label Preview */}
            <div className="lg:col-span-6 bg-slate-100 rounded-2xl p-4 border border-slate-200 flex flex-col items-center justify-center min-h-[260px]">
              {isRenderingPreview ? (
                <div className="py-16 text-xs font-bold text-slate-500">
                  Generazione etichetta ad alta definizione...
                </div>
              ) : (
                previewDataUrl && (
                  <img
                    src={previewDataUrl}
                    alt="Etichetta QR Impegno Cliente"
                    className="max-w-full max-h-[340px] rounded-xl shadow-md border border-slate-300 bg-white object-contain"
                  />
                )
              )}
              <span className="text-[11px] font-semibold text-slate-500 mt-3 text-center">
                Anteprima reale{' '}
                {printMode === 'DYMO'
                  ? `(${DYMO_LABEL_FORMATS.find(f => f.id === dymoFormat)?.name})`
                  : '(Formato A4)'}
              </span>
            </div>

            {/* Print Controls */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPrintMode('DYMO')}
                  className={`min-h-[42px] px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation ${
                    printMode === 'DYMO'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>Stampante DYMO</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('A4')}
                  className={`min-h-[42px] px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition touch-manipulation ${
                    printMode === 'A4'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>Foglio A4 / PDF</span>
                </button>
              </div>

              {printMode === 'DYMO' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                      1. Formato Rotolo DYMO
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DYMO_LABEL_FORMATS.map(fmt => (
                        <button
                          key={fmt.id}
                          type="button"
                          onClick={() => setDymoFormat(fmt.id)}
                          className={`min-h-[52px] p-2.5 rounded-xl border text-left transition touch-manipulation ${
                            dymoFormat === fmt.id
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{fmt.name}</div>
                          <div
                            className={`text-[10px] font-mono ${
                              dymoFormat === fmt.id ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            Cod. {fmt.code}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                        DYMO Connect
                      </span>
                      <button
                        type="button"
                        onClick={refreshDymoPrinters}
                        disabled={isProbingDymo}
                        className="min-h-[36px] px-2.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-[11px] font-extrabold text-red-600 hover:text-red-700 inline-flex items-center gap-1.5 transition touch-manipulation"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isProbingDymo ? 'animate-spin' : ''}`} />
                        <span>Rileva DYMO</span>
                      </button>
                    </div>
                    {dymoPrinters.length > 0 ? (
                      <select
                        value={selectedDymoPrinter}
                        onChange={e => setSelectedDymoPrinter(e.target.value)}
                        className="w-full h-10 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-900"
                      >
                        {dymoPrinters.map(p => (
                          <option key={p.name} value={p.name}>
                            {p.name} {p.isConnected ? '(Pronta)' : '(Non collegata)'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {isProbingDymo
                          ? 'Ricerca servizio DYMO Connect in corso...'
                          : 'Stampa con 1 clic su DYMO Connect o finestra di stampa driver.'}
                      </p>
                    )}
                    {dymoStatusMsg && (
                      <p className="text-[11px] font-bold text-emerald-700">{dymoStatusMsg}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                    1. Impaginazione Foglio A4
                  </label>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          id: '1_big',
                          title: '1 Etichetta Grande su A4',
                          desc: 'Per bancali interi o cartellone collo',
                        },
                        {
                          id: '2_half',
                          title: '2 Etichette Medie su A4',
                          desc: 'Mezzo foglio A4 con linea tratteggiata',
                        },
                        {
                          id: '4_grid',
                          title: '4 Etichette Compatte su A4 (2×2)',
                          desc: 'Per scatole o colli singoli',
                        },
                      ] as const
                    ).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrintLayout(opt.id)}
                        className={`w-full min-h-[52px] p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 touch-manipulation ${
                          printLayout === opt.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            printLayout === opt.id ? 'text-red-400' : 'text-slate-400'
                          }`}
                        />
                        <div>
                          <div className="text-xs font-extrabold">{opt.title}</div>
                          <div
                            className={`text-[11px] ${
                              printLayout === opt.id ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {opt.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Copies count */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    2. Numero Colli / Copie
                  </span>
                  <span className="text-xs font-black text-slate-900 font-mono">
                    {packagesCount} {packagesCount === 1 ? 'Etichetta' : 'Etichette'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 6, 8].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPackagesCount(n)}
                      className={`flex-1 min-h-[38px] rounded-lg text-xs font-extrabold border touch-manipulation ${
                        packagesCount === n
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {printMode === 'DYMO' ? (
                  <>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handlePrintDymoDirect}
                      className="w-full min-h-[48px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2 touch-manipulation"
                    >
                      <Tag className="w-4 h-4" />
                      <span>
                        {dymoPrinters.length > 0
                          ? `Stampa Diretta su ${selectedDymoPrinter}`
                          : 'Stampa su Stampante DYMO'}
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => handleDownloadDymoImage('png')}
                        className="min-h-[42px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm touch-manipulation disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Scarica PNG</span>
                      </button>
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={() => handleDownloadDymoImage('jpg')}
                        className="min-h-[42px] px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm touch-manipulation disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Scarica JPG</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handlePrintA4}
                      className="w-full min-h-[48px] px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2 touch-manipulation"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Stampa Foglio A4</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handleDownloadPdf}
                      className="w-full min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 touch-manipulation"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>Scarica PDF A4 (.pdf)</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleDownloadSinglePng}
                  className="w-full min-h-[42px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 touch-manipulation"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica Immagine Etichetta (.png)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </ResponsiveSheetModal>
    </div>
  );
};
