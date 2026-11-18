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
  renderProductDymoSheetCanvas,
  downloadCanvasAsImage,
  DYMO_PRODUCT_LAYOUTS,
  DymoProductLayout,
  DymoOrientation,
  DymoImageFormat,
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
  const [printMode, setPrintMode] = useState<'DYMO' | 'A4'>('DYMO');
  const [dymoLayout, setDymoLayout] = useState<DymoProductLayout>('1_single');
  const [dymoOrientation, setDymoOrientation] = useState<DymoOrientation>('vertical');
  const [dymoPreviewUrl, setDymoPreviewUrl] = useState<string>('');
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

  // Render live DYMO 99015 preview whenever product, layout, or orientation changes
  useEffect(() => {
    if (!product || printMode !== 'DYMO') return;
    let isMounted = true;
    const layoutInfo =
      DYMO_PRODUCT_LAYOUTS.find((l) => l.id === dymoLayout) || DYMO_PRODUCT_LAYOUTS[0];
    const items = Array.from({ length: layoutInfo.slotsPerLabel }, () => product);
    renderProductDymoSheetCanvas(items, dymoLayout, '70x54', dymoOrientation)
      .then((canvas) => {
        if (isMounted) setDymoPreviewUrl(canvas.toDataURL('image/png'));
      })
      .catch((err) => console.error('DYMO preview error:', err));

    return () => {
      isMounted = false;
    };
  }, [product, printMode, dymoLayout, dymoOrientation]);

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

  const handlePrintDymo = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const layoutInfo =
        DYMO_PRODUCT_LAYOUTS.find((l) => l.id === dymoLayout) || DYMO_PRODUCT_LAYOUTS[0];
      const items = Array.from({ length: layoutInfo.slotsPerLabel }, () => product);
      const dymoCanvas = await renderProductDymoSheetCanvas(
        items,
        dymoLayout,
        '70x54',
        dymoOrientation
      );
      const printers = await detectDymoPrinters();
      const activePrinter = printers.find((p) => p.isConnected) || printers[0];
      const labelCopies = Math.max(1, copiesCount);
      if (activePrinter) {
        await printViaDymoWebService(activePrinter, dymoCanvas, '70x54', labelCopies);
      } else {
        printDymoViaBrowserDriver(dymoCanvas, '70x54', labelCopies);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadImage = async (format: DymoImageFormat) => {
    if (isBusy) return;
    if (printMode === 'DYMO') {
      setIsBusy(true);
      try {
        const layoutInfo =
          DYMO_PRODUCT_LAYOUTS.find((l) => l.id === dymoLayout) || DYMO_PRODUCT_LAYOUTS[0];
        const items = Array.from({ length: layoutInfo.slotsPerLabel }, () => product);
        const canvas = await renderProductDymoSheetCanvas(
          items,
          dymoLayout,
          '70x54',
          dymoOrientation
        );
        downloadCanvasAsImage(canvas, `Etichetta_DYMO_${product.code}_${dymoLayout}`, format);
      } finally {
        setIsBusy(false);
      }
      return;
    }

    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${product.code}_singolo.png`;
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
                DYMO 99015 (70×54 mm) o Foglio A4 con taglierina
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
          {/* Print Mode Switch: DYMO 99015 vs A4 */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => setPrintMode('DYMO')}
              className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                printMode === 'DYMO'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>DYMO 99015 (70×54)</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('A4')}
              className={`py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                printMode === 'A4'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Foglio A4 / PDF</span>
            </button>
          </div>

          {printMode === 'DYMO' ? (
            <>
              {/* 3 DYMO Formats: 1 per label, 2 per label, 6 Ferramenta */}
              <div className="grid grid-cols-3 gap-1.5 bg-amber-50/70 p-1.5 rounded-xl border border-amber-200 text-xs font-bold">
                {DYMO_PRODUCT_LAYOUTS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDymoLayout(opt.id)}
                    className={`py-2 px-1.5 rounded-lg transition cursor-pointer text-center ${
                      dymoLayout === opt.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                ))}
              </div>

              {/* Orientation + Number of DYMO labels to print */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDymoOrientation('vertical')}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                      dymoOrientation === 'vertical'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Verticale 54×70
                  </button>
                  <button
                    type="button"
                    onClick={() => setDymoOrientation('horizontal')}
                    className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                      dymoOrientation === 'horizontal'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Orizzontale 70×54
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700 mr-0.5">Copie:</span>
                  {[1, 2, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCopiesCount(n)}
                      className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition cursor-pointer ${
                        copiesCount === n
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live DYMO 99015 Preview */}
              <div className="flex flex-col items-center p-4 bg-slate-100/80 rounded-xl border border-slate-200">
                <div className="text-[10px] font-mono font-bold text-slate-500 uppercase mb-2">
                  Anteprima Reale DYMO 99015 ({dymoOrientation === 'vertical' ? '54 × 70 mm Verticale' : '70 × 54 mm Orizzontale'})
                </div>
                {dymoPreviewUrl ? (
                  <img
                    src={dymoPreviewUrl}
                    alt={`Anteprima DYMO ${product.code}`}
                    className={`w-full bg-white rounded-lg border-2 border-slate-300 shadow-md object-contain ${
                      dymoOrientation === 'vertical'
                        ? 'max-w-[240px] aspect-[54/70]'
                        : 'max-w-[330px] aspect-[70/54]'
                    }`}
                  />
                ) : (
                  <div
                    className={`w-full bg-white animate-pulse rounded-lg border border-slate-300 ${
                      dymoOrientation === 'vertical'
                        ? 'max-w-[240px] aspect-[54/70]'
                        : 'max-w-[330px] aspect-[70/54]'
                    }`}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              {/* A4 Size Selector */}
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
            </>
          )}

          {/* Quick Copy */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            {printMode === 'A4' ? (
              <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={showLogoInQr}
                  onChange={(e) => setShowLogoInQr(e.target.checked)}
                  className="w-4 h-4 accent-red-600 rounded"
                />
                <span>Logo Saggin in testata</span>
              </label>
            ) : (
              <span className="text-[11px] font-bold text-slate-600">
                Logo Saggin, QR e descrizione inclusi
              </span>
            )}

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadImage('png')}
              disabled={isBusy}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica PNG</span>
            </button>
            {printMode === 'DYMO' && (
              <button
                type="button"
                onClick={() => handleDownloadImage('jpg')}
                disabled={isBusy}
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica JPG</span>
              </button>
            )}
          </div>

          {printMode === 'DYMO' ? (
            <button
              type="button"
              onClick={handlePrintDymo}
              disabled={isBusy}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Tag className="w-4 h-4 text-amber-400" />
              <span>Stampa su DYMO 99015 ({copiesCount}×)</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
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
          )}
        </div>
      </div>
    </div>
  );
};
