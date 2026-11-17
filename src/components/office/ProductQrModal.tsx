import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Download, X, QrCode, Tag, Check, Copy, FileDown } from 'lucide-react';
import { Product, CompanySettings } from '../../types';
import {
  downloadQrSheetsAsPdf,
  printQrSheetsDirectly,
  QrSheetPresetId,
} from '../../lib/qrSheetGenerator';
import {
  detectDymoPrinters,
  printViaDymoWebService,
  printDymoViaBrowserDriver,
  renderProductDymoCanvas,
  renderDymoFerramentaSheetCanvas,
} from '../../lib/dymoPrinter';

interface ProductQrModalProps {
  product: Product | null;
  companySettings: CompanySettings;
  onClose: () => void;
}

export const ProductQrModal: React.FC<ProductQrModalProps> = ({
  product,
  companySettings,
  onClose,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [presetId, setPresetId] = useState<QrSheetPresetId>('qr_3x3_20');
  const [copiesCount, setCopiesCount] = useState<number>(1);
  const [showLogoInQr, setShowLogoInQr] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    let isMounted = true;

    const renderSingleQrPreview = async () => {
      try {
        const canvas = document.createElement('canvas');
        await QRCode.toCanvas(canvas, product.code.trim(), {
          width: 440,
          margin: 3,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });

        if (isMounted) {
          setDataUrl(canvas.toDataURL('image/png'));
        }
      } catch (err) {
        console.error('QR generation error:', err);
      }
    };

    void renderSingleQrPreview();

    return () => {
      isMounted = false;
    };
  }, [product]);

  if (!product) return null;

  const getRepeatedProducts = (): Product[] => {
    return Array.from({ length: Math.max(1, copiesCount) }, () => product);
  };

  const handlePrintA4 = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await printQrSheetsDirectly(getRepeatedProducts(), {
        presetId,
        showHeaderLogo: showLogoInQr,
        showLogoInQrCenter: false,
        showUnitBadge: true,
        showCutLines: true,
        darkHeaderStyle: true,
        companyName: companySettings.companyName || 'SAGGIN GUGLIELMO S.R.L.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await downloadQrSheetsAsPdf(
        getRepeatedProducts(),
        {
          presetId,
          showHeaderLogo: true,
          showLogoInQrCenter: showLogoInQr,
          showUnitBadge: true,
          showCutLines: true,
          darkHeaderStyle: true,
          companyName: companySettings.companyName || 'SAGGIN GUGLIELMO S.R.L.',
        },
        `QR_${product.code}_A4.pdf`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handlePrintDymo = async (miniSixPerLabel = false) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const dymoCanvas = miniSixPerLabel
        ? await renderDymoFerramentaSheetCanvas(
            Array.from({ length: 6 }, () => product),
            '70x54'
          )
        : await renderProductDymoCanvas(product, '70x54');
      const printers = await detectDymoPrinters();
      const activePrinter = printers.find((p) => p.isConnected) || printers[0];
      const labelCopies = miniSixPerLabel ? Math.max(1, Math.ceil(copiesCount / 6)) : copiesCount;
      if (activePrinter) {
        await printViaDymoWebService(activePrinter, dymoCanvas, '70x54', labelCopies);
      } else {
        printDymoViaBrowserDriver(dymoCanvas, '70x54', labelCopies);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadPng = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${product.code}_${product.description.slice(0, 20).replace(/\s+/g, '_')}.png`;
    link.click();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(product.code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[94vh]">
        {/* Top corporate accent */}
        <div className="h-1.5 w-full bg-red-600" />

        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0b0f19] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Etichetta QR Code Articolo · {product.code}
              </h3>
              <p className="text-[11px] text-slate-400">
                Nome completo ad alta leggibilità e guide di taglio per taglierina
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

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Size Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
            {(
              [
                { id: 'qr_2x2_117', label: 'Mini 2×2 cm' },
                { id: 'qr_3x3_20', label: 'QR 3×3 cm' },
                { id: 'qr_3.5x3.5_16', label: 'QR 3.5×3.5' },
                { id: 'qr_4x4_12', label: 'QR 4×4 cm' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPresetId(opt.id)}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  presetId === opt.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Copies Selector (1, 4, or full A4 sheet) */}
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-700">Quantità sul foglio A4:</span>
            <div className="flex items-center gap-1.5">
              {[
                { count: 1, label: '1 Etichetta' },
                { count: 4, label: '4 Etichette' },
                { count: 12, label: '12 Etichette' },
                { count: 20, label: 'Foglio Pieno (20)' },
              ].map((c) => (
                <button
                  key={c.count}
                  type="button"
                  onClick={() => setCopiesCount(c.count)}
                  className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                    copiesCount === c.count
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Printable Label Preview Card (Full Uncut Description) */}
          <div className="flex justify-center p-3 bg-slate-100/70 rounded-xl border border-slate-200">
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-400 w-full max-w-[320px] shadow-sm text-center overflow-hidden flex flex-col items-center">
              {/* Top Dark Corporate Bar */}
              <div className="w-full bg-[#0b0f19] text-white px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white rounded px-1 py-0.5">
                    <img
                      src="/saggin-logo.png"
                      alt="Saggin"
                      className="h-3.5 w-auto object-contain"
                    />
                  </div>
                  <span className="font-mono font-black text-sm tracking-tight text-white">
                    {product.code}
                  </span>
                </div>
                <span className="font-mono font-extrabold text-xs text-red-400">
                  {product.unit_of_measure}
                </span>
              </div>

              {/* QR Image */}
              <div className="p-3 bg-white flex items-center justify-center">
                {dataUrl ? (
                  <img
                    src={dataUrl}
                    alt={`QR ${product.code}`}
                    className="w-40 h-40 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-40 h-40 bg-slate-100 animate-pulse rounded" />
                )}
              </div>

              {/* Full Uncut Description */}
              <div className="w-full px-3 pb-3 pt-1 border-t border-slate-100">
                <p className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                  {product.description}
                </p>
              </div>
            </div>
          </div>

          {/* Toggle Logo in QR + Quick Copy */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={showLogoInQr}
                onChange={(e) => setShowLogoInQr(e.target.checked)}
                className="w-4 h-4 accent-red-600 rounded"
              />
              <span>Includi Logo Saggin al centro del QR</span>
            </label>

            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[11px] font-bold text-slate-700 hover:text-red-600 flex items-center gap-1"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedCode ? 'Copiato!' : `Copia ${product.code}`}</span>
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG Singolo</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrintDymo(false)}
              disabled={isBusy}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Stampa etichetta singola su DYMO 99015 (70×54 mm)"
            >
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>DYMO 70×54</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintDymo(true)}
              disabled={isBusy}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Stampa 6 mini-etichette da 2×2 cm su una sola etichetta DYMO 99015 (70×54 mm) per ferramenta"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>DYMO 6× Mini 2×2</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isBusy}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF A4</span>
            </button>
            <button
              type="button"
              onClick={handlePrintA4}
              disabled={isBusy}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-red-600/20 active:scale-95 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Stampa A4</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
