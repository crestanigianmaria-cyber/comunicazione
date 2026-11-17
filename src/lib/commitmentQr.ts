import QRCode from 'qrcode';
import { CustomerCommitment, CommitmentItem, CommitmentCategory } from '../types';
import { loadSagginLogo, buildPdfFromJpegDataUrls } from './qrSheetGenerator';

const QR_PREFIX = 'SAGGIN_IMP|';

function cleanToken(str: string | null | undefined, maxLen = 80): string {
  if (!str) return '';
  return str
    .replace(/[|~;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Encodes a CustomerCommitment into a compact, self-contained string for the QR Code.
 * Even if scanned offline in the yard, the QR code itself carries:
 * - Commitment ID
 * - Commitment Number (Numero Impegno)
 * - Customer Name (Cliente)
 * - Category (STANDARD / VELUX)
 * - Installer Name (Piazza / Pauletto / Custom)
 * - All items (code, quantity, unit, description)
 */
export function encodeCommitmentQrPayload(commitment: CustomerCommitment): string {
  const itemsPart = commitment.items
    .slice(0, 25) // safety limit for QR density
    .map((it) => {
      const code = cleanToken(it.product_code, 30);
      const qty = Number(it.quantity) || 1;
      const um = cleanToken(it.unit_of_measure || 'PZ', 10);
      const desc = cleanToken(it.product_description, 36);
      return `${code}~${qty}~${um}~${desc}`;
    })
    .join(';');

  return [
    'SAGGIN_IMP',
    cleanToken(commitment.id, 40),
    cleanToken(commitment.commitment_number, 30),
    cleanToken(commitment.customer_name, 50),
    commitment.category === 'VELUX' ? 'VELUX' : 'STANDARD',
    cleanToken(commitment.installer_name, 40),
    itemsPart,
  ].join('|');
}

export interface DecodedCommitmentQr {
  id: string;
  commitment_number: string;
  customer_name: string;
  category: CommitmentCategory;
  installer_name: string | null;
  items: CommitmentItem[];
}

/**
 * Checks if a scanned QR string is a Saggin Customer Commitment QR and decodes it.
 */
export function decodeCommitmentQrPayload(rawText: string): DecodedCommitmentQr | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith(QR_PREFIX)) return null;

  const parts = trimmed.split('|');
  if (parts.length < 6) return null;

  const [, id, commitment_number, customer_name, categoryRaw, installerRaw, itemsRaw = ''] = parts;
  const category: CommitmentCategory = categoryRaw === 'VELUX' ? 'VELUX' : 'STANDARD';
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
    items,
  };
}

/**
 * Draws the iconic red & white VELUX vector logo onto a 2D canvas context.
 */
