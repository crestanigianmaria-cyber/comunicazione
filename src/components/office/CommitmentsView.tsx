import React, { useState, useMemo, useEffect } from 'react';
import {
  CustomerCommitment,
  CommitmentCategory,
  Product,
} from '../../types';
import {
  createCustomerCommitment,
  updateCustomerCommitment,
  deleteCustomerCommitment,
} from '../../services/db';
import {
  renderCommitmentLabelCanvas,
  printCommitmentSheets,
  downloadCommitmentPdfA4,
} from '../../lib/commitmentQr';
import {
  DYMO_LABEL_FORMATS,
  DymoLabelSizeId,
  DymoPrinterInfo,
  detectDymoPrinters,
  renderCommitmentDymoCanvas,
  printViaDymoWebService,
  printDymoViaBrowserDriver,
} from '../../lib/dymoPrinter';
import {
  QrCode,
  Plus,
  Trash2,
  Printer,
  Download,
  Search,
  User,
  Hash,
  Wrench,
  CheckCircle2,
  Edit3,
  X,
  FileDown,
  Layers,
  AlertCircle,
  MessageSquareText,
  Tag,
  RefreshCw,
} from 'lucide-react';

interface CommitmentsViewProps {
  products: Product[];
  commitments: CustomerCommitment[];
  readOnly?: boolean;
  onRefreshCommitments: () => Promise<void>;
  onLoadCommitmentIntoOrder?: (commitment: CustomerCommitment) => void;
}

type SectionTab = 'ALL' | 'VELUX';
type InstallerPreset = 'NONE' | 'Piazza' | 'Pauletto' | 'CUSTOM';
type PrintTargetMode = 'DYMO' | 'A4';

