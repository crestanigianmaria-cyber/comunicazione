import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Volume2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

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
  const readerElementId = 'saggin-barcode-reader';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsStarting(true);
    setScannerError(null);

    const timer = setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!isMounted) return;
            // Haptic + Audio confirmation
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(60); } catch {}
            }
            // Stop scanning and trigger success callback
            html5QrCode.stop().then(() => {
              html5QrCode.clear();
              onScanSuccess(decodedText.trim());
              onClose();
            }).catch(() => {
              onScanSuccess(decodedText.trim());
              onClose();
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
            ? 'Accesso fotocamera negato. Consenti l\'accesso fotocamera dalle impostazioni del browser.'
            : msg
        );
        setIsStarting(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

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
                Scansione Barcode / QR Code
              </h3>
              <p className="text-[11px] text-slate-400">
                Inquadra il codice stampato sull'etichetta
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
          <div className="relative w-full aspect-square max-w-[320px] rounded-xl overflow-hidden bg-black border-2 border-red-600/40 flex items-center justify-center">
            <div id={readerElementId} className="w-full h-full object-cover" />

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
                <button
                  onClick={onClose}
                  className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition"
                >
                  Chiudi e usa la ricerca manuale
                </button>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-3 text-center">
            Supporta codici QR Saggin, EAN-13, EAN-8 e codici a barre standard.
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
