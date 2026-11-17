import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, ImageUp } from 'lucide-react';
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
                onScanSuccessRef.current(clean);
                onCloseRef.current();
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#0b0f19] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-800 text-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Scansione QR Code Articolo o Impegno
              </h3>
              <p className="text-[11px] text-slate-400">
                Inquadra il codice QR stampato sull'etichetta o sul cartellino impegno
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

        {/* Viewfinder area */}
        <div className="p-4 flex flex-col items-center">
          <div className="relative w-full min-h-[280px] max-w-[340px] rounded-xl overflow-hidden bg-black border-2 border-red-600/40">
            <div id={readerElementId} className="w-full min-h-[280px]" />

            {isStarting && (
              <div className="absolute inset-0 bg-[#0b0f19]/90 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <RefreshCw className="w-7 h-7 text-red-500 animate-spin" />
                <span className="text-xs font-bold text-slate-300">
                  Attivazione fotocamera in corso...
                </span>
              </div>
            )}

            {scannerError && (
              <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center gap-2.5 p-5 text-center">
                <AlertCircle className="w-8 h-8 text-red-400 shrink-0" />
                <p className="text-xs font-bold text-red-200 leading-relaxed">
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
            className="mt-3 w-full max-w-[340px] py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-extrabold text-white flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ImageUp className="w-4 h-4 text-red-400" />
            <span>Scatta Foto / Carica Immagine QR</span>
          </button>

          <p className="text-[11px] text-slate-400 mt-2.5 text-center">
            Riconosce automaticamente QR Articoli, QR Impegni Clienti / VELUX e codici EAN.
          </p>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
          >
            Annulla Scansione
          </button>
        </div>
      </div>
    </div>
  );
};