export function drawVeluxLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.save();
  // Velux corporate red background
  ctx.fillStyle = '#e3001b';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.max(3, Math.round(height * 0.12)));
  ctx.fill();

  // White border inside
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.5, width * 0.02);
  ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);

  // Bold white VELUX text
  ctx.fillStyle = '#ffffff';
  const fontSize = Math.round(height * 0.56);
  ctx.font = `900 ${fontSize}px "Arial Black", "Plus Jakarta Sans", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VELUX', x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

/**
 * Renders a complete, self-contained Printable Commitment Label Card onto a high-res Canvas.
 * Even if saved as PNG or printed, the image itself clearly displays:
 * - SAGGIN logo (+ VELUX logo if Velux)
 * - IMPEGNO N° (Large bold)
 * - CLIENTE (Full name, never truncated)
 * - INSTALLATORE (Piazza / Pauletto / Custom, if present)
 * - High-DPI QR Code with VELUX or SAGGIN logo embedded in its center
 * - List of committed items
 */
export async function renderCommitmentLabelCanvas(
  commitment: CustomerCommitment,
  colloNumber?: { current: number; total: number }
): Promise<HTMLCanvasElement> {
  const logoImg = await loadSagginLogo();
  const isVelux = commitment.category === 'VELUX';

  const W = 900;
  // Dynamic height based on number of items so nothing is cut off
  const itemRowsCount = Math.min(commitment.items.length, 12);
  const H = 1120 + itemRowsCount * 36;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // White background + outer border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // 1. Top Header Bar (Dark Navy or Velux Red Accent)
  const headerH = 96;
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = isVelux ? '#e3001b' : '#dc2626';
  ctx.fillRect(0, headerH - 8, W, 8);

  // Saggin Logo on left
  if (logoImg) {
    const lh = 54;
    const lw = (logoImg.width / logoImg.height) * lh;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(24, 16, lw + 16, lh + 8, 8);
    ctx.fill();
    ctx.drawImage(logoImg, 32, 20, lw, lh);
  }

  // Title in header center/right
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 26px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = isVelux ? 'center' : 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isVelux ? 'IMPEGNO CLIENTE · REPARTO VELUX' : 'SCHEDA IMPEGNO CLIENTE',
    isVelux ? W / 2 + 20 : W - 28,
    headerH / 2 - 4
  );

  // If Velux, draw VELUX logo on top right of header
  if (isVelux) {
    drawVeluxLogo(ctx, W - 170, 18, 144, 54);
  }

  let cursorY = headerH + 22;

  // 2. Prominent Customer & Commitment Number Box (ALWAYS visible on print!)
  const infoBoxX = 28;
  const infoBoxW = W - 56;
  const hasInstaller = Boolean(commitment.installer_name && commitment.installer_name.trim());
  const infoBoxH = hasInstaller ? 195 : 150;

  ctx.fillStyle = isVelux ? '#fff1f2' : '#f8fafc';
  ctx.strokeStyle = isVelux ? '#fecdd3' : '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(infoBoxX, cursorY, infoBoxW, infoBoxH, 14);
  ctx.fill();
  ctx.stroke();

  // Impegno Number Badge
  ctx.fillStyle = '#64748b';
  ctx.font = '800 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('IMPEGNO CLIENTE N°:', infoBoxX + 22, cursorY + 16);

  ctx.fillStyle = '#dc2626';
  ctx.font = '900 38px "JetBrains Mono", monospace';
  ctx.fillText(commitment.commitment_number || '—', infoBoxX + 240, cursorY + 8);

  if (colloNumber && colloNumber.total > 1) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `COLLO ${colloNumber.current}/${colloNumber.total}`,
      infoBoxX + infoBoxW - 22,
      cursorY + 16
    );
  }

  // Divider inside info box
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(infoBoxX + 20, cursorY + 58);
  ctx.lineTo(infoBoxX + infoBoxW - 20, cursorY + 58);
  ctx.stroke();

  // Customer Name (auto-scaled so full name always fits)
  ctx.fillStyle = '#64748b';
  ctx.font = '800 17px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CLIENTE:', infoBoxX + 22, cursorY + 72);

  const custName = (commitment.customer_name || 'CLIENTE').toUpperCase();
  const custFontPx = custName.length > 32 ? 26 : custName.length > 22 ? 32 : 38;
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${custFontPx}px "Plus Jakarta Sans", Arial, sans-serif`;
  ctx.fillText(custName, infoBoxX + 22, cursorY + 96, infoBoxW - 44);

  // Installer Row (Piazza / Pauletto / Custom)
  if (hasInstaller) {
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(infoBoxX + 22, cursorY + 144, infoBoxW - 44, 38, 8);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `INSTALLATORE: ${(commitment.installer_name || '').toUpperCase()}`,
      infoBoxX + 36,
      cursorY + 163
    );
  }

  cursorY += infoBoxH + 20;

  // 3. Large High-Resolution QR Code with Embedded VELUX or SAGGIN Logo
  const qrPayload = encodeCommitmentQrPayload(commitment);
  const qrSize = 460;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, qrPayload, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' },
  });

  // Draw center badge inside QR Code
  const qCtx = qrCanvas.getContext('2d')!;
  if (isVelux) {
    const bw = 128;
    const bh = 52;
    const bx = (qrSize - bw) / 2;
    const by = (qrSize - bh) / 2;
    qCtx.fillStyle = '#ffffff';
    qCtx.beginPath();
    qCtx.roundRect(bx - 5, by - 5, bw + 10, bh + 10, 8);
    qCtx.fill();
    drawVeluxLogo(qCtx, bx, by, bw, bh);
  } else if (logoImg) {
    const bw = 118;
    const bh = 62;
    const bx = (qrSize - bw) / 2;
    const by = (qrSize - bh) / 2;
    qCtx.fillStyle = '#ffffff';
    qCtx.strokeStyle = '#dc2626';
    qCtx.lineWidth = 4;
    qCtx.beginPath();
    qCtx.roundRect(bx - 5, by - 5, bw + 10, bh + 10, 8);
    qCtx.fill();
    qCtx.stroke();
    qCtx.drawImage(logoImg, bx, by, bw, bh);
  }

  // Draw a self-contained cuttable QR Sticker Frame so even if someone cuts ONLY the QR square,
  // it clearly shows Nome Cliente + Numero Impegno (+ Installatore)!
  const stickerW = qrSize + 80;
  const stickerH = qrSize + 110;
  const stickerX = (W - stickerW) / 2;
  const stickerY = cursorY;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = isVelux ? '#e3001b' : '#0f172a';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.roundRect(stickerX, stickerY, stickerW, stickerH, 12);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);

  // Top bar inside QR sticker: IMPEGNO N°
  ctx.fillStyle = isVelux ? '#e3001b' : '#0f172a';
  ctx.beginPath();
  ctx.roundRect(stickerX + 6, stickerY + 6, stickerW - 12, 42, 8);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `IMPEGNO N° ${commitment.commitment_number}`,
    W / 2,
    stickerY + 27
  );

  // Draw QR Canvas centered inside the sticker frame
  const qrX = (W - qrSize) / 2;
  ctx.drawImage(qrCanvas, qrX, stickerY + 52, qrSize, qrSize);

  // Bottom bar inside QR sticker: CLIENTE (+ Installatore)
  const bottomLabel = hasInstaller
    ? `${custName} · INST: ${(commitment.installer_name || '').toUpperCase()}`
    : `CLIENTE: ${custName}`;
  ctx.fillStyle = '#0f172a';
  ctx.font = `900 ${bottomLabel.length > 34 ? 19 : 23}px "Plus Jakarta Sans", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bottomLabel, W / 2, stickerY + 52 + qrSize + 28, stickerW - 24);
  ctx.restore();

  cursorY += stickerH + 18;

  // 4. Table of Committed Items at bottom of label
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(28, cursorY, W - 56, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `MERCE IMPEGNATA (${commitment.items.length} ${commitment.items.length === 1 ? 'ARTICOLO' : 'ARTICOLI'})`,
    42,
    cursorY + 17
  );
  cursorY += 38;

  const shownItems = commitment.items.slice(0, 12);
  for (let i = 0; i < shownItems.length; i++) {
    const it = shownItems[i];
    if (i % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(28, cursorY, W - 56, 34);
    }
    ctx.fillStyle = '#0f172a';
    ctx.font = '800 17px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${it.product_code}`, 38, cursorY + 17);

    ctx.fillStyle = '#334155';
    ctx.font = '700 17px "Plus Jakarta Sans", Arial, sans-serif';
    const descClean =
      it.product_description.length > 48
        ? it.product_description.slice(0, 48) + '...'
        : it.product_description;
    ctx.fillText(descClean, 195, cursorY + 17);

    ctx.fillStyle = '#dc2626';
    ctx.font = '900 19px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${it.quantity} ${it.unit_of_measure}`,
      W - 40,
      cursorY + 17
    );

    cursorY += 34;
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

