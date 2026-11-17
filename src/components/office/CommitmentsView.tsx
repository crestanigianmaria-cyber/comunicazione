import React, { useState, useMemo, useEffect } from 'react';
import {
  CustomerCommitment,
  CommitmentCategory,
  CommitmentItem,
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
  QrCode,
  Plus,
  Trash2,
  Printer,
  Download,
  Search,
  User,
  Hash,
  Package,
  Wrench,
  CheckCircle2,
  Edit3,
  X,
  Sparkles,
  FileDown,
  ShoppingBag,
  Layers,
  Check,
  AlertCircle,
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

export const CommitmentsView: React.FC<CommitmentsViewProps> = ({
  products,
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

  // Form states (Office mode)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [commitmentNumber, setCommitmentNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [category, setCategory] = useState<CommitmentCategory>('STANDARD');
  const [installerPreset, setInstallerPreset] = useState<InstallerPreset>('NONE');
  const [customInstaller, setCustomInstaller] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CommitmentItem[]>([]);

  // Catalog search inside form
  const [catalogSearch, setCatalogSearch] = useState('');
  const [onlyVeluxCatalog, setOnlyVeluxCatalog] = useState(false);

  // Manual item entry inside form
  const [showManualRow, setShowManualRow] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualUm, setManualUm] = useState('PZ');
  const [manualQty, setManualQty] = useState('1');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // QR Print / Preview Modal state
  const [previewCommitment, setPreviewCommitment] = useState<CustomerCommitment | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [printLayout, setPrintLayout] = useState<'1_big' | '2_half' | '4_grid'>('2_half');
  const [packagesCount, setPackagesCount] = useState<number>(1);
  const [isExporting, setIsExporting] = useState(false);

  // Automatically sync form category when switching to VELUX section tab
  const handleSelectSectionTab = (tab: SectionTab) => {
    setSectionTab(tab);
    if (tab === 'VELUX') {
      setCategory('VELUX');
      setOnlyVeluxCatalog(true);
      if (installerPreset === 'NONE') {
        setInstallerPreset('Piazza');
      }
    } else {
      setOnlyVeluxCatalog(false);
    }
  };

  // Generate next automatic commitment number
  const generateNextCommitmentNumber = () => {
    const year = new Date().getFullYear();
    const prefix = category === 'VELUX' ? `VLX-${year}-` : `IMP-${year}-`;
    let maxNum = 0;
    for (const c of commitments) {
      const m = c.commitment_number.match(/(\d+)$/);
      if (m && m[1]) {
        const val = parseInt(m[1], 10);
        if (val > maxNum && val < 999999) maxNum = val;
      }
    }
    setCommitmentNumber(`${prefix}${String(maxNum + 1).padStart(3, '0')}`);
  };

  // Render high-res label preview whenever previewCommitment or packagesCount changes
  useEffect(() => {
    let cancelled = false;
    if (!previewCommitment) {
      setPreviewDataUrl('');
      return;
    }
    setIsRenderingPreview(true);
    renderCommitmentLabelCanvas(
      previewCommitment,
      packagesCount > 1 ? { current: 1, total: packagesCount } : undefined
    )
      .then((canvas) => {
        if (!cancelled) {
          setPreviewDataUrl(canvas.toDataURL('image/png'));
          setIsRenderingPreview(false);
        }
      })
      .catch((err) => {
        console.error('Error rendering commitment label preview:', err);
        if (!cancelled) setIsRenderingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewCommitment, packagesCount]);

  // Catalog search results for adding items to the commitment
  const matchingProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q && !onlyVeluxCatalog) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    const results: Product[] = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const hay = `${p.code} ${p.description} ${p.alternative_code || ''}`.toLowerCase();

      if (onlyVeluxCatalog && !hay.includes('velux') && !p.code.toLowerCase().startsWith('vlx')) {
        continue;
      }

      if (tokens.length > 0 && !tokens.every((t) => hay.includes(t))) {
        continue;
      }

      results.push(p);
      if (results.length >= 25) break;
    }
    return results;
  }, [products, catalogSearch, onlyVeluxCatalog]);

  // Filtered commitments list
  const filteredCommitments = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return commitments.filter((c) => {
      if (sectionTab === 'VELUX' && c.category !== 'VELUX') return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (installerFilter !== 'ALL') {
        if ((c.installer_name || '').toLowerCase() !== installerFilter.toLowerCase()) {
          return false;
        }
      }
      if (!q) return true;
      const hay = `${c.commitment_number} ${c.customer_name} ${c.installer_name || ''} ${
        c.notes || ''
      } ${c.items.map((i) => `${i.product_code} ${i.product_description}`).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [commitments, sectionTab, statusFilter, installerFilter, listSearch]);

  const resolvedInstallerName = useMemo(() => {
    if (installerPreset === 'NONE') return null;
    if (installerPreset === 'Piazza') return 'Piazza';
    if (installerPreset === 'Pauletto') return 'Pauletto';
    return customInstaller.trim() || null;
  }, [installerPreset, customInstaller]);

  const resetForm = () => {
    setEditingId(null);
    setCommitmentNumber('');
    setCustomerName('');
    setCategory(sectionTab === 'VELUX' ? 'VELUX' : 'STANDARD');
    setInstallerPreset(sectionTab === 'VELUX' ? 'Piazza' : 'NONE');
    setCustomInstaller('');
    setNotes('');
    setItems([]);
    setFormError(null);
    setCatalogSearch('');
  };

  const handleEditCommitment = (c: CustomerCommitment) => {
    setEditingId(c.id);
    setCommitmentNumber(c.commitment_number);
    setCustomerName(c.customer_name);
    setCategory(c.category);
    if (!c.installer_name) {
      setInstallerPreset('NONE');
      setCustomInstaller('');
    } else if (c.installer_name.toLowerCase() === 'piazza') {
      setInstallerPreset('Piazza');
      setCustomInstaller('');
    } else if (c.installer_name.toLowerCase() === 'pauletto') {
      setInstallerPreset('Pauletto');
      setCustomInstaller('');
    } else {
      setInstallerPreset('CUSTOM');
      setCustomInstaller(c.installer_name);
    }
    setNotes(c.notes || '');
    setItems(c.items.map((it) => ({ ...it })));
    setFormError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddCatalogProduct = (product: Product) => {
    // Auto-detect if it's a VELUX item and switch category to VELUX
    if (
      product.description.toLowerCase().includes('velux') ||
      product.code.toLowerCase().includes('velux')
    ) {
      setCategory('VELUX');
    }

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.product_code === product.code);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          product_id: product.id,
          product_code: product.code,
          product_description: product.description,
          unit_of_measure: product.unit_of_measure || 'PZ',
          quantity: 1,
        },
      ];
    });
  };

  const handleAddManualItem = () => {
    if (!manualDesc.trim()) return;
    const code = manualCode.trim() || (category === 'VELUX' ? 'VELUX-ART' : 'ART-IMP');
    const qty = Math.max(0.01, parseFloat(manualQty.replace(',', '.')) || 1);
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product_id: null,
        product_code: code.toUpperCase(),
        product_description: manualDesc.trim(),
        unit_of_measure: manualUm.trim().toUpperCase() || 'PZ',
        quantity: qty,
      },
    ]);
    setManualCode('');
    setManualDesc('');
    setManualQty('1');
    setShowManualRow(false);
  };

  const handleUpdateItemQty = (id: string, val: string) => {
    const parsed = parseFloat(val.replace(',', '.'));
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: isNaN(parsed) ? 0 : parsed } : it))
    );
  };

  const handleUpdateItemUm = (id: string, um: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, unit_of_measure: um.toUpperCase() } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('Inserisci il nome del Cliente.');
      return;
    }
    if (!commitmentNumber.trim()) {
      setFormError('Inserisci il Numero Impegno Cliente (oppure clicca "Auto N°").');
      return;
    }
    const validItems = items.filter((i) => i.quantity > 0 && i.product_description.trim());
    if (validItems.length === 0) {
      setFormError("Aggiungi almeno un articolo con quantità maggiore di zero all'impegno.");
      return;
    }

    setIsSaving(true);
    try {
      let saved: CustomerCommitment;
      if (editingId) {
        saved = await updateCustomerCommitment(editingId, {
          commitment_number: commitmentNumber,
          customer_name: customerName,
          category,
          installer_name: resolvedInstallerName,
          notes,
          items: validItems,
        });
      } else {
        saved = await createCustomerCommitment({
          commitment_number: commitmentNumber,
          customer_name: customerName,
          category,
          installer_name: resolvedInstallerName,
          notes,
          items: validItems,
        });
      }
      await onRefreshCommitments();
      resetForm();
      // Immediately open the QR label preview & print modal for the saved commitment
      setPackagesCount(1);
      setPreviewCommitment(saved);
    } catch (err: any) {
      setFormError(err?.message || 'Errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (commitment: CustomerCommitment) => {
    if (
      !window.confirm(
        `Eliminare l'impegno cliente N° ${commitment.commitment_number} (${commitment.customer_name})?`
      )
    ) {
      return;
    }
    await deleteCustomerCommitment(commitment.id);
    await onRefreshCommitments();
  };

  const handleDownloadSinglePng = () => {
    if (!previewDataUrl || !previewCommitment) return;
    const safeCust = previewCommitment.customer_name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeNum = previewCommitment.commitment_number.replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = previewDataUrl;
    a.download = `Etichetta_Impegno_${safeNum}_${safeCust}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
                  : 'Gestione Impegni Clienti & Etichette QR Merce'}
              </h1>
              {readOnly && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Vista Magazzino
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {readOnly
                ? "Consulta gli impegni preparati dall'ufficio o scansiona il QR sulla merce da 'Nuovo Carico' per inserire subito tutti gli articoli nell'ordine."
                : 'Inserisci Cliente, N° Impegno, eventuale Installatore e Merce: genera il QR Code pulito con Nome Cliente e N° Impegno da applicare ai colli.'}
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

      {/* Main Content Grid: Left Creation Form (only for Ufficio), Right Commitments List */}
      <div className={`grid grid-cols-1 ${readOnly ? '' : 'xl:grid-cols-12'} gap-6 items-start`}>
        {/* OFFICE CREATION / EDIT FORM */}
        {!readOnly && (
          <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {/* Form Header */}
            <div
              className={`px-5 py-4 border-b flex items-center justify-between ${
                category === 'VELUX'
                  ? 'bg-gradient-to-r from-[#e30613] to-red-700 text-white border-red-700'
                  : 'bg-slate-900 text-white border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {category === 'VELUX' ? (
                  <span className="px-2 py-0.5 bg-white text-[#e30613] font-black text-xs tracking-wider rounded">
                    VELUX
                  </span>
                ) : (
                  <QrCode className="w-5 h-5 text-red-400" />
                )}
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                    {editingId
                      ? `Modifica Impegno N° ${commitmentNumber}`
                      : category === 'VELUX'
                      ? 'Nuovo Impegno Cliente VELUX'
                      : 'Nuovo Impegno Cliente'}
                  </h2>
                  <p className="text-[11px] opacity-85">
                    {category === 'VELUX'
                      ? 'Logo VELUX automatico nel QR + Installatore (Piazza / Pauletto / Personalizzato)'
                      : 'Genera etichetta QR con Nome Cliente, N° Impegno e Merce'}
                  </p>
                </div>
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Annulla
                </button>
              )}
            </div>

            <form onSubmit={handleSaveCommitment} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Tipologia Etichetta Switch: Standard vs VELUX */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                  Tipologia Impegno & Logo nel QR Code
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('STANDARD')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      category === 'STANDARD'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Package className="w-4 h-4" />
                    <span>Standard (Logo Saggin)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('VELUX');
                      if (installerPreset === 'NONE') setInstallerPreset('Piazza');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      category === 'VELUX'
                        ? 'bg-[#e30613] text-white border-[#e30613] shadow-sm shadow-red-600/20'
                        : 'bg-red-50/60 text-[#e30613] border-red-200 hover:bg-red-50'
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                        category === 'VELUX'
                          ? 'bg-white text-[#e30613]'
                          : 'bg-[#e30613] text-white'
                      }`}
                    >
                      VELUX
                    </span>
                    <span>Impegno VELUX (Logo QR)</span>
                  </button>
                </div>
              </div>

              {/* Cliente & Numero Impegno */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Cliente / Riferimento *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Es. Rossi Costruzioni / Mario Bianchi"
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                      N° Impegno *
                    </label>
                    <button
                      type="button"
                      onClick={generateNextCommitmentNumber}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5"
                      title="Genera numero impegno progressivo"
                    >
                      <Sparkles className="w-3 h-3" />
                      Auto N°
                    </button>
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={commitmentNumber}
                      onChange={(e) => setCommitmentNumber(e.target.value)}
                      placeholder="Es. 2026/145"
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Installatore Section (Piazza / Pauletto / Personalizzato) */}
              <div
                className={`p-3.5 rounded-xl border ${
                  category === 'VELUX'
                    ? 'bg-red-50/50 border-red-200/80'
                    : 'bg-slate-50/80 border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-[#e30613]" />
                    <span>Installatore Associato (Stampato su Etichetta QR)</span>
                  </label>
                  {resolvedInstallerName && (
                    <span className="text-[11px] font-extrabold text-[#e30613] bg-white px-2 py-0.5 rounded-md border border-red-200">
                      Inst: {resolvedInstallerName}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInstallerPreset('NONE')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                      installerPreset === 'NONE'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Nessuno
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallerPreset('Piazza')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-extrabold border transition-all flex items-center justify-center gap-1 ${
                      installerPreset === 'Piazza'
                        ? 'bg-[#e30613] text-white border-[#e30613] shadow-sm'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    {installerPreset === 'Piazza' && <Check className="w-3.5 h-3.5" />}
                    <span>Piazza</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallerPreset('Pauletto')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-extrabold border transition-all flex items-center justify-center gap-1 ${
                      installerPreset === 'Pauletto'
                        ? 'bg-[#e30613] text-white border-[#e30613] shadow-sm'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-red-300'
                    }`}
                  >
                    {installerPreset === 'Pauletto' && <Check className="w-3.5 h-3.5" />}
                    <span>Pauletto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallerPreset('CUSTOM')}
                    className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                      installerPreset === 'CUSTOM'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Personalizzato
                  </button>
                </div>

                {installerPreset === 'CUSTOM' && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={customInstaller}
                      onChange={(e) => setCustomInstaller(e.target.value)}
                      placeholder="Scrivi nome installatore personalizzato..."
                      className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:border-slate-900 focus:outline-none"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Catalog Search & Add Products */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Aggiungi Merce all&apos;Impegno
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOnlyVeluxCatalog((v) => !v)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${
                        onlyVeluxCatalog
                          ? 'bg-[#e30613] text-white border-[#e30613]'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      Solo Articoli VELUX
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualRow((v) => !v)}
                      className="text-[11px] font-bold text-slate-700 hover:text-slate-900 underline"
                    >
                      + Articolo Manuale
                    </button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder={
                      onlyVeluxCatalog
                        ? 'Cerca finestre, raccordi, tende o codici VELUX (es. GGL, EDW, MK04)...'
                        : 'Cerca articolo in listino per codice o descrizione...'
                    }
                    className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                  />
                  {catalogSearch && (
                    <button
                      type="button"
                      onClick={() => setCatalogSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Matching Catalog Dropdown List */}
                {(catalogSearch.trim().length > 0 || onlyVeluxCatalog) &&
                  matchingProducts.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
                      {matchingProducts.map((p) => {
                        const isVeluxItem =
                          p.description.toLowerCase().includes('velux') ||
                          p.code.toLowerCase().includes('velux');
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleAddCatalogProduct(p)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors group"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-extrabold text-slate-900">
                                  {p.code}
                                </span>
                                {isVeluxItem && (
                                  <span className="px-1 py-0.2 bg-[#e30613] text-white text-[9px] font-black rounded">
                                    VELUX
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  [{p.unit_of_measure}]
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 truncate">
                                {p.description}
                              </p>
                            </div>
                            <span className="shrink-0 px-2 py-1 rounded-lg bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 text-xs font-bold flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" />
                              Aggiungi
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                {/* Manual / Custom Product Row Box */}
                {showManualRow && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-slate-700">
                        Inserimento Articolo Manuale / Fuori Listino
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowManualRow(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Codice (es. GGL MK04)"
                        className="col-span-4 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={manualDesc}
                        onChange={(e) => setManualDesc(e.target.value)}
                        placeholder="Descrizione articolo *"
                        className="col-span-8 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={manualQty}
                        onChange={(e) => setManualQty(e.target.value)}
                        placeholder="Q.tà"
                        className="w-20 px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={manualUm}
                        onChange={(e) => setManualUm(e.target.value)}
                        placeholder="U.M."
                        className="w-20 px-2.5 py-1.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleAddManualItem}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                      >
                        Inserisci Riga
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Added Items List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                    Merce nell&apos;Impegno ({items.length}{' '}
                    {items.length === 1 ? 'articolo' : 'articoli'})
                  </span>
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setItems([])}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Svuota lista
                    </button>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Cerca e clicca gli articoli dal listino qui sopra per inserirli nell&apos;impegno.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="p-2.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50/80"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-[11px] font-extrabold text-slate-900 block">
                            {it.product_code}
                          </span>
                          <span className="text-xs text-slate-700 font-medium line-clamp-1">
                            {it.product_description}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={it.quantity || ''}
                            onChange={(e) => handleUpdateItemQty(it.id, e.target.value)}
                            className="w-16 px-2 py-1 text-xs font-extrabold text-center bg-slate-50 border border-slate-200 rounded-lg"
                          />
                          <input
                            type="text"
                            value={it.unit_of_measure}
                            onChange={(e) => handleUpdateItemUm(it.id, e.target.value)}
                            className="w-12 px-1.5 py-1 text-[11px] font-mono font-bold text-center uppercase bg-slate-50 border border-slate-200 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Note Consegna / Ubicazione Piazzale (Opzionale)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Es. Scaffale B2 - Ritira installatore venerdi mattina"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full py-3 px-4 rounded-xl font-extrabold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                  category === 'VELUX'
                    ? 'bg-[#e30613] hover:bg-red-700 shadow-red-600/20'
                    : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/15'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Salvataggio in corso...'
                    : editingId
                    ? 'Salva Modifiche & Rigenera QR'
                    : category === 'VELUX'
                    ? 'Crea Impegno VELUX & Genera QR Code'
                    : 'Crea Impegno Cliente & Genera QR Code'}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* RIGHT COLUMN: COMMITMENTS LIST (Both Office & Warehouse) */}
        <div className={`${readOnly ? 'col-span-1' : 'xl:col-span-7'} space-y-4`}>
          {/* Search & Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Cerca per Cliente, N° Impegno, Installatore (Piazza/Pauletto) o Articolo..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70 shrink-0">
                {(
                  [
                    { id: 'ALL', label: 'Tutti' },
                    { id: 'ATTIVO', label: 'In Giacenza' },
                    { id: 'CARICATO', label: 'Già Caricati' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === st.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Installer Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">
                Filtra Installatore:
              </span>
              {(['ALL', 'Piazza', 'Pauletto'] as const).map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => setInstallerFilter(inst)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                    installerFilter === inst
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {inst === 'ALL' ? 'Tutti' : `Installatore: ${inst}`}
                </button>
              ))}
            </div>
          </div>

          {/* Commitments Cards */}
          {filteredCommitments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Nessun impegno cliente trovato
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {readOnly
                  ? "Non ci sono impegni clienti corrispondenti ai filtri selezionati."
                  : "Compila il modulo a sinistra per creare un nuovo impegno cliente e stampare l'etichetta QR Code per la merce."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCommitments.map((commitment) => {
                const isVelux = commitment.category === 'VELUX';
                const isLoaded = commitment.status === 'CARICATO';

                return (
                  <div
                    key={commitment.id}
                    className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden ${
                      isVelux
                        ? 'border-red-200/90 hover:border-red-300'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Bar of Card */}
                    <div
                      className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                        isVelux ? 'bg-red-50/50 border-red-100' : 'bg-slate-50/70 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {isVelux && (
                          <span className="px-2 py-0.5 bg-[#e30613] text-white font-black text-[11px] tracking-wider rounded shadow-xs">
                            VELUX
                          </span>
                        )}
                        <span className="font-mono text-xs sm:text-sm font-black px-2.5 py-0.5 rounded-lg bg-slate-900 text-white">
                          IMPEGNO N° {commitment.commitment_number}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            isLoaded
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isLoaded ? '✓ Già Caricato in Ordine' : '● Merce Impegnata in Magazzino'}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 font-medium">
                        {new Date(commitment.created_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Body of Card */}
                    <div className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Cliente Assegnatario
                          </div>
                          <div className="text-base sm:text-lg font-extrabold text-slate-900">
                            {commitment.customer_name}
                          </div>
                        </div>

                        {commitment.installer_name && (
                          <div className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200/80 self-start sm:self-auto">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 block">
                              Installatore
                            </span>
                            <span className="text-xs sm:text-sm font-black text-[#e30613] flex items-center gap-1">
                              <Wrench className="w-3.5 h-3.5" />
                              {commitment.installer_name}
                            </span>
                          </div>
                        )}
                      </div>

                      {commitment.notes && (
                        <div className="text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
                          <span className="font-bold text-slate-700">Note: </span>
                          {commitment.notes}
                        </div>
                      )}

                      {/* Items Table */}
                      <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                              <th className="py-1.5 px-3">Codice</th>
                              <th className="py-1.5 px-3">Descrizione Merce</th>
                              <th className="py-1.5 px-3 text-right">Q.tà</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {commitment.items.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/60">
                                <td className="py-1.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {item.product_code}
                                </td>
                                <td className="py-1.5 px-3 text-slate-700 font-medium">
                                  {item.product_description}
                                </td>
                                <td className="py-1.5 px-3 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                                  {item.quantity} {item.unit_of_measure}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPackagesCount(1);
                            setPreviewCommitment(commitment);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all ${
                            isVelux
                              ? 'bg-[#e30613] hover:bg-red-700 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <QrCode className="w-4 h-4" />
                          <span>
                            {readOnly
                              ? 'Mostra Etichetta QR'
                              : 'Stampa / Scarica QR da Appiccicare'}
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          {onLoadCommitmentIntoOrder && (
                            <button
                              type="button"
                              onClick={() => onLoadCommitmentIntoOrder(commitment)}
                              className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-all"
                            >
                              <ShoppingBag className="w-4 h-4" />
                              <span>Carica nell&apos;Ordine</span>
                            </button>
                          )}

                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditCommitment(commitment)}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                title="Modifica Impegno"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(commitment)}
                                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="Elimina Impegno"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL ANTEPRIMA E STAMPA ETICHETTA QR IMPEGNO CLIENTE */}
      {previewCommitment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto">
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
                    Pronta da stampare e applicare sui colli. Scansionando il QR in magazzino, tutti
                    gli articoli vengono inseriti nell&apos;ordine.
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
              <div className="lg:col-span-7 bg-slate-100 rounded-2xl p-4 border border-slate-200 flex flex-col items-center justify-center">
                {isRenderingPreview ? (
                  <div className="py-20 text-xs font-bold text-slate-500">
                    Generazione etichetta ad alta definizione...
                  </div>
                ) : (
                  previewDataUrl && (
                    <img
                      src={previewDataUrl}
                      alt="Etichetta QR Impegno Cliente"
                      className="w-full max-w-md rounded-xl shadow-md border border-slate-300 bg-white"
                    />
                  )
                )}
                <span className="text-[11px] font-semibold text-slate-500 mt-2.5 text-center">
                  L&apos;etichetta stampata mostra chiaramente <strong>Nome Cliente</strong>,{' '}
                  <strong>N° Impegno</strong>
                  {previewCommitment.installer_name
                    ? `, Installatore (${previewCommitment.installer_name})`
                    : ''}{' '}
                  e il <strong>QR Code con logo {previewCommitment.category === 'VELUX' ? 'VELUX' : 'Saggin'}</strong>.
                </span>
              </div>

              {/* Print & PDF Controls */}
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                    1. Formato Impaginazione su Foglio A4
                  </label>
                  <div className="space-y-2">
                    {(
                      [
                        {
                          id: '1_big',
                          title: '1 Etichetta Grande su A4',
                          desc: 'Ideale per bancali interi o cartellone collo',
                        },
                        {
                          id: '2_half',
                          title: '2 Etichette Medie su A4 (Consigliato)',
                          desc: 'Mezzo foglio A4 con linea tratteggiata per taglierina',
                        },
                        {
                          id: '4_grid',
                          title: '4 Etichette Compatte su A4 (Griglia 2x2)',
                          desc: 'Formato adesivo per scatole o colli singoli con linee taglio',
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPrintLayout(opt.id)}
                        className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
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

                {/* Number of packages / copies */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      2. Numero di Colli / Etichette da Stampare
                    </label>
                    <span className="text-xs font-black text-slate-900">
                      {packagesCount} {packagesCount === 1 ? 'Collo' : 'Colli'}
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
                <div className="space-y-2.5 pt-2">
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

                  <button
                    type="button"
                    onClick={handleDownloadSinglePng}
                    className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Scarica Immagine Etichetta Singola (.png)</span>
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
