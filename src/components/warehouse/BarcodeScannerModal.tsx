import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, ImageUp, CheckCircle2, ScanLine } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [scanDetected, setScanDetected] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasScannedRef = useRef(false);

  // Keep latest callbacks in refs so the camera listener never uses a stale closure
  const onScanSuccessRef = useRef(onScanSuccess);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    onCloseRef.current = onClose;
  }, [onScanSuccess, onClose]);

  const readerElementId = 'saggin-barcode-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    hasScannedRef.current = false;
    setScanDetected(false);
    setIsStarting(true);
    setScannerError(null);

    const timer = setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(readerElementId, {
          useBarCodeDetectorIfSupported: true,
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        });
        scannerRef.current = html5QrCode;

        const config = {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth || 280, viewfinderHeight || 280);
            const boxSize = Math.max(150, Math.floor(minEdge * 0.82));
            return { width: boxSize, height: boxSize };
          },
          disableFlip: false,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!isMounted || hasScannedRef.current) return;
            const clean = decodedText.trim();
            if (!clean) return;
            hasScannedRef.current = true;
            setScanDetected(true);

            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate(70);
              } catch {
                // ignore
              }
            }

            html5QrCode
              .stop()
              .then(() => {
                try {
                  html5QrCode.clear();
                } catch {
                  // ignore
                }
                window.setTimeout(() => {
                  if (!isMounted) return;
                  onScanSuccessRef.current(clean);
                  onCloseRef.current();
                }, 140);
              })
              .catch(() => {
                onScanSuccessRef.current(clean);
                onCloseRef.current();
              });
          },
          () => {
            // Frame scan failure (quiet)
          }
        );

        if (isMounted) setIsStarting(false);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Impossibile accedere alla fotocamera.';
        setScannerError(
          msg.includes('NotAllowedError') || msg.includes('Permission')
            ? "Accesso fotocamera negato. Consenti l'accesso fotocamera dalle impostazioni del browser oppure usa il pulsante qui sotto per scattare/caricare una foto del QR."
            : msg
        );
        setIsStarting(false);
      }
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        try {
          if (inst.isScanning) {
            inst
              .stop()
              .then(() => inst.clear())
              .catch(() => {});
          } else {
            inst.clear();
          }
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen]);

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScannerError(null);

    try {
      // Stop live stream first if active
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop().catch(() => {});
      }
      const fileScanner =
        scannerRef.current ||
        new Html5Qrcode(readerElementId, {
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
      const decoded = await fileScanner.scanFile(file, false);
      if (decoded && decoded.trim()) {
        setScanDetected(true);
        onScanSuccessRef.current(decoded.trim());
        onCloseRef.current();
      }
    } catch {
      setScannerError(
        'Impossibile leggere un QR Code da questa immagine. Avvicina bene l’obiettivo al riquadro QR.'
      );
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/85 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 select-none animate-wms-fade no-print"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[#0b0f19] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-800 text-white flex flex-col max-h-[92dvh] animate-wms-slide-up"
      >
        {/* Top Mobile Pill */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <span className="w-10 h-1 rounded-full bg-white/25" />
        </div>

        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white truncate">
                Scanner QR &amp; Codice a Barre
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Articoli, EAN, Impegni Clienti &amp; VELUX
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi scanner"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition touch-manipulation shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder area */}
        <div className="p-4 sm:p-5 flex flex-col items-center overflow-y-auto">
          <div className="relative w-full min-h-[270px] sm:min-h-[290px] max-w-[360px] rounded-2xl overflow-hidden bg-black border-2 border-slate-700 shadow-inner">
            <div id={readerElementId} className="w-full min-h-[270px] sm:min-h-[290px]" />

            {/* Precision Corner Reticle Guides */}
            {!isStarting && !scannerError && !scanDetected && (
              <div className="pointer-events-none absolute inset-6">
                <span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-red-500 rounded-tl-md" />
                <span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-red-500 rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-red-500 rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-red-500 rounded-br-md" />
                <div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-wms-scan-beam" />
              </div>
            )}

            {/* Instant Detection Flash Overlay */}
            {scanDetected && (
              <div className="absolute inset-0 bg-emerald-600/90 flex flex-col items-center justify-center gap-2 p-4 text-center animate-wms-fade">
                <CheckCircle2 className="w-12 h-12 text-white stroke-[2.5]" />
                <span className="text-sm font-black uppercase tracking-wider text-white">
                  Codice Riconosciuto!
                </span>
              </div>
            )}

            {isStarting && (
              <div className="absolute inset-0 bg-[#0b0f19]/92 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
                <span className="text-xs font-bold text-slate-300">
                  Avvio fotocamera in corso...
                </span>
              </div>
            )}

            {scannerError && (
              <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center gap-2.5 p-5 text-center">
                <AlertCircle className="w-9 h-9 text-red-400 shrink-0" />
                <p className="text-xs font-bold text-red-100 leading-relaxed max-w-xs">
                  {scannerError}
                </p>
              </div>
            )}
          </div>

          {/* Photo / Image File Fallback Button (always works even on desktop or without live stream) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileScan}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 w-full max-w-[360px] min-h-[48px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-extrabold text-white flex items-center justify-center gap-2 transition active:scale-[0.98] touch-manipulation cursor-pointer"
          >
            <ImageUp className="w-4 h-4 text-red-400 shrink-0" />
            <span>Scatta Foto o Carica Immagine QR</span>
          </button>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-3 text-center">
            <ScanLine className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>Inquadra al centro del riquadro per scansione istantanea</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-xs sm:text-sm font-bold text-slate-200 active:scale-[0.98] transition touch-manipulation"
          >
            Annulla Scansione
          </button>
        </div>
      </div>
    </div>
  );
};