export const CommitmentsView: React.FC<CommitmentsViewProps> = ({
  commitments,
  readOnly = false,
  onRefreshCommitments,
  onLoadCommitmentIntoOrder,
}) => {
  // Top section switch: Tutti gli Impegni vs Sezione VELUX
  const [sectionTab, setSectionTab] = useState<SectionTab>('ALL');

  // Filter states for the commitments list
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ATTIVO' | 'CARICATO'>('ALL');
  const [installerFilter, setInstallerFilter] = useState<string>('ALL');

  // Form states (Office mode) — streamlined: ONLY Cliente, Numero Impegno, Installatore, Note
  const [editingId, setEditingId] = useState<string | null>(null);
  const [commitmentNumber, setCommitmentNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [category, setCategory] = useState<CommitmentCategory>('STANDARD');
  const [installerPreset, setInstallerPreset] = useState<InstallerPreset>('NONE');
  const [customInstaller, setCustomInstaller] = useState('');
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // QR Print / Preview Modal state
  const [previewCommitment, setPreviewCommitment] = useState<CustomerCommitment | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [printMode, setPrintMode] = useState<PrintTargetMode>('DYMO');
  const [printLayout, setPrintLayout] = useState<'1_big' | '2_half' | '4_grid'>('4_grid');
  const [dymoFormat, setDymoFormat] = useState<DymoLabelSizeId>('70x54');
  const [dymoPrinters, setDymoPrinters] = useState<DymoPrinterInfo[]>([]);
  const [selectedDymoPrinter, setSelectedDymoPrinter] = useState<string>('');
  const [isProbingDymo, setIsProbingDymo] = useState(false);
  const [dymoStatusMsg, setDymoStatusMsg] = useState<string | null>(null);
  const [packagesCount, setPackagesCount] = useState<number>(1);
  const [isExporting, setIsExporting] = useState(false);

  // Switch top section tab cleanly without overwriting custom installer
  const handleSelectSectionTab = (tab: SectionTab) => {
    setSectionTab(tab);
    if (tab === 'VELUX') {
      setCategory('VELUX');
    } else if (!editingId) {
      setCategory('STANDARD');
      setInstallerPreset('NONE');
      setCustomInstaller('');
    }
  };

  // Probe DYMO Connect Web Service when modal opens in DYMO mode
  const refreshDymoPrinters = async () => {
    setIsProbingDymo(true);
    setDymoStatusMsg(null);
    try {
      const found = await detectDymoPrinters();
      setDymoPrinters(found);
      if (found.length > 0) {
        const connected = found.find((p) => p.isConnected) || found[0];
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

  // Render high-res preview image when opening QR Print Modal or switching mode/format
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
      .then((canvas) => {
        if (active) setPreviewDataUrl(canvas.toDataURL('image/png'));
      })
      .finally(() => {
        if (active) setIsRenderingPreview(false);
      });

    return () => {
      active = false;
    };
  }, [previewCommitment, printMode, dymoFormat, packagesCount]);

  // Resolved installer string — only applicable to VELUX commitments
  const resolvedInstallerName = useMemo(() => {
    if (category !== 'VELUX') return null;
    if (installerPreset === 'NONE') return null;
    if (installerPreset === 'CUSTOM') return customInstaller.trim() || null;
    return installerPreset;
  }, [category, installerPreset, customInstaller]);

  const resetForm = () => {
    setEditingId(null);
    setCommitmentNumber('');
    setCustomerName('');
    setCategory(sectionTab === 'VELUX' ? 'VELUX' : 'STANDARD');
    setInstallerPreset('NONE');
    setCustomInstaller('');
    setNotes('');
    setFormError(null);
  };

  const handleLoadForEdit = (c: CustomerCommitment) => {
    setEditingId(c.id);
    setCommitmentNumber(c.commitment_number);
    setCustomerName(c.customer_name);
    setCategory(c.category);
    if (!c.installer_name) {
      setInstallerPreset('NONE');
      setCustomInstaller('');
    } else if (c.installer_name === 'Piazza') {
      setInstallerPreset('Piazza');
      setCustomInstaller('');
    } else if (c.installer_name === 'Pauletto') {
      setInstallerPreset('Pauletto');
      setCustomInstaller('');
    } else {
      setInstallerPreset('CUSTOM');
      setCustomInstaller(c.installer_name);
    }
    setNotes(c.notes || '');
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('Inserisci il nome del cliente.');
      return;
    }
    if (!commitmentNumber.trim()) {
      setFormError("Inserisci il numero dell'impegno cliente.");
      return;
    }

    setIsSaving(true);
    try {
      let saved: CustomerCommitment;
      if (editingId) {
        saved = await updateCustomerCommitment(editingId, {
          commitment_number: commitmentNumber.trim(),
          customer_name: customerName.trim(),
          category,
          installer_name: resolvedInstallerName,
          notes: notes.trim() || null,
          items: [],
        });
      } else {
        saved = await createCustomerCommitment({
          commitment_number: commitmentNumber.trim(),
          customer_name: customerName.trim(),
          category,
          installer_name: resolvedInstallerName,
          notes: notes.trim() || null,
          items: [],
        });
      }

      await onRefreshCommitments();
      resetForm();
      setPreviewCommitment(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCommitment = async (c: CustomerCommitment) => {
    if (!window.confirm(`Eliminare l'impegno N° ${c.commitment_number} (${c.customer_name})?`)) {
      return;
    }
    await deleteCustomerCommitment(c.id);
    await onRefreshCommitments();
  };

  // Filtered commitments list
  const visibleCommitments = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return commitments.filter((c) => {
      if (sectionTab === 'VELUX' && c.category !== 'VELUX') return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (installerFilter === 'PIAZZA' && c.installer_name?.toLowerCase() !== 'piazza') return false;
      if (installerFilter === 'PAULETTO' && c.installer_name?.toLowerCase() !== 'pauletto') return false;
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
      const printer = dymoPrinters.find((p) => p.name === selectedDymoPrinter) || dymoPrinters[0];
      if (printer) {
        await printViaDymoWebService(printer, canvas, dymoFormat, packagesCount);
        setDymoStatusMsg(`Inviato con successo a ${printer.name} (${packagesCount} etichette)!`);
      } else {
        printDymoViaBrowserDriver(canvas, dymoFormat, packagesCount);
      }
    } catch {
      // Fallback to browser driver print dialog with exact DYMO page size
      const canvas = await renderCommitmentDymoCanvas(previewCommitment, dymoFormat);
      printDymoViaBrowserDriver(canvas, dymoFormat, packagesCount);
    } finally {
      setIsExporting(false);
    }
  };

  const totalVeluxCount = useMemo(
    () => commitments.filter((c) => c.category === 'VELUX').length,
    [commitments]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & Department Mode Switcher (Tutti gli Impegni vs Sezione VELUX) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`h-12 px-2.5 rounded-2xl flex items-center justify-center shrink-0 shadow-sm font-black text-white ${
              sectionTab === 'VELUX'
                ? 'bg-white border-2 border-[#e30613]'
                : 'bg-slate-900 shadow-slate-900/15 w-12'
            }`}
          >
            {sectionTab === 'VELUX' ? (
              <img src="/velux-logo.png" alt="VELUX" className="h-7 w-auto object-contain" />
            ) : (
              <QrCode className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {sectionTab === 'VELUX'
                  ? 'Impegni Clienti · Reparto VELUX'
                  : 'Impegni Clienti & Etichette QR'}
              </h1>
              {readOnly && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Vista Magazzino
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {readOnly
                ? "Consulta gli impegni preparati dall'ufficio. Scansionando il QR sulla merce da 'Nuovo Carico', cliente e impegno vengono impostati automaticamente."
                : 'Inserisci Cliente, N° Impegno, Installatore ed eventuali Note: genera subito il QR Code da stampare su DYMO o A4.'}
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs: Tutti gli Impegni vs Sezione VELUX */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200/80 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => handleSelectSectionTab('ALL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              sectionTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-700" />
            <span>Tutti gli Impegni</span>
            <span className="px-1.5 py-0.5 text-[11px] rounded-md bg-slate-100 text-slate-700 font-extrabold">
              {commitments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSectionTab('VELUX')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              sectionTab === 'VELUX'
                ? 'bg-[#e30613] text-white shadow-sm shadow-red-600/20'
                : 'text-slate-700 hover:bg-red-50 hover:text-[#e30613]'
            }`}
          >
            <img
              src="/velux-logo.png"
              alt="VELUX"
              className="h-4 w-auto rounded-xs bg-white p-0.5 object-contain"
            />
            <span>Sezione VELUX</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] rounded-md font-extrabold ${
                sectionTab === 'VELUX'
                  ? 'bg-red-800/60 text-white'
                  : 'bg-red-100 text-[#e30613]'
              }`}
            >
              {totalVeluxCount}
            </span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Create Form (Office only) + Right Commitments List */}
      <div className={`grid grid-cols-1 ${readOnly ? '' : 'lg:grid-cols-12'} gap-6 items-start`}>
        {/* OFFICE FORM: CREATE / EDIT COMMITMENT */}
        {!readOnly && (
          <form
            onSubmit={handleSaveCommitment}
            className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
          >
            <div
              className={`px-5 py-4 flex items-center justify-between border-b ${
                category === 'VELUX'
                  ? 'bg-[#e30613] text-white border-red-700'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {category === 'VELUX' ? (
                  <img
                    src="/velux-logo.png"
                    alt="VELUX"
                    className="h-6 w-auto bg-white rounded px-1 py-0.5 object-contain"
                  />
                ) : (
                  <Plus className="w-5 h-5 text-red-400" />
                )}
                <h2 className="text-sm sm:text-base font-extrabold">
                  {editingId
                    ? 'Modifica Impegno Cliente'
                    : category === 'VELUX'
                    ? 'Nuovo Impegno VELUX'
                    : 'Nuovo Impegno Cliente'}
                </h2>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white"
                >
                  Annulla
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Category Toggle: Standard vs VELUX */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  Tipologia Impegno
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('STANDARD');
                      setInstallerPreset('NONE');
                      setCustomInstaller('');
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                      category === 'STANDARD'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Impegno Normale</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('VELUX')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all flex items-center justify-center gap-2 ${
                      category === 'VELUX'
                        ? 'bg-[#e30613] text-white border-[#e30613] shadow-sm shadow-red-600/20'
                        : 'bg-red-50/60 text-[#e30613] border-red-200 hover:bg-red-50'
                    }`}
                  >
                    <img
                      src="/velux-logo.png"
                      alt="VELUX"
                      className="h-4 w-auto bg-white rounded-xs px-0.5 object-contain"
                    />
                    <span>Reparto VELUX</span>
                  </button>
                </div>
              </div>

              {/* Numero Impegno + Nome Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    N° Impegno *
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={commitmentNumber}
                      onChange={(e) => setCommitmentNumber(e.target.value)}
                      placeholder="Es. 2026/145"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-7">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Nome Cliente *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Es. Rossi Mario Costruzioni"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Installer Selection — ONLY for Reparto VELUX */}
              {category === 'VELUX' && (
                <div className="p-3.5 rounded-xl border space-y-2.5 bg-red-50/70 border-red-200/80">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#e30613]">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Installatore VELUX</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {resolvedInstallerName ? `Selezionato: ${resolvedInstallerName}` : 'Opzionale'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'NONE', label: 'Nessuno' },
                        { id: 'Piazza', label: 'Piazza' },
                        { id: 'Pauletto', label: 'Pauletto' },
                        { id: 'CUSTOM', label: 'Personalizzato' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setInstallerPreset(opt.id)}
                        className={`py-2 px-2.5 rounded-lg text-xs font-extrabold border transition-all ${
                          installerPreset === opt.id
                            ? 'bg-[#e30613] text-white border-[#e30613] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {installerPreset === 'CUSTOM' && (
                    <input
                      type="text"
                      value={customInstaller}
                      onChange={(e) => setCustomInstaller(e.target.value)}
                      placeholder="Scrivi nome installatore personalizzato..."
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                    />
                  )}
                </div>
              )}

              {/* Notes / Comments */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  <MessageSquareText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Note / Commenti (Opzionale)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Es. Ritiro previsto venerdì mattina · Mancano 2 colli..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 resize-none"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full py-3.5 px-4 rounded-xl text-sm font-extrabold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                  category === 'VELUX'
                    ? 'bg-[#e30613] hover:bg-red-700 shadow-red-600/20'
                    : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                } disabled:opacity-60`}
              >
                <QrCode className="w-5 h-5" />
                <span>
                  {isSaving
                    ? 'Salvataggio in corso...'
                    : editingId
                    ? 'Salva Modifiche e Genera QR'
                    : 'Crea Impegno e Genera QR Stampabile'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* COMMITMENTS LIST */}
        <div className={`${readOnly ? 'w-full' : 'lg:col-span-7'} space-y-4`}>
          {/* Search & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Cerca per cliente, numero impegno, installatore o note..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-slate-400"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ATTIVO' | 'CARICATO')}
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Tutti gli stati</option>
                <option value="ATTIVO">Attivi (Da Caricare)</option>
                <option value="CARICATO">Già Caricati</option>
              </select>

              <select
                value={installerFilter}
                onChange={(e) => setInstallerFilter(e.target.value)}
                className="px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Tutti installatori</option>
                <option value="PIAZZA">Piazza</option>
                <option value="PAULETTO">Pauletto</option>
                <option value="OTHER">Altri Personalizzati</option>
              </select>
            </div>
          </div>

          {/* Cards */}
          {visibleCommitments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <QrCode className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-extrabold text-slate-700">
                Nessun impegno cliente trovato
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {readOnly
                  ? "Quando l'ufficio creerà un nuovo impegno cliente o VELUX, apparirà qui in tempo reale."
                  : 'Compila il modulo a sinistra per registrare un nuovo impegno e stampare il QR.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleCommitments.map((c) => {
                const isVelux = c.category === 'VELUX';
                return (
                  <div
                    key={c.id}
                    className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition-all ${
                      isVelux ? 'border-red-200/90' : 'border-slate-200/90'
                    }`}
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isVelux && (
                            <img
                              src="/velux-logo.png"
                              alt="VELUX"
                              className="h-5 w-auto rounded-xs object-contain"
                            />
                          )}
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-xs font-mono font-extrabold">
                            IMPEGNO N° {c.commitment_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                              c.status === 'CARICATO'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {c.status === 'CARICATO' ? 'CARICATO' : 'ATTIVO'}
                          </span>
                          {c.installer_name && (
                            <span className="px-2 py-0.5 rounded-md bg-red-50 text-[#e30613] border border-red-200 text-[11px] font-extrabold flex items-center gap-1">
                              <Wrench className="w-3 h-3" />
                              Inst: {c.installer_name}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                          {c.customer_name}
                        </h3>

                        {c.notes && (
                          <div className="inline-flex items-start gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-xs font-semibold text-amber-900">
                            <MessageSquareText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                            <span>{c.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {readOnly && onLoadCommitmentIntoOrder && (
                          <button
                            type="button"
                            onClick={() => onLoadCommitmentIntoOrder(c)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Carica nell&apos;Ordine</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setPackagesCount(1);
                            setPreviewCommitment(c);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs ${
                            isVelux
                              ? 'bg-[#e30613] hover:bg-red-700 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <QrCode className="w-4 h-4" />
                          <span>QR &amp; Stampa</span>
                        </button>

                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleLoadForEdit(c)}
                              title="Modifica Impegno"
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCommitment(c)}
                              title="Elimina Impegno"
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* QR LABEL PREVIEW & PRINT MODAL (DYMO + A4) */}
      {previewCommitment && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-auto">
            {/* Modal Header */}
            <div
              className={`px-6 py-4 flex items-center justify-between ${
                previewCommitment.category === 'VELUX'
                  ? 'bg-[#e30613] text-white'
                  : 'bg-slate-900 text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <QrCode className="w-6 h-6" />
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold">
                    Etichetta QR Impegno N° {previewCommitment.commitment_number} ·{' '}
                    {previewCommitment.customer_name}
                  </h3>
                  <p className="text-xs opacity-90">
                    Stampa direttamente su rotolo termico DYMO oppure su foglio A4.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCommitment(null)}
                className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Rendered High-Res Label Image Preview */}
              <div className="lg:col-span-6 bg-slate-100 rounded-2xl p-4 border border-slate-200 flex flex-col items-center justify-center min-h-[300px]">
                {isRenderingPreview ? (
                  <div className="py-20 text-xs font-bold text-slate-500">
                    Generazione etichetta ad alta definizione...
                  </div>
                ) : (
                  previewDataUrl && (
                    <img
                      src={previewDataUrl}
                      alt="Etichetta QR Impegno Cliente"
                      className="max-w-full max-h-[380px] rounded-xl shadow-md border border-slate-300 bg-white object-contain"
                    />
                  )
                )}
                <span className="text-[11px] font-semibold text-slate-500 mt-3 text-center">
                  Anteprima reale dell&apos;etichetta{' '}
                  {printMode === 'DYMO'
                    ? `(${DYMO_LABEL_FORMATS.find((f) => f.id === dymoFormat)?.name})`
                    : '(Formato A4)'}
                </span>
              </div>

              {/* Print & PDF Controls */}
              <div className="lg:col-span-6 space-y-4">
                {/* Target Printer Mode Switch: DYMO vs A4 */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPrintMode('DYMO')}
                    className={`py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
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
                    className={`py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
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
                        1. Formato Rotolo Etichette DYMO
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DYMO_LABEL_FORMATS.map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => setDymoFormat(fmt.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
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

                    {/* DYMO Connect Web Service Detection Box */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          Collegamento DYMO Connect
                        </span>
                        <button
                          type="button"
                          onClick={refreshDymoPrinters}
                          disabled={isProbingDymo}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isProbingDymo ? 'animate-spin' : ''}`} />
                          <span>Rileva DYMO</span>
                        </button>
                      </div>

                      {dymoPrinters.length > 0 ? (
                        <select
                          value={selectedDymoPrinter}
                          onChange={(e) => setSelectedDymoPrinter(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-900"
                        >
                          {dymoPrinters.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name} {p.isConnected ? '(Pronta)' : '(Non collegata)'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {isProbingDymo
                            ? 'Ricerca servizio DYMO Connect in corso...'
                            : 'Se DYMO Connect Web Service è attivo sul PC stampa con 1 clic; altrimenti si aprirà la stampa diretta già impostata sul formato DYMO.'}
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
                      1. Formato Impaginazione su Foglio A4
                    </label>
                    <div className="space-y-1.5">
                      {(
                        [
                          {
                            id: '1_big',
                            title: '1 Etichetta Grande su A4',
                            desc: 'Ideale per bancali interi o cartellone collo',
                          },
                          {
                            id: '2_half',
                            title: '2 Etichette Medie su A4',
                            desc: 'Mezzo foglio A4 con linea tratteggiata per taglierina',
                          },
                          {
                            id: '4_grid',
                            title: '4 Etichette Compatte su A4 (Griglia 2×2)',
                            desc: 'Formato adesivo per scatole o colli singoli con linee taglio',
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPrintLayout(opt.id)}
                          className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
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

                {/* Number of packages / copies */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      2. Numero Colli / Copie
                    </label>
                    <span className="text-xs font-black text-slate-900">
                      {packagesCount} {packagesCount === 1 ? 'Etichetta' : 'Etichette'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 6, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPackagesCount(n)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold border ${
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
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handlePrintDymoDirect}
                      className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2"
                    >
                      <Tag className="w-4 h-4" />
                      <span>
                        {dymoPrinters.length > 0
                          ? `Stampa Diretta su ${selectedDymoPrinter}`
                          : 'Stampa su Stampante DYMO'}
                      </span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={handlePrintA4}
                        className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Stampa Foglio A4 Pronto Taglierina</span>
                      </button>

                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={handleDownloadPdf}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Scarica PDF A4 Alta Risoluzione (.pdf)</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadSinglePng}
                    className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Scarica Immagine Etichetta (.png)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
