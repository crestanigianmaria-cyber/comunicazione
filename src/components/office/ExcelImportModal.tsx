import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  X,
  Download,
  FileDown,
  Info,
  Check,
  RefreshCw
} from 'lucide-react';
import { ExcelImportSummary, Product } from '../../types';
import { parseExcelFile, downloadSampleExcel, exportCatalogToExcel } from '../../services/excel';
import { importExcelProductsToDb } from '../../services/db';

interface ExcelImportModalProps {
  products: Product[];
  onClose: () => void;
  onImportCompleted: (newTotal: number) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  products,
  onClose,
  onImportCompleted,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ExcelImportSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingCodesSet = new Set(products.map(p => p.code));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await processFile(selected);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    await processFile(dropped);
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setSummary(null);
    setImportResult(null);

    try {
      const result = await parseExcelFile(selectedFile, selectedFile.name, existingCodesSet);
      setSummary(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante la lettura del file Excel.';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!summary || isImporting) return;
    setIsImporting(true);

    try {
      const validRows = summary.rows.filter(r => r.isValid && r.code && r.description && r.unit_of_measure);
      const res = await importExcelProductsToDb(validRows);
      setImportResult(res);
      onImportCompleted(res.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il salvataggio nel database.';
      setAnalysisError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                Importazione Catalogo Articoli Excel
              </h3>
              <p className="text-[11px] text-slate-400">
                Struttura colonne: Col. A (Codice), Col. B (Descrizione), Col. UM (UM), Col. N (Cod. Alternativo)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action helper bar: Download template / Export current */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Gli articoli non presenti nel file NON verranno cancellati (conservazione storico).</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadSampleExcel()}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Scarica Modello ARTICOLI.xlsx</span>
            </button>
            <button
              onClick={() => exportCatalogToExcel(products)}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] font-bold flex items-center gap-1 shadow-sm transition"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span>Esporta Catalogo Attuale ({products.length})</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Upload Drop Zone */}
          {!importResult && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/70 hover:bg-blue-50/30 transition flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : 'Seleziona o trascina qui il file Excel ARTICOLI.xlsx'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Formati supportati: .xlsx, .xls (SheetJS). I codici preservano gli zeri iniziali come stringhe.
              </p>
            </div>
          )}

          {/* Loading analysis */}
          {isAnalyzing && (
            <div className="py-6 text-center text-xs font-semibold text-slate-600 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              <span>Analisi struttura foglio e convalida colonne in corso...</span>
            </div>
          )}

          {/* Analysis Error */}
          {analysisError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Impossibile analizzare il file:</p>
                <p className="mt-0.5">{analysisError}</p>
              </div>
            </div>
          )}

          {/* Success summary after import */}
          {importResult && (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="text-base font-extrabold text-emerald-900">
                Catalogo Aggiornato con Successo!
              </h4>
              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <div className="text-xl font-black font-mono text-emerald-700">{importResult.added}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Nuovi Aggiunti</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <div className="text-xl font-black font-mono text-blue-700">{importResult.updated}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Aggiornati</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <div className="text-xl font-black font-mono text-slate-900">{importResult.total}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Totale a Catalogo</div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Preview */}
          {summary && !importResult && (
            <div className="space-y-4">
              {/* Stat badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Foglio</span>
                  <span className="font-bold text-slate-900 truncate block">{summary.sheetName}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Righe Trovate</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{summary.totalRowsDetected}</span>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Validi da Importare</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">{summary.validRowsCount}</span>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">UM Vuote Segnalate</span>
                  <span className="font-mono font-bold text-amber-700 text-sm">{summary.missingUmCount}</span>
                </div>
              </div>

              {summary.duplicateCodesCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Attenzione: individuati {summary.duplicateCodesCount} codici ripetuti nel file. Verrà mantenuta l'ultima occorrenza.</span>
                </div>
              )}

              {/* Table Preview */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1.5">
                  Anteprima Primi Articoli dal File:
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase">
                        <th className="py-2 px-3">Codice (Col. A)</th>
                        <th className="py-2 px-3">Descrizione (Col. B)</th>
                        <th className="py-2 px-3 text-center">UM (Col. UM)</th>
                        <th className="py-2 px-3">Cod. Alt. (Col. N)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.rows.slice(0, 15).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                            {row.code || <span className="text-red-500 italic">Vuoto</span>}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800 line-clamp-1">
                            {row.description}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-blue-700">
                            {row.unit_of_measure ? (
                              row.unit_of_measure
                            ) : (
                              <span className="text-amber-600 bg-amber-50 px-1 rounded text-[10px]">
                                Non indicata
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500">
                            {row.alternative_code || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {summary.rows.length > 15 && (
                  <p className="text-[11px] text-slate-400 mt-1 italic">
                    Mostrati i primi 15 articoli di {summary.rows.length}.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
          >
            {importResult ? 'Chiudi' : 'Annulla'}
          </button>

          {summary && !importResult && (
            <button
              onClick={handleConfirmImport}
              disabled={isImporting || summary.validRowsCount === 0}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 transition"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importazione in corso...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>CONFERMA E AGGIORNA CATALOGO ({summary.validRowsCount})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
