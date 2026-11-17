import QRCode from 'qrcode';
import { CustomerCommitment, CommitmentItem, CommitmentCategory } from '../types';
import { loadSagginLogo, buildPdfFromJpegDataUrls } from './qrSheetGenerator';

const QR_PREFIX_COMPACT = 'IMP|';
const QR_PREFIX_LEGACY = 'SAGGIN_IMP|';

function cleanToken(str: string | null | undefined, maxLen = 80): string {
  if (!str) return '';
  return str
    .replace(/[|~;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Encodes a CustomerCommitment into a compact, low-density string for the QR Code.
 * Format: IMP|<commitment_number>|<customer_name>|<V/S>|<installer_name>|<code1>~<qty1>~<um1>~<descIfManual>;...
 * Keeping the payload concise ensures a low QR Version (large, crisp modules) that scans in <0.1s.
 */
export function encodeCommitmentQrPayload(commitment: CustomerCommitment): string {
  const itemsPart = (commitment.items || [])
    .slice(0, 20)
    .map((it) => {
      const code = cleanToken(it.product_code, 24);
      const qty = Number(it.quantity) || 1;
      const um = cleanToken(it.unit_of_measure || 'PZ', 8);
      const isManual = !code || code.toUpperCase() === 'MANUALE';
      const desc = isManual ? cleanToken(it.product_description, 28) : '';
      return desc ? `${code}~${qty}~${um}~${desc}` : `${code}~${qty}~${um}`;
    })
    .join(';');

  const notesToken = cleanToken(commitment.notes, 80);

  return [
    'IMP',
    cleanToken(commitment.commitment_number, 24),
    cleanToken(commitment.customer_name, 36),
    commitment.category === 'VELUX' ? 'V' : 'S',
    cleanToken(commitment.installer_name, 24),
    itemsPart,
    notesToken,
  ].join('|');
}

export interface DecodedCommitmentQr {
  id: string;
  commitment_number: string;
  customer_name: string;
  category: CommitmentCategory;
  installer_name: string | null;
  notes: string | null;
  items: CommitmentItem[];
}

/**
 * Checks if a scanned QR string is a Saggin Customer Commitment QR (`IMP|...` or `SAGGIN_IMP|...`) and decodes it.
 */
export function decodeCommitmentQrPayload(rawText: string): DecodedCommitmentQr | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith(QR_PREFIX_COMPACT) && !trimmed.startsWith(QR_PREFIX_LEGACY)) {
    return null;
  }

  const parts = trimmed.split('|');

  // Legacy 7-part format: SAGGIN_IMP|id|number|customer|VELUX/STANDARD|installer|items
  if (trimmed.startsWith(QR_PREFIX_LEGACY)) {
    if (parts.length < 6) return null;
    const [, id, commitment_number, customer_name, categoryRaw, installerRaw, itemsRaw = ''] = parts;
    const category: CommitmentCategory =
      categoryRaw === 'VELUX' || categoryRaw === 'V' ? 'VELUX' : 'STANDARD';
    const installer_name = installerRaw?.trim() ? installerRaw.trim() : null;

    const items: CommitmentItem[] = itemsRaw
      .split(';')
      .filter(Boolean)
      .map((token, idx) => {
        const [code = '', qtyStr = '1', um = 'PZ', desc = ''] = token.split('~');
        return {
          id: `imp-item-${idx}-${code}`,
          product_id: null,
          product_code: code.trim(),
          product_description: desc.trim() || code.trim(),
          unit_of_measure: um.trim() || 'PZ',
          quantity: parseFloat(qtyStr) || 1,
        };
      })
      .filter((it) => Boolean(it.product_code || it.product_description));

    return {
      id: id.trim(),
      commitment_number: commitment_number.trim(),
      customer_name: customer_name.trim(),
      category,
      installer_name,
      notes: null,
      items,
    };
  }

  // Compact format: IMP|number|customer|V/S|installer|items|notes
  if (parts.length < 5) return null;
  const [, commitment_number, customer_name, categoryRaw, installerRaw = '', itemsRaw = '', notesRaw = ''] = parts;
  const category: CommitmentCategory =
    categoryRaw === 'V' || categoryRaw === 'VELUX' ? 'VELUX' : 'STANDARD';
  const installer_name = installerRaw?.trim() ? installerRaw.trim() : null;
  const notes = notesRaw?.trim() ? notesRaw.trim() : null;

  const items: CommitmentItem[] = itemsRaw
    .split(';')
    .filter(Boolean)
    .map((token, idx) => {
      const [code = '', qtyStr = '1', um = 'PZ', desc = ''] = token.split('~');
      return {
        id: `imp-item-${idx}-${code}`,
        product_id: null,
        product_code: code.trim(),
        product_description: desc.trim() || code.trim(),
        unit_of_measure: um.trim() || 'PZ',
        quantity: parseFloat(qtyStr) || 1,
      };
    })
    .filter((it) => Boolean(it.product_code || it.product_description));

  return {
    id: '',
    commitment_number: commitment_number.trim(),
    customer_name: customer_name.trim(),
    category,
    installer_name,
    notes,
    items,
  };
}

let cachedVeluxLogoImg: HTMLImageElement | null = null;

export async function loadVeluxLogo(): Promise<HTMLImageElement | null> {
  if (cachedVeluxLogoImg) return cachedVeluxLogoImg;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedVeluxLogoImg = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = '/velux-logo.png';
  });
}

