import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  Download,
  X,
  QrCode,
  Tag,
  Check,
  Layers,
  Sliders,
  Grid,
  FileText,
  Copy,
  Info
} from 'lucide-react';
import { Product, CompanySettings } from '../../types';

export type QrLabelSize = '3x3' | '3.5x3.5' | '4x4' | 'shelf' | 'pallet';

interface BatchQrPrintModalProps {
  products: Product[];
  companySettings: CompanySettings;
  onClose: () => void;
  onClearSelection?: () => void;
}

export const BatchQrPrintModal: React.FC<BatchQrPrintModalProps> = ({
  products,
  companySettings,
  onClose,
  onClearSelection,
}) => {
  // Label format and QR sizing
  // 3x3 cm: ~ 6 cols x 8 rows (48/page)
  // 3.5x3.5 cm: ~ 5 cols x 6 rows (30/page)
  // 4x4 cm: ~ 4 cols x 5 rows (20/page)
  // shelf: 4 cols x 6 rows with dark header badge
  // pallet: 2 cols x 3 rows large
  const [labelSize, setLabelSize] = useState<QrLabelSize>('3.5x3.5');
  const [showLogo, setShowLogo] = useState(true);
  const [showDescription, setShowDescription] = useState(true);
  const [showUnit, setShowUnit] = useState(true);
  const [showAltCode, setShowAltCode] = useState(false);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(true);

  // Generate QR code data URLs for all selected products in parallel
  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);

    const generateAll = async () => {
      const mapping: Record<string, string> = {};
      const batch = products.slice(0, 300); // safety cap for batch print

      await Promise.all(
        batch.map(async (p) => {
          try {
            const url = await QRCode.toDataURL(p.code, {
              width: 320,
              margin: 1,
              errorCorrectionLevel: 'M',
              color: { dark: '#000000', light: '#ffffff' },
            });
            mapping[p.code] = url;
          } catch (err) {
            console.error(`Failed to generate QR for ${p.code}:`, err);
          }
        })
      );

      if (isMounted) {
        setQrDataUrls(mapping);
        setIsGenerating(false);
      }
    };

    void generateAll();

    return () => {
      isMounted = false;
    };
  }, [products]);

  const handlePrint = () => {
    window.print();
  };

  // Determine grid layout and dimensions based on labelSize
  const getLayoutConfig = () => {
    switch (labelSize) {
      case '3x3':
        return {
          gridClass: 'grid-cols-6 gap-2',
          cardClass: 'min-h-[110px] p-1.5',
          qrClass: 'w-[2.8cm] h-[2.8cm]',
          textSize: 'text-[9px]',
          codeSize: 'text-[10px]',
          badgeSize: 'text-[8px]',
          approxPerSheet: '48 etichette per foglio A4',
        };
      case '3.5x3.5':
        return {
          gridClass: 'grid-cols-5 gap-2.5',
          cardClass: 'min-h-[135px] p-2',
          qrClass: 'w-[3.2cm] h-[3.2cm]',
          textSize: 'text-[10px]',
          codeSize: 'text-xs',
          badgeSize: 'text-[9px]',
          approxPerSheet: '30 etichette per foglio A4',
        };
      case '4x4':
        return {
          gridClass: 'grid-cols-4 gap-3',
          cardClass: 'min-h-[160px] p-2.5',
          qrClass: 'w-[3.8cm] h-[3.8cm]',
          textSize: 'text-[11px]',
          codeSize: 'text-sm',
          badgeSize: 'text-[10px]',
          approxPerSheet: '20 etichette per foglio A4',
        };
      case 'shelf':
        return {
          gridClass: 'grid-cols-4 gap-3',
          cardClass: 'min-h-[155px] p-2',
          qrClass: 'w-[3.2cm] h-[3.2cm]',
          textSize: 'text-[10px]',
          codeSize: 'text-xs',
          badgeSize: 'text-[9px]',
          approxPerSheet: '24 cartellini per foglio A4',
        };
      case 'pallet':
        return {
          gridClass: 'grid-cols-2 gap-4',
          cardClass: 'min-h-[240px] p-4',
          qrClass: 'w-[5.5cm] h-[5.5cm]',
          textSize: 'text-sm',
          codeSize: 'text-xl',
          badgeSize: 'text-xs',
          approxPerSheet: '6 cartelli per foglio A4',
        };
    }
  };

  const layout = getLayoutConfig();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[96vh]">
        {/* Top corporate accent bar */}
        <div className="h-1.5 w-full bg-red-600 shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#0b0f19] text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <QrCode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  Stampa Multipla Etichette QR Code
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-mono text-[11px] font-black">
                  {products.length} {products.length === 1 ? 'ARTICOLO' : 'ARTICOLI'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Layout vettoriale Saggin con logo aziendale, inquadrabili dalla fotocamera magazzino
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating || products.length === 0}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-black flex items-center gap-2 transition shadow-md shadow-red-600/25 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>STAMPA / SALVA PDF (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Chiudi finestra"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Control Toolbar: Size Selector & Toggle Options */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Format / Dimensions Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono font-extrabold text-slate-500 uppercase mr-1">
              Dimensione:
            </span>
            {(
              [
                { id: '3x3', label: '3×3 cm', hint: 'Ultra Compatto (48/A4)' },
                { id: '3.5x3.5', label: '3.5×3.5 cm', hint: 'Consigliato (30/A4)' },
                { id: '4x4', label: '4×4 cm', hint: 'Scaffale Standard (20/A4)' },
                { id: 'shelf', label: 'Cartellino Saggin', hint: 'Testata Scura (24/A4)' },
                { id: 'pallet', label: 'Bancale Grande', hint: 'Maxi Pallet (6/A4)' },
              ] as const
            ).map((opt) => {
              const active = labelSize === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLabelSize(opt.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                  title={opt.hint}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => setShowLogo(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>Logo Saggin</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showDescription}
                onChange={(e) => setShowDescription(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>Descrizione</span>
            </label>

            <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
              <input
                type="checkbox"
                checked={showUnit}
                onChange={(e) => setShowUnit(e.target.checked)}
                className="w-3.5 h-3.5 accent-red-600 rounded"
              />
              <span>U.M.</span>
            </label>

            <span className="hidden lg:inline text-[11px] font-mono font-bold text-slate-400 bg-white px-2.5 py-1 rounded-md border border-slate-200">
              {layout.approxPerSheet}
            </span>
          </div>
        </div>

        {/* Scrollable Sheet Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60">
          {isGenerating ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold font-mono">
                Generazione vettoriale di {products.length} codici QR con logo...
              </span>
            </div>
          ) : products.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center text-center text-slate-400">
              <QrCode className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Nessun articolo selezionato</p>
              <p className="text-xs text-slate-400 mt-1">
                Seleziona uno o più articoli dalla tabella del catalogo per generare i fogli da stampare.
              </p>
            </div>
          ) : (
            <div
              id="printable-qr-sheet"
              className="bg-white rounded-xl shadow-lg border border-slate-300 p-6 mx-auto max-w-[210mm] transition-all"
            >
              {/* Sheet Header for print / preview */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-900">
                <div className="flex items-center gap-2">
                  <img
                    src="/saggin-logo.png"
                    alt="Saggin"
                    className="h-6 w-auto object-contain"
                  />
                  <div>
                    <span className="font-mono text-xs font-black text-slate-900 tracking-tight block">
                      {companySettings.companyName || 'SAGGIN GUGLIELMO S.R.L.'}
                    </span>
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
                      Etichette QR Code per Terminale Magazzino
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold text-slate-500 block">
                    Formato: {labelSize} · {products.length} articoli
                  </span>
                  <span className="text-[9px] text-slate-400">
                    Risoluzione scansione ottica verificata
                  </span>
                </div>
              </div>

              {/* Grid of QR Labels */}
              <div className={`grid ${layout.gridClass}`}>
                {products.map((p) => {
                  const qrUrl = qrDataUrls[p.code];
                  return (
                    <div
                      key={p.code}
                      className={`relative bg-white border border-slate-300 rounded-lg overflow-hidden flex flex-col items-center justify-between text-center break-inside-avoid shadow-2xs hover:border-red-500 transition ${layout.cardClass}`}
                    >
                      {/* Top Bar / Header of each label */}
                      {labelSize === 'shelf' ? (
                        <div className="w-full bg-[#0f172a] text-white px-2 py-1 flex items-center justify-between mb-1.5">
                          <span className={`font-mono font-black ${layout.codeSize} truncate`}>
                            {p.code}
                          </span>
                          {showUnit && (
                            <span className="font-mono font-extrabold text-[9px] bg-red-600 text-white px-1 py-0.2 rounded">
                              {p.unit_of_measure}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-between px-1 mb-1">
                          {showLogo ? (
                            <img
                              src="/saggin-logo.png"
                              alt="Logo"
                              className="h-3 w-auto object-contain opacity-90"
                            />
                          ) : (
                            <span className="text-[8px] font-mono font-bold text-slate-400">
                              SAGGIN
                            </span>
                          )}
                          <div className="flex items-center gap-1">
                            <span
                              className={`font-mono font-black text-slate-900 ${layout.codeSize}`}
                            >
                              {p.code}
                            </span>
                            {showUnit && (
                              <span className="font-mono font-extrabold text-[8px] bg-slate-100 border border-slate-200 text-slate-700 px-1 rounded">
                                {p.unit_of_measure}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* QR Code Graphic (with subtle inner border) */}
                      <div className="p-1 bg-white rounded flex items-center justify-center">
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt={`QR ${p.code}`}
                            className={`${layout.qrClass} object-contain`}
                          />
                        ) : (
                          <div
                            className={`${layout.qrClass} bg-slate-100 animate-pulse rounded`}
                          />
                        )}
                      </div>

                      {/* Product Description */}
                      {showDescription && (
                        <div className="w-full px-1 mt-1 pt-1 border-t border-slate-100">
                          <p
                            className={`font-extrabold text-slate-900 line-clamp-2 leading-tight ${layout.textSize}`}
                          >
                            {p.description}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Per stampare: premi <strong>Stampa</strong> e imposta la stampante su{' '}
              <strong>Formato A4</strong> e <strong>Margini: Minimi</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-slate-900 text-xs font-bold transition"
              >
                Deseleziona Tutti
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
