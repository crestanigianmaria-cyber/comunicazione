import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Download, X, QrCode, Tag, Check, Copy } from 'lucide-react';
import { Product, CompanySettings } from '../../types';

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
  const [format, setFormat] = useState<'label' | 'shelf' | 'minimal'>('shelf');
  const [copiedCode, setCopiedCode] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!product) return;
    // Generate QR code data containing the unique product code
    // The warehouse camera directly decodes this string into the search input!
    QRCode.toDataURL(product.code, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => setDataUrl(url))
      .catch(err => console.error('QR generation error:', err));
  }, [product]);

  if (!product) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${product.code}_${product.description.slice(0, 15).replace(/\s+/g, '_')}.png`;
    link.click();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(product.code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Top corporate accent */}
        <div className="h-1 w-full bg-red-600" />

        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#0b0f19] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Stampa Etichetta QR Code Articolo
              </h3>
              <p className="text-[11px] text-slate-400">
                Inquadrabile istantaneamente dalla fotocamera del terminale magazzino
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
          {/* Format Selector */}
          <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFormat('shelf')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                format === 'shelf' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Cartellino Scaffale
            </button>
            <button
              type="button"
              onClick={() => setFormat('label')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                format === 'label' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Etichetta Bancale
            </button>
            <button
              type="button"
              onClick={() => setFormat('minimal')}
              className={`flex-1 py-1.5 rounded-lg transition ${
                format === 'minimal' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Solo QR Code
            </button>
          </div>

          {/* Printable Label Preview Card */}
          <div className="flex justify-center p-2 bg-slate-100/70 rounded-xl border border-slate-200">
            <div
              ref={printContainerRef}
              id="printable-qr-label"
              className="bg-white p-4 rounded-xl border-2 border-dashed border-slate-300 w-full max-w-[340px] shadow-sm text-center flex flex-col items-center"
            >
              {/* Company Wordmark */}
              <div className="flex items-center gap-1.5 mb-2">
                <img src="/saggin-logo.png" alt="Saggin" className="h-5 w-auto object-contain" />
                <span className="font-extrabold text-[11px] text-slate-900 tracking-tight">
                  {companySettings.companyName || 'SAGGIN'}
                </span>
              </div>

              {/* QR Image */}
              <div className="p-2 bg-white rounded-lg border border-slate-200 mb-2">
                {dataUrl ? (
                  <img src={dataUrl} alt={`QR ${product.code}`} className="w-40 h-40 object-contain mx-auto" />
                ) : (
                  <div className="w-40 h-40 bg-slate-100 animate-pulse rounded" />
                )}
              </div>

              {/* Code */}
              <div className="font-mono text-base font-black text-slate-900 tracking-wide bg-slate-100 px-3 py-1 rounded-md mb-1.5">
                {product.code}
              </div>

              {/* Description */}
              {format !== 'minimal' && (
                <div className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 px-1 mb-1">
                  {product.description}
                </div>
              )}

              {/* Unit & Alternative */}
              {format === 'shelf' && (
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-100 w-full">
                  <span>UM: <strong>{product.unit_of_measure}</strong></span>
                  {product.alternative_code && <span>Alt: {product.alternative_code}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Quick info */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-red-600 shrink-0" />
              <span>Codice Articolo: <strong className="font-mono text-slate-900">{product.code}</strong></span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[11px] font-bold text-slate-700 hover:text-red-600 flex items-center gap-1"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copiato!' : 'Copia'}</span>
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
          >
            Chiudi
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Salva Immagine PNG</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-red-600/20 active:scale-95 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Stampa Etichetta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