/**
 * Fallback vector VELUX logo if image hasn't loaded
 */
export function drawVeluxLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.fillStyle = '#e30613';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#ffffff';
  const fontSize = Math.round(height * 0.56);
  ctx.font = `900 ${fontSize}px "Arial Black", "Plus Jakarta Sans", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VELUX®', x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

/**
 * Word-wraps text cleanly inside maxWidthPx
 */
function wrapSimpleText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidthPx) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a minimal, clean, modern Commitment QR Sticker Card:
 * - Standard: Logo Saggin + QR Code + Numero Impegno + Nome Cliente (+ Installatore se presente)
 * - VELUX: Logo Saggin + Logo VELUX ufficiale + QR Code + Numero Impegno + Nome Cliente + Installatore
 * Zero extra tables or clutter.
 */
export async function renderCommitmentLabelCanvas(
  commitment: CustomerCommitment,
  colloNumber?: { current: number; total: number }
): Promise<HTMLCanvasElement> {
  const [sagginImg, veluxImg] = await Promise.all([loadSagginLogo(), loadVeluxLogo()]);
  const isVelux = commitment.category === 'VELUX';
  const hasInstaller = Boolean(commitment.installer_name && commitment.installer_name.trim());

  const W = 760;
  const H = hasInstaller ? 920 : 850;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Pure white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Clean outer rounded card frame
  const borderPad = 14;
  ctx.strokeStyle = isVelux ? '#e30613' : '#0f172a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(borderPad, borderPad, W - borderPad * 2, H - borderPad * 2, 28);
  ctx.stroke();

  // 1. Top Brand Logo Header (Clean White Area with Saggin Logo & VELUX Logo)
  const topBarY = borderPad + 24;
  const logoAreaH = 74;

  if (isVelux) {
    // Left: Saggin Logo | Divider | Right: Official VELUX Logo
    const centerX = W / 2;

    if (sagginImg) {
      const sh = 58;
      const sw = (sagginImg.width / sagginImg.height) * sh;
      ctx.drawImage(sagginImg, centerX - 28 - sw, topBarY + (logoAreaH - sh) / 2, sw, sh);
    }

    // Subtle vertical divider between Saggin and VELUX logos
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(centerX, topBarY + 10);
    ctx.lineTo(centerX, topBarY + logoAreaH - 10);
    ctx.stroke();

    if (veluxImg) {
      const vh = 60;
      const vw = (veluxImg.width / veluxImg.height) * vh;
      ctx.drawImage(veluxImg, centerX + 28, topBarY + (logoAreaH - vh) / 2, vw, vh);
    } else {
      drawVeluxLogo(ctx, centerX + 28, topBarY + 8, 175, 58);
    }
  } else {
    // Standard Commitment: Saggin Logo centered at top
    if (sagginImg) {
      const sh = 64;
      const sw = (sagginImg.width / sagginImg.height) * sh;
      ctx.drawImage(sagginImg, (W - sw) / 2, topBarY + (logoAreaH - sh) / 2, sw, sh);
    }
  }

  let cursorY = topBarY + logoAreaH + 18;

  // 2. Commitment Number Pill (IMPEGNO N° ...)
  const pillW = W - 96;
  const pillH = 66;
  const pillX = 48;

  ctx.fillStyle = isVelux ? '#e30613' : '#0f172a';
  ctx.beginPath();
  ctx.roundRect(pillX, cursorY, pillW, pillH, 16);
  ctx.fill();

  const impLabel =
    colloNumber && colloNumber.total > 1
      ? `IMPEGNO N° ${commitment.commitment_number}  ·  COLLO ${colloNumber.current}/${colloNumber.total}`
      : `IMPEGNO N° ${commitment.commitment_number}`;

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${impLabel.length > 26 ? 26 : 31}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(impLabel, W / 2, cursorY + pillH / 2 + 1, pillW - 32);

  cursorY += pillH + 20;

  // 3. Pure, Unobstructed High-Contrast QR Code in the Center
  const qrPayload = encodeCommitmentQrPayload(commitment);
  const qrSize = 440;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, qrPayload, {
    width: qrSize,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

  const qrX = (W - qrSize) / 2;
  ctx.drawImage(qrCanvas, qrX, cursorY, qrSize, qrSize);

  cursorY += qrSize + 16;

  // Subtle horizontal divider above Customer Name
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, cursorY);
  ctx.lineTo(W - 64, cursorY);
  ctx.stroke();

  cursorY += 18;

  // 4. Customer Name (Large, Bold, Centered)
  ctx.fillStyle = '#64748b';
  ctx.font = '800 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('CLIENTE', W / 2, cursorY);

  cursorY += 24;

  const custName = (commitment.customer_name || 'CLIENTE').toUpperCase();
  const maxCustW = W - 96;
  let custFont = 40;
  let custLines: string[] = [custName];

  for (let f = 40; f >= 24; f -= 2) {
    ctx.font = `900 ${f}px "Plus Jakarta Sans", Arial, sans-serif`;
    const wrapped = wrapSimpleText(ctx, custName, maxCustW);
    if (wrapped.length === 1 || (wrapped.length <= 2 && f <= 30)) {
      custFont = f;
      custLines = wrapped.slice(0, 2);
      break;
    }
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${custFont}px "Plus Jakarta Sans", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const lineH = Math.round(custFont * 1.15);
  custLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, cursorY + idx * lineH, maxCustW);
  });

  cursorY += custLines.length * lineH + 16;

  // 5. Installer Badge (if VELUX or if installer is specified)
  if (hasInstaller) {
    const instBoxW = W - 120;
    const instBoxH = 54;
    const instBoxX = 60;
    const instBoxY = Math.min(cursorY, H - borderPad - instBoxH - 22);

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = isVelux ? '#fecdd3' : '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(instBoxX, instBoxY, instBoxW, instBoxH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isVelux ? '#e30613' : '#0f172a';
    ctx.font = '900 23px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `INSTALLATORE: ${(commitment.installer_name || '').toUpperCase()}`,
      W / 2,
      instBoxY + instBoxH / 2 + 1,
      instBoxW - 28
    );
  }

  return canvas;
}

/**
 * Renders an A4 sheet containing 1, 2, or 4 copies of the Commitment Label (with guillotine cut lines)
 * and opens the clean print dialog or downloads a PDF.
 */
export async function renderCommitmentA4Sheet(
  commitment: CustomerCommitment,
  layoutMode: '1_big' | '2_half' | '4_grid',
  totalPackages = 1
): Promise<HTMLCanvasElement[]> {
  const PX_PER_MM = 10;
  const pageW = 210 * PX_PER_MM;
  const pageH = 297 * PX_PER_MM;

  const cardsPerPage = layoutMode === '1_big' ? 1 : layoutMode === '2_half' ? 2 : 4;
  const totalCopies = Math.max(1, totalPackages);
  const totalPages = Math.ceil(totalCopies / cardsPerPage);
  const pages: HTMLCanvasElement[] = [];

  for (let p = 0; p < totalPages; p++) {
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = pageW;
    pageCanvas.height = pageH;
    const ctx = pageCanvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageW, pageH);

    const copiesOnThisPage = Math.min(cardsPerPage, totalCopies - p * cardsPerPage);

    for (let c = 0; c < copiesOnThisPage; c++) {
      const globalCopyIdx = p * cardsPerPage + c + 1;
      const cardCanvas = await renderCommitmentLabelCanvas(
        commitment,
        totalCopies > 1 ? { current: globalCopyIdx, total: totalCopies } : undefined
      );

      if (layoutMode === '1_big') {
        const pad = 12 * PX_PER_MM;
        const availW = pageW - pad * 2;
        const availH = pageH - pad * 2;
        const scale = Math.min(availW / cardCanvas.width, availH / cardCanvas.height);
        const dw = cardCanvas.width * scale;
        const dh = cardCanvas.height * scale;
        ctx.drawImage(cardCanvas, (pageW - dw) / 2, (pageH - dh) / 2, dw, dh);
      } else if (layoutMode === '2_half') {
        // 2 labels side-by-side or stacked vertically (top half and bottom half of A4)
        const halfH = pageH / 2;
        const pad = 8 * PX_PER_MM;
        const availW = pageW - pad * 2;
        const availH = halfH - pad * 2;
        const scale = Math.min(availW / cardCanvas.width, availH / cardCanvas.height);
        const dw = cardCanvas.width * scale;
        const dh = cardCanvas.height * scale;
        const yOffset = c * halfH + (halfH - dh) / 2;
        ctx.drawImage(cardCanvas, (pageW - dw) / 2, yOffset, dw, dh);

        // Dashed horizontal guillotine cut line in the middle of A4
        ctx.save();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(0, halfH);
        ctx.lineTo(pageW, halfH);
        ctx.stroke();
        ctx.restore();
      } else {
        // 4_grid: 2x2 grid on A4 with central horizontal & vertical guillotine cut lines
        const col = c % 2;
        const row = Math.floor(c / 2);
        const quadW = pageW / 2;
        const quadH = pageH / 2;
        const pad = 6 * PX_PER_MM;
        const availW = quadW - pad * 2;
        const availH = quadH - pad * 2;
        const scale = Math.min(availW / cardCanvas.width, availH / cardCanvas.height);
        const dw = cardCanvas.width * scale;
        const dh = cardCanvas.height * scale;
        const dx = col * quadW + (quadW - dw) / 2;
        const dy = row * quadH + (quadH - dh) / 2;
        ctx.drawImage(cardCanvas, dx, dy, dw, dh);

        ctx.save();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(quadW, 0);
        ctx.lineTo(quadW, pageH);
        ctx.moveTo(0, quadH);
        ctx.lineTo(pageW, quadH);
        ctx.stroke();
        ctx.restore();
      }
    }

    pages.push(pageCanvas);
  }

  return pages;
}

export async function printCommitmentSheets(
  commitment: CustomerCommitment,
  layoutMode: '1_big' | '2_half' | '4_grid',
  totalPackages = 1
): Promise<void> {
  const canvases = await renderCommitmentA4Sheet(commitment, layoutMode, totalPackages);
  const dataUrls = canvases.map((c) => c.toDataURL('image/png'));

  const existingIframe = document.getElementById('saggin-a4-print-iframe');
  if (existingIframe) existingIframe.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'saggin-a4-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const imgsHtml = dataUrls
    .map((src) => `<div class="a4-sheet"><img src="${src}" alt="Impegno Cliente" /></div>`)
    .join('');

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Impegno Cliente ${commitment.commitment_number} - ${commitment.customer_name}</title>
  <style>
    @page { size: A4 portrait; margin: 0mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 210mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .a4-sheet { width: 210mm; height: 297mm; page-break-after: always; break-after: page; overflow: hidden; }
    .a4-sheet:last-child { page-break-after: auto; break-after: auto; }
    .a4-sheet img { width: 210mm; height: 297mm; display: block; }
  </style>
</head>
<body>
  ${imgsHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 150);
    };
  </script>
</body>
</html>`);
  doc.close();
}

export async function downloadCommitmentPdfA4(
  commitment: CustomerCommitment,
  layoutMode: '1_big' | '2_half' | '4_grid',
  totalPackages = 1
): Promise<void> {
  const canvases = await renderCommitmentA4Sheet(commitment, layoutMode, totalPackages);
  const jpegPages = canvases.map((c) => c.toDataURL('image/jpeg', 0.96));
  const pdfBlob = buildPdfFromJpegDataUrls(jpegPages);
  const safeCustomer = commitment.customer_name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const safeNum = commitment.commitment_number.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Impegno_${safeNum}_${safeCustomer}_A4.pdf`;

  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

