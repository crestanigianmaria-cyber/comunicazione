import QRCode from 'qrcode';
import { CustomerCommitment, Product } from '../types';
import { loadSagginLogo } from './qrSheetGenerator';
import { loadVeluxLogo, drawVeluxLogo } from './commitmentQr';

export type DymoLabelSizeId = '70x54' | '101x54' | '89x36' | '57x32' | '102x152';

export interface DymoLabelFormat {
  id: DymoLabelSizeId;
  name: string;
  code: string;
  widthMm: number;
  heightMm: number;
  dymoPaperName: string;
}

export const DYMO_LABEL_FORMATS: DymoLabelFormat[] = [
  {
    id: '70x54',
    name: 'DYMO 70 × 54 mm (Standard 99015)',
    code: '99015 / S0722440',
    widthMm: 70,
    heightMm: 54,
    dymoPaperName: '99015',
  },
  {
    id: '101x54',
    name: 'DYMO 101 × 54 mm (Spedizione)',
    code: '99014 / S0722430',
    widthMm: 101,
    heightMm: 54,
    dymoPaperName: 'Shipping',
  },
  {
    id: '89x36',
    name: 'DYMO 89 × 36 mm (Indirizzo Large)',
    code: '99012 / S0722400',
    widthMm: 89,
    heightMm: 36,
    dymoPaperName: 'Large Address',
  },
  {
    id: '57x32',
    name: 'DYMO 57 × 32 mm (Compatta)',
    code: '11354 / S0722540',
    widthMm: 57,
    heightMm: 32,
    dymoPaperName: 'Multi-Purpose',
  },
  {
    id: '102x152',
    name: 'DYMO 102 × 152 mm (Maxi 4×6")',
    code: '1744907 / S0904980',
    widthMm: 102,
    heightMm: 152,
    dymoPaperName: '4x6 Shipping',
  },
];

const DYMO_SERVICE_URLS = [
  'https://127.0.0.1:41951/DYMO/DLS/Printing',
  'https://localhost:41951/DYMO/DLS/Printing',
];

export interface DymoPrinterInfo {
  name: string;
  isConnected: boolean;
  serviceUrl: string;
}

/**
 * Probes the local DYMO Connect / DYMO Label Web Service (if installed & running on Windows/Mac).
 * Returns available DYMO printers or empty array if service is unreachable.
 */
export async function detectDymoPrinters(): Promise<DymoPrinterInfo[]> {
  for (const baseUrl of DYMO_SERVICE_URLS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1400);
      const res = await fetch(`${baseUrl}/GetPrinters`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const xmlText = await res.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const printerNodes = Array.from(xmlDoc.querySelectorAll('LabelWriterPrinter, Printer'));
      const printers: DymoPrinterInfo[] = [];

      for (const node of printerNodes) {
        const name = node.querySelector('Name')?.textContent?.trim();
        const isConnectedText = node.querySelector('IsConnected')?.textContent?.trim();
        if (name) {
          printers.push({
            name,
            isConnected: isConnectedText !== 'False' && isConnectedText !== 'false',
            serviceUrl: baseUrl,
          });
        }
      }
      if (printers.length > 0) return printers;
    } catch {
      // Try next URL
    }
  }
  return [];
}

function fitDymoWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
  maxHeightPx: number,
  maxFontPx: number,
  minFontPx: number,
  fontWeight: string,
  fontFamily: string,
  maxLines = 3
): { fontPx: number; lineHeightPx: number; lines: string[] } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (let f = maxFontPx; f >= minFontPx; f -= 2) {
    ctx.font = `${fontWeight} ${f}px ${fontFamily}`;
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const cand = current ? `${current} ${w}` : w;
      if (ctx.measureText(cand).width <= maxWidthPx) {
        current = cand;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    const lineHeightPx = Math.round(f * 1.15);
    if (lines.length <= maxLines && lines.length * lineHeightPx <= maxHeightPx) {
      return { fontPx: f, lineHeightPx, lines };
    }
  }
  ctx.font = `${fontWeight} ${minFontPx}px ${fontFamily}`;
  const fallback: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(cand).width <= maxWidthPx) cur = cand;
    else {
      if (cur) fallback.push(cur);
      cur = w;
    }
  }
  if (cur) fallback.push(cur);
  return {
    fontPx: minFontPx,
    lineHeightPx: Math.round(minFontPx * 1.15),
    lines: fallback.slice(0, maxLines),
  };
}

/**
 * Renders a crisp 300-DPI thermal-ready DYMO label canvas for a Customer Commitment
 * (NO QR code):
 * - Standard: Logo Saggin ben visibile + Numero Impegno IN GRANDE + Nome Cliente (+ Note)
 * - VELUX: Logo Saggin + Logo VELUX + Numero Impegno IN GRANDE + Nome Cliente + Installatore (+ Note)
 */
export async function renderCommitmentDymoCanvas(
  commitment: CustomerCommitment,
  formatId: DymoLabelSizeId
): Promise<HTMLCanvasElement> {
  const fmt = DYMO_LABEL_FORMATS.find((f) => f.id === formatId) || DYMO_LABEL_FORMATS[0];
  // 12 px per mm (~305 DPI) for ultra-sharp thermal printing
  const PX_PER_MM = 12;
  const W = Math.round(fmt.widthMm * PX_PER_MM);
  const H = Math.round(fmt.heightMm * PX_PER_MM);

  const [sagginImg, veluxImg] = await Promise.all([loadSagginLogo(), loadVeluxLogo()]);
  const isVelux = commitment.category === 'VELUX';
  const hasInstaller = Boolean(commitment.installer_name && commitment.installer_name.trim());
  const cleanNotes = (commitment.notes || '').trim();
  const hasNotes = Boolean(cleanNotes);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const isPortraitMaxi = fmt.id === '102x152';
  const outerMargin = Math.round((isPortraitMaxi ? 2.5 : 1.4) * PX_PER_MM);
  const pad = outerMargin + Math.round((isPortraitMaxi ? 3.5 : 2.0) * PX_PER_MM);
  const innerW = W - pad * 2;

  // Crisp pure-black outer thermal frame
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(3, Math.round((isPortraitMaxi ? 0.55 : 0.35) * PX_PER_MM));
  ctx.beginPath();
  ctx.roundRect(
    outerMargin,
    outerMargin,
    W - outerMargin * 2,
    H - outerMargin * 2,
    Math.round((isPortraitMaxi ? 3.0 : 1.8) * PX_PER_MM)
  );
  ctx.stroke();

  // 1. Top Logos Section (Saggin centered, or Saggin + divider + VELUX)
  let cursorY = pad;
  const logoH = isPortraitMaxi
    ? Math.round(13.5 * PX_PER_MM)
    : Math.round(Math.min(H * 0.21, 12.5 * PX_PER_MM));

  if (isVelux) {
    const gap = Math.round((isPortraitMaxi ? 3.6 : 2.2) * PX_PER_MM);
    const maxLogoW = (innerW - gap * 2) / 2;
    const sw = sagginImg ? Math.min(maxLogoW, (sagginImg.width / sagginImg.height) * logoH) : 0;
    const sh = sagginImg ? sw * (sagginImg.height / sagginImg.width) : 0;
    const vw = veluxImg
      ? Math.min(maxLogoW, (veluxImg.width / veluxImg.height) * logoH)
      : Math.min(maxLogoW, logoH * 2.6);
    const vh = veluxImg ? vw * (veluxImg.height / veluxImg.width) : Math.round(logoH * 0.88);
    const totalLogosW = sw + (sw > 0 ? gap * 2 : 0) + vw;
    let lx = (W - totalLogosW) / 2;

    if (sagginImg) {
      ctx.drawImage(sagginImg, lx, cursorY + (logoH - sh) / 2, sw, sh);
      lx += sw + gap;

      // Vertical separator between Saggin and VELUX logos
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, Math.round(0.22 * PX_PER_MM));
      ctx.beginPath();
      ctx.moveTo(lx, cursorY + Math.round(logoH * 0.14));
      ctx.lineTo(lx, cursorY + Math.round(logoH * 0.86));
      ctx.stroke();
      lx += gap;
    }

    if (veluxImg) {
      ctx.drawImage(veluxImg, lx, cursorY + (logoH - vh) / 2, vw, vh);
    } else {
      drawVeluxLogo(ctx, lx, cursorY + (logoH - vh) / 2, vw, vh);
    }
  } else if (sagginImg) {
    const sw = Math.min(innerW * 0.86, (sagginImg.width / sagginImg.height) * logoH);
    const sh = sw * (sagginImg.height / sagginImg.width);
    ctx.drawImage(sagginImg, (W - sw) / 2, cursorY + (logoH - sh) / 2, sw, sh);
  }

  cursorY += logoH + Math.round((isPortraitMaxi ? 2.8 : 1.4) * PX_PER_MM);

  // Subtle divider line below logos
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(2, Math.round(0.18 * PX_PER_MM));
  ctx.beginPath();
  ctx.moveTo(pad, cursorY);
  ctx.lineTo(W - pad, cursorY);
  ctx.stroke();

  cursorY += Math.round((isPortraitMaxi ? 3.2 : 1.6) * PX_PER_MM);

  // 2. HERO COMMITMENT NUMBER BANNER (High contrast black box + GIANT number)
  const bannerH = isPortraitMaxi
    ? Math.round(30 * PX_PER_MM)
    : Math.round(H * 0.25);

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(
    pad,
    cursorY,
    innerW,
    bannerH,
    Math.round((isPortraitMaxi ? 2.4 : 1.4) * PX_PER_MM)
  );
  ctx.fill();

  const numText = (commitment.commitment_number || '—').trim();
  const smallCaptionFont = Math.max(
    14,
    Math.round(bannerH * (isPortraitMaxi ? 0.14 : 0.18))
  );
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${smallCaptionFont}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    isVelux ? 'IMPEGNO CLIENTE VELUX N°' : 'IMPEGNO CLIENTE N°',
    W / 2,
    cursorY + Math.round(bannerH * 0.10),
    innerW - Math.round(3 * PX_PER_MM)
  );

  let numFont = Math.round(bannerH * (isPortraitMaxi ? 0.48 : 0.56));
  const minNumFont = Math.round(bannerH * 0.26);
  const maxNumW = innerW - Math.round(4 * PX_PER_MM);
  while (numFont > minNumFont) {
    ctx.font = `900 ${numFont}px "JetBrains Mono", monospace`;
    if (ctx.measureText(numText).width <= maxNumW) break;
    numFont -= 2;
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${numFont}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    numText,
    W / 2,
    cursorY + Math.round(bannerH * 0.62),
    maxNumW
  );

  cursorY += bannerH + Math.round((isPortraitMaxi ? 4.0 : 1.8) * PX_PER_MM);

  // Reserve bottom area for Installer (if present) and optional Notes (on >= 50mm height labels)
  const showNotes = hasNotes && (isPortraitMaxi || fmt.heightMm >= 50);
  const instBoxH = hasInstaller
    ? isPortraitMaxi
      ? Math.round(18 * PX_PER_MM)
      : Math.round(H * 0.145)
    : 0;
  const notesH = showNotes
    ? isPortraitMaxi
      ? Math.round(11 * PX_PER_MM)
      : Math.round(H * 0.065)
    : 0;

  const bottomAreaH =
    (hasInstaller ? instBoxH + Math.round((isPortraitMaxi ? 2.4 : 1.0) * PX_PER_MM) : 0) +
    (showNotes ? notesH + Math.round((isPortraitMaxi ? 1.6 : 0.8) * PX_PER_MM) : 0);

  const custAvailH = Math.max(24, H - pad - bottomAreaH - cursorY);

  // 3. CUSTOMER NAME SECTION (Giant, bold, wrapped cleanly)
  const custCaptionFont = isPortraitMaxi
    ? Math.round(3.0 * PX_PER_MM)
    : Math.max(12, Math.round(H * 0.038));
  ctx.fillStyle = '#000000';
  ctx.font = `800 ${custCaptionFont}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('CLIENTE', W / 2, cursorY);

  const custTopY = cursorY + custCaptionFont + Math.round(0.6 * PX_PER_MM);
  const custTextAvailH = Math.max(20, custAvailH - (custCaptionFont + Math.round(0.6 * PX_PER_MM)));

  const custName = (commitment.customer_name || 'CLIENTE').toUpperCase();
  const maxCustFont = isPortraitMaxi
    ? Math.round(9.5 * PX_PER_MM)
    : Math.round(Math.min(custTextAvailH * 0.72, H * 0.14));
  const minCustFont = isPortraitMaxi
    ? Math.round(4.0 * PX_PER_MM)
    : Math.max(16, Math.round(H * 0.055));

  const custFit = fitDymoWrappedLines(
    ctx,
    custName,
    innerW - Math.round(2 * PX_PER_MM),
    custTextAvailH,
    maxCustFont,
    minCustFont,
    '900',
    '"Plus Jakarta Sans", Arial, sans-serif',
    isPortraitMaxi ? 4 : 3
  );

  const custBlockH = custFit.lines.length * custFit.lineHeightPx;
  const custStartY = custTopY + Math.max(0, (custTextAvailH - custBlockH) / 2);

  ctx.fillStyle = '#000000';
  ctx.font = `900 ${custFit.fontPx}px "Plus Jakarta Sans", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  custFit.lines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, custStartY + idx * custFit.lineHeightPx, innerW - Math.round(2 * PX_PER_MM));
  });

  // 4. INSTALLER BOX (Highlighted bold frame for VELUX / Installer)
  const footerBottomY = H - pad - (showNotes ? notesH + Math.round((isPortraitMaxi ? 1.4 : 0.6) * PX_PER_MM) : 0);

  if (hasInstaller) {
    const instY = footerBottomY - instBoxH;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2.5, Math.round((isPortraitMaxi ? 0.35 : 0.25) * PX_PER_MM));
    ctx.beginPath();
    ctx.roundRect(
      pad,
      instY,
      innerW,
      instBoxH,
      Math.round((isPortraitMaxi ? 2.0 : 1.2) * PX_PER_MM)
    );
    ctx.fill();
    ctx.stroke();

    const instFont = isPortraitMaxi
      ? Math.round(4.6 * PX_PER_MM)
      : Math.max(14, Math.round(instBoxH * 0.48));
    ctx.fillStyle = '#000000';
    ctx.font = `900 ${instFont}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `INSTALLATORE: ${(commitment.installer_name || '').toUpperCase()}`,
      W / 2,
      instY + instBoxH / 2 + 1,
      innerW - Math.round(3 * PX_PER_MM)
    );
  }

  // 5. OPTIONAL NOTES FOOTER
  if (showNotes) {
    const noteY = H - pad - notesH / 2;
    const noteFont = isPortraitMaxi
      ? Math.round(2.8 * PX_PER_MM)
      : Math.max(12, Math.round(notesH * 0.56));
    ctx.fillStyle = '#000000';
    ctx.font = `700 ${noteFont}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`NOTE: ${cleanNotes}`, W / 2, noteY, innerW - Math.round(2 * PX_PER_MM));
  }

  return canvas;
}

export type DymoOrientation = 'vertical' | 'horizontal';

/**
 * Renders a crisp 300-DPI thermal DYMO label for a single Catalog Product.
 */
export async function renderProductDymoCanvas(
  product: Product,
  formatId: DymoLabelSizeId = '70x54',
  orientation: DymoOrientation = 'vertical'
): Promise<HTMLCanvasElement> {
  const fmt = DYMO_LABEL_FORMATS.find((f) => f.id === formatId) || DYMO_LABEL_FORMATS[0]; // default 70x54
  const PX_PER_MM = 12;
  const isVertical99015 = fmt.id === '70x54' && orientation === 'vertical';
  const W = Math.round((isVertical99015 ? fmt.heightMm : fmt.widthMm) * PX_PER_MM);
  const H = Math.round((isVertical99015 ? fmt.widthMm : fmt.heightMm) * PX_PER_MM);

  const sagginImg = await loadSagginLogo();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const pad = Math.round(2 * PX_PER_MM);

  if (isVertical99015) {
    // Vertical 54 x 70 mm: Top header bar (Saggin logo + code) -> Centered large QR -> Wrapped description
    const barH = Math.round(8 * PX_PER_MM);
    ctx.fillStyle = '#000000';
    ctx.fillRect(pad, pad, W - pad * 2, barH);

    let codeX = pad + Math.round(1.4 * PX_PER_MM);
    if (sagginImg) {
      const sh = Math.round(barH * 0.72);
      const sw = (sagginImg.width / sagginImg.height) * sh;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(codeX - 2, pad + (barH - sh) / 2 - 2, sw + 4, sh + 4);
      ctx.drawImage(sagginImg, codeX, pad + (barH - sh) / 2, sw, sh);
      codeX += sw + Math.round(1.5 * PX_PER_MM);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(barH * 0.52)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(product.code.trim(), codeX, pad + barH / 2, W - pad - codeX - 6);

    // Large centered QR (35 x 35 mm)
    const qrSize = Math.round(35 * PX_PER_MM);
    const qrY = pad + barH + Math.round(2.5 * PX_PER_MM);
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, product.code.trim(), {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    ctx.drawImage(qrCanvas, Math.round((W - qrSize) / 2), qrY, qrSize, qrSize);

    // Bottom wrapped description
    const descY = qrY + qrSize + Math.round(2.2 * PX_PER_MM);
    const descW = W - pad * 2;
    const descFont = Math.round(3.6 * PX_PER_MM);
    ctx.fillStyle = '#000000';
    ctx.font = `800 ${descFont}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const lines = wrapDymoText(ctx, product.description, descW);
    const lineH = Math.round(descFont * 1.18);
    lines.slice(0, 4).forEach((l, i) => {
      ctx.fillText(l, W / 2, descY + i * lineH, descW);
    });

    return canvas;
  }

  if (fmt.id === '70x54') {
    // Horizontal 70 x 54 mm: Full-width top code bar
    const barH = Math.round(8.5 * PX_PER_MM);
    ctx.fillStyle = '#000000';
    ctx.fillRect(pad, pad, W - pad * 2, barH);

    let codeX = pad + Math.round(1.5 * PX_PER_MM);
    if (sagginImg) {
      const sh = Math.round(barH * 0.72);
      const sw = (sagginImg.width / sagginImg.height) * sh;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(codeX - 2, pad + (barH - sh) / 2 - 2, sw + 4, sh + 4);
      ctx.drawImage(sagginImg, codeX, pad + (barH - sh) / 2, sw, sh);
      codeX += sw + Math.round(1.8 * PX_PER_MM);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(barH * 0.56)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(product.code, codeX, pad + barH / 2, W - pad - codeX - 8);

    const bodyY = pad + barH + Math.round(2 * PX_PER_MM);
    const availH = H - bodyY - pad;
    const qrSize = Math.min(availH, Math.round(31 * PX_PER_MM));
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, product.code.trim(), {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    ctx.drawImage(qrCanvas, pad, bodyY, qrSize, qrSize);

    const rightX = pad + qrSize + Math.round(2.4 * PX_PER_MM);
    const rightW = W - rightX - pad;
    const descFont = Math.round(4.0 * PX_PER_MM);
    ctx.fillStyle = '#000000';
    ctx.font = `800 ${descFont}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const words = product.description.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (ctx.measureText(cand).width <= rightW) {
        line = cand;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);

    const lineH = Math.round(descFont * 1.18);
    lines.slice(0, 5).forEach((l, i) => {
      ctx.fillText(l, rightX, bodyY + i * lineH, rightW);
    });

    return canvas;
  }

  const qrSize = H - pad * 2;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, product.code.trim(), {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

  ctx.drawImage(qrCanvas, pad, pad, qrSize, qrSize);

  const rightX = pad + qrSize + Math.round(2 * PX_PER_MM);
  const rightW = W - rightX - pad;
  let cursorY = pad;

  // Code header bar
  const barH = Math.round(H * 0.24);
  ctx.fillStyle = '#000000';
  ctx.fillRect(rightX, cursorY, rightW, barH);

  let codeX = rightX + Math.round(1.5 * PX_PER_MM);
  if (sagginImg) {
    const sh = Math.round(barH * 0.72);
    const sw = (sagginImg.width / sagginImg.height) * sh;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(codeX - 2, cursorY + (barH - sh) / 2 - 2, sw + 4, sh + 4);
    ctx.drawImage(sagginImg, codeX, cursorY + (barH - sh) / 2, sw, sh);
    codeX += sw + Math.round(1.5 * PX_PER_MM);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(barH * 0.56)}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(product.code, codeX, cursorY + barH / 2, rightX + rightW - codeX - 4);

  cursorY += barH + Math.round(1.5 * PX_PER_MM);

  // Description wrapped cleanly
  const descFont = Math.round(H * 0.11);
  ctx.fillStyle = '#000000';
  ctx.font = `800 ${descFont}px "Plus Jakarta Sans", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const words = product.description.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (ctx.measureText(cand).width <= rightW) {
      line = cand;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);

  const lineH = Math.round(descFont * 1.18);
  lines.slice(0, 4).forEach((l, i) => {
    ctx.fillText(l, rightX, cursorY + i * lineH, rightW);
  });

  return canvas;
}

export type DymoProductLayout = '1_single' | '2_medium' | '6_ferramenta';

export const DYMO_PRODUCT_LAYOUTS: {
  id: DymoProductLayout;
  label: string;
  shortLabel: string;
  slotsPerLabel: number;
  description: string;
}[] = [
  {
    id: '1_single',
    label: '1 per etichetta (Singola)',
    shortLabel: '1× Singola',
    slotsPerLabel: 1,
    description: '1 etichetta grande · Logo Saggin, QR grande e descrizione completa',
  },
  {
    id: '2_medium',
    label: '2 per etichetta (Media)',
    shortLabel: '2× Media',
    slotsPerLabel: 2,
    description: '2 etichette medie su ogni 99015 · Logo Saggin, QR 21×21 mm e descrizione',
  },
  {
    id: '6_ferramenta',
    label: '6 per etichetta (Ferramenta)',
    shortLabel: '6× Ferramenta',
    slotsPerLabel: 6,
    description: '6 mini-etichette su ogni 99015 · Logo Saggin, QR e descrizione',
  },
];

function wrapDymoText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (ctx.measureText(cand).width <= maxWidth) {
      line = cand;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Renders 1, 2, or 6 product labels onto a single DYMO 99015 canvas (54 x 70 mm vertical or 70 x 54 mm horizontal)
 * in pure high-contrast B&W (#000000 on #ffffff) for crisp thermal printing.
 * Every format includes Saggin logo, unobstructed QR code, code, and description.
 */
export async function renderProductDymoSheetCanvas(
  products: Product[],
  layout: DymoProductLayout,
  formatId: DymoLabelSizeId = '70x54',
  orientation: DymoOrientation = 'vertical'
): Promise<HTMLCanvasElement> {
  if (layout === '1_single' && products[0]) {
    return renderProductDymoCanvas(products[0], formatId, orientation);
  }

  const fmt = DYMO_LABEL_FORMATS.find((f) => f.id === formatId) || DYMO_LABEL_FORMATS[0];
  const PX_PER_MM = 12;
  const isVertical99015 = fmt.id === '70x54' && orientation === 'vertical';
  const W = Math.round((isVertical99015 ? fmt.heightMm : fmt.widthMm) * PX_PER_MM);
  const H = Math.round((isVertical99015 ? fmt.widthMm : fmt.heightMm) * PX_PER_MM);

  const sagginImg = await loadSagginLogo();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const pad = Math.round(1.5 * PX_PER_MM);

  if (layout === '2_medium') {
    // 2 medium labels stacked vertically (1 col x 2 rows)
    const rows = 2;
    const cellW = W - pad * 2;
    const gapY = Math.round(1.5 * PX_PER_MM);
    const cellH = Math.floor((H - pad * 2 - gapY) / rows);
    const slice = products.slice(0, 2);

    for (let i = 0; i < slice.length; i++) {
      const prod = slice[i];
      const x = pad;
      const y = pad + i * (cellH + gapY);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();

      if (isVertical99015) {
        // Vertical 54x70 -> each cell is ~51 x 32.5 mm:
        // Top full-width black bar (Saggin Logo + Code), below: Left QR (21mm) + Right wrapped description
        const barH = Math.round(5.4 * PX_PER_MM);
        const barY = y + Math.round(0.8 * PX_PER_MM);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + Math.round(0.6 * PX_PER_MM), barY, cellW - Math.round(1.2 * PX_PER_MM), barH);

        let codeX = x + Math.round(1.6 * PX_PER_MM);
        if (sagginImg) {
          const sh = Math.round(barH * 0.72);
          const sw = (sagginImg.width / sagginImg.height) * sh;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(codeX - 2, barY + (barH - sh) / 2 - 2, sw + 4, sh + 4);
          ctx.drawImage(sagginImg, codeX, barY + (barH - sh) / 2, sw, sh);
          codeX += sw + Math.round(1.4 * PX_PER_MM);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.round(barH * 0.56)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          prod.code.trim(),
          codeX,
          barY + barH / 2,
          x + cellW - Math.round(1.2 * PX_PER_MM) - codeX
        );

        const bodyY = barY + barH + Math.round(1.4 * PX_PER_MM);
        const availH = y + cellH - bodyY - Math.round(0.8 * PX_PER_MM);
        const qrSize = Math.min(availH, Math.round(21.5 * PX_PER_MM));
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, prod.code.trim(), {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
        ctx.drawImage(qrCanvas, x + Math.round(0.8 * PX_PER_MM), bodyY, qrSize, qrSize);

        const rightX = x + Math.round(0.8 * PX_PER_MM) + qrSize + Math.round(1.8 * PX_PER_MM);
        const rightW = x + cellW - rightX - Math.round(0.8 * PX_PER_MM);
        const descFont = Math.round(2.9 * PX_PER_MM);
        ctx.fillStyle = '#000000';
        ctx.font = `800 ${descFont}px "Plus Jakarta Sans", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const lines = wrapDymoText(ctx, prod.description, rightW);
        const lineH = Math.round(descFont * 1.18);
        lines.slice(0, 5).forEach((l, idx) => {
          ctx.fillText(l, rightX, bodyY + idx * lineH, rightW);
        });
      } else {
        // Horizontal 70x54 -> each cell is ~67 x 25 mm
        const qrSize = Math.min(cellH - Math.round(2 * PX_PER_MM), Math.round(21 * PX_PER_MM));
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, prod.code.trim(), {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
        const qrY = y + Math.round((cellH - qrSize) / 2);
        ctx.drawImage(qrCanvas, x + Math.round(1 * PX_PER_MM), qrY, qrSize, qrSize);

        const rightX = x + Math.round(1 * PX_PER_MM) + qrSize + Math.round(2 * PX_PER_MM);
        const rightW = x + cellW - rightX - Math.round(1 * PX_PER_MM);
        const barH = Math.round(5.8 * PX_PER_MM);

        ctx.fillStyle = '#000000';
        ctx.fillRect(rightX, y + Math.round(1 * PX_PER_MM), rightW, barH);

        let codeX = rightX + Math.round(1.2 * PX_PER_MM);
        if (sagginImg) {
          const sh = Math.round(barH * 0.72);
          const sw = (sagginImg.width / sagginImg.height) * sh;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(codeX - 2, y + Math.round(1 * PX_PER_MM) + (barH - sh) / 2 - 2, sw + 4, sh + 4);
          ctx.drawImage(sagginImg, codeX, y + Math.round(1 * PX_PER_MM) + (barH - sh) / 2, sw, sh);
          codeX += sw + Math.round(1.5 * PX_PER_MM);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.round(barH * 0.56)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          prod.code.trim(),
          codeX,
          y + Math.round(1 * PX_PER_MM) + barH / 2,
          rightX + rightW - codeX - 4
        );

        const descY = y + Math.round(1 * PX_PER_MM) + barH + Math.round(1.4 * PX_PER_MM);
        const descFont = Math.round(3.1 * PX_PER_MM);
        ctx.fillStyle = '#000000';
        ctx.font = `800 ${descFont}px "Plus Jakarta Sans", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const lines = wrapDymoText(ctx, prod.description, rightW);
        const lineH = Math.round(descFont * 1.18);
        lines.slice(0, 3).forEach((l, idx) => {
          ctx.fillText(l, rightX, descY + idx * lineH, rightW);
        });
      }

      ctx.restore();
    }

    // Crisp pure-black dashed cut line between top and bottom label
    const midY = Math.round(H / 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(pad, midY);
    ctx.lineTo(W - pad, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    return canvas;
  }

  // '6_ferramenta':
  // Vertical 54x70 -> 2 cols x 3 rows (~25.5 x 22.3 mm each)
  // Horizontal 70x54 -> 3 cols x 2 rows (~22.3 x 25.5 mm each)
  const cols = isVertical99015 ? 2 : fmt.widthMm >= 65 ? 3 : 2;
  const rows = isVertical99015 ? 3 : fmt.heightMm >= 48 ? 2 : 1;
  const cellW = Math.floor((W - pad * 2) / cols);
  const cellH = Math.floor((H - pad * 2) / rows);
  const startX = Math.round((W - cellW * cols) / 2);
  const startY = Math.round((H - cellH * rows) / 2);

  const slice = products.slice(0, cols * rows);

  for (let i = 0; i < slice.length; i++) {
    const prod = slice[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    const innerPad = Math.round(0.8 * PX_PER_MM);
    const innerW = cellW - innerPad * 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();

    // Top black bar with Saggin Logo + Product Code
    const barH = Math.round((isVertical99015 ? 3.5 : 3.8) * PX_PER_MM);
    const barY = y + innerPad;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + innerPad, barY, innerW, barH);

    let codeX = x + innerPad + Math.round(0.7 * PX_PER_MM);
    if (sagginImg) {
      const sh = Math.round(barH * 0.72);
      const sw = (sagginImg.width / sagginImg.height) * sh;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(codeX - 1, barY + (barH - sh) / 2 - 1, sw + 2, sh + 2);
      ctx.drawImage(sagginImg, codeX, barY + (barH - sh) / 2, sw, sh);
      codeX += sw + Math.round(0.8 * PX_PER_MM);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(2.2 * PX_PER_MM)}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      prod.code.trim(),
      codeX,
      barY + barH / 2,
      x + innerPad + innerW - codeX - 3
    );

    // Crisp unobstructed QR (12.0 mm in vertical 2x3, 13.2 mm in horizontal 3x2)
    const qrSize = Math.round((isVertical99015 ? 11.8 : 13.2) * PX_PER_MM);
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, prod.code.trim(), {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    const qrX = x + Math.round((cellW - qrSize) / 2);
    const qrY = barY + barH + Math.round(0.45 * PX_PER_MM);
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Bottom description (2 wrapped lines in pure black for crisp thermal readability)
    const descY = qrY + qrSize + Math.round(0.35 * PX_PER_MM);
    const descFont = Math.round((isVertical99015 ? 1.9 : 2.0) * PX_PER_MM);
    ctx.fillStyle = '#000000';
    ctx.font = `800 ${descFont}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const descLines = wrapDymoText(ctx, prod.description, innerW);
    const descLineH = Math.round(descFont * 1.15);
    descLines.slice(0, 2).forEach((l, idx) => {
      ctx.fillText(l, x + cellW / 2, descY + idx * descLineH, innerW);
    });

    ctx.restore();
  }

  // Crisp pure-black dashed cut lines between cells (no gray dithering on thermal printhead)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  for (let c = 1; c < cols; c++) {
    const cx = startX + c * cellW;
    ctx.beginPath();
    ctx.moveTo(cx, startY);
    ctx.lineTo(cx, startY + cellH * rows);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const ry = startY + r * cellH;
    ctx.beginPath();
    ctx.moveTo(startX, ry);
    ctx.lineTo(startX + cellW * cols, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  return canvas;
}

export async function renderDymoFerramentaSheetCanvas(
  products: Product[],
  formatId: DymoLabelSizeId = '70x54',
  orientation: DymoOrientation = 'vertical'
): Promise<HTMLCanvasElement> {
  return renderProductDymoSheetCanvas(products, '6_ferramenta', formatId, orientation);
}

/**
 * Prints a label canvas directly to the DYMO Connect Web Service (1-click silent print without dialog).
 */
export async function printViaDymoWebService(
  printer: DymoPrinterInfo,
  labelCanvas: HTMLCanvasElement,
  formatId: DymoLabelSizeId,
  copies = 1
): Promise<void> {
  const fmt = DYMO_LABEL_FORMATS.find((f) => f.id === formatId) || DYMO_LABEL_FORMATS[0];
  const base64Png = labelCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');

  const isPortrait = labelCanvas.height > labelCanvas.width;
  const effWidthMm = isPortrait ? Math.min(fmt.widthMm, fmt.heightMm) : Math.max(fmt.widthMm, fmt.heightMm);
  const effHeightMm = isPortrait ? Math.max(fmt.widthMm, fmt.heightMm) : Math.min(fmt.widthMm, fmt.heightMm);

  // Convert mm to twips (1 mm = 56.692913 twips)
  const wTwips = Math.round(effWidthMm * 56.692913);
  const hTwips = Math.round(effHeightMm * 56.692913);
  const rollNarrowTwips = Math.round(Math.min(fmt.widthMm, fmt.heightMm) * 56.692913);
  const rollLongTwips = Math.round(Math.max(fmt.widthMm, fmt.heightMm) * 56.692913);

  const labelXml = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>${isPortrait ? 'Portrait' : 'Landscape'}</PaperOrientation>
  <Id>Custom</Id>
  <PaperName>${fmt.dymoPaperName}</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${rollNarrowTwips}" Height="${rollLongTwips}" Rx="180" Ry="180" />
  </DrawCommands>
  <ObjectInfo>
    <ImageObject>
      <Name>SagginQrLabel</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <Image>${base64Png}</Image>
      <ScaleMode>Uniform</ScaleMode>
      <BorderWidth>0</BorderWidth>
      <BorderColor Alpha="255" Red="0" Green="0" Blue="0" />
      <HorizontalAlignment>Center</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
    </ImageObject>
    <Bounds X="60" Y="60" Width="${wTwips - 120}" Height="${hTwips - 120}" />
  </ObjectInfo>
</DieCutLabel>`;

  const printParamsXml = `<?xml version="1.0" encoding="utf-8"?>
<LabelWriterPrintParams>
  <Copies>${Math.max(1, copies)}</Copies>
  <PrintQuality>BarcodeAndGraphics</PrintQuality>
  <TwinTurboRoll>Auto</TwinTurboRoll>
</LabelWriterPrintParams>`;

  const body = new URLSearchParams({
    printerName: printer.name,
    printParamsXml,
    labelXml,
    labelSetXml: '',
  });

  const res = await fetch(`${printer.serviceUrl}/PrintLabel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Errore DYMO Web Service (${res.status})`);
  }
}

/**
 * Fallback/Universal DYMO print via system printer driver with exact @page size matching the DYMO roll.
 */
export function printDymoViaBrowserDriver(
  labelCanvas: HTMLCanvasElement,
  formatId: DymoLabelSizeId,
  copies = 1
): void {
  const fmt = DYMO_LABEL_FORMATS.find((f) => f.id === formatId) || DYMO_LABEL_FORMATS[0];
  const isPortrait = labelCanvas.height > labelCanvas.width;
  const effWidthMm = isPortrait ? Math.min(fmt.widthMm, fmt.heightMm) : Math.max(fmt.widthMm, fmt.heightMm);
  const effHeightMm = isPortrait ? Math.max(fmt.widthMm, fmt.heightMm) : Math.min(fmt.widthMm, fmt.heightMm);
  const dataUrl = labelCanvas.toDataURL('image/png');

  const existing = document.getElementById('saggin-dymo-print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'saggin-dymo-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const pagesHtml = Array.from({ length: Math.max(1, copies) })
    .map(() => `<div class="dymo-label"><img src="${dataUrl}" alt="DYMO Label" /></div>`)
    .join('');

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Stampa DYMO ${fmt.name}</title>
  <style>
    @page { size: ${effWidthMm}mm ${effHeightMm}mm; margin: 0mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${effWidthMm}mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dymo-label { width: ${effWidthMm}mm; height: ${effHeightMm}mm; page-break-after: always; break-after: page; overflow: hidden; }
    .dymo-label:last-child { page-break-after: auto; break-after: auto; }
    .dymo-label img { width: ${effWidthMm}mm; height: ${effHeightMm}mm; display: block; object-fit: contain; }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 120);
    };
  </script>
</body>
</html>`);
  doc.close();
}

/**
 * Prints multiple distinct DYMO label canvases in sequence (either via DYMO Connect Web Service or system driver).
 */
export async function printDymoCanvasesBatch(
  canvases: HTMLCanvasElement[],
  formatId: DymoLabelSizeId = '70x54'
): Promise<void> {
  if (canvases.length === 0) return;
  const printers = await detectDymoPrinters();
  const activePrinter = printers.find((p) => p.isConnected) || printers[0];

  if (activePrinter) {
    for (const c of canvases) {
      await printViaDymoWebService(activePrinter, c, formatId, 1);
    }
    return;
  }

  const fmt = DYMO_LABEL_FORMATS.find((f) => f.id === formatId) || DYMO_LABEL_FORMATS[0];
  const isPortrait = canvases[0].height > canvases[0].width;
  const effWidthMm = isPortrait ? Math.min(fmt.widthMm, fmt.heightMm) : Math.max(fmt.widthMm, fmt.heightMm);
  const effHeightMm = isPortrait ? Math.max(fmt.widthMm, fmt.heightMm) : Math.min(fmt.widthMm, fmt.heightMm);

  const existing = document.getElementById('saggin-dymo-print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'saggin-dymo-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const pagesHtml = canvases
    .map((c) => `<div class="dymo-label"><img src="${c.toDataURL('image/png')}" alt="DYMO Label" /></div>`)
    .join('');

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Stampa DYMO ${fmt.name}</title>
  <style>
    @page { size: ${effWidthMm}mm ${effHeightMm}mm; margin: 0mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${effWidthMm}mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dymo-label { width: ${effWidthMm}mm; height: ${effHeightMm}mm; page-break-after: always; break-after: page; overflow: hidden; }
    .dymo-label:last-child { page-break-after: auto; break-after: auto; }
    .dymo-label img { width: ${effWidthMm}mm; height: ${effHeightMm}mm; display: block; object-fit: contain; }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.focus(); window.print(); }, 120);
    };
  </script>
</body>
</html>`);
  doc.close();
}

export type DymoImageFormat = 'png' | 'jpg';

/**
 * Converts a rendered DYMO label canvas to a PNG or high-quality white-background JPG data URL.
 */
export function canvasToImageDataUrl(
  canvas: HTMLCanvasElement,
  format: DymoImageFormat
): string {
  if (format === 'png') {
    return canvas.toDataURL('image/png');
  }

  const jpgCanvas = document.createElement('canvas');
  jpgCanvas.width = canvas.width;
  jpgCanvas.height = canvas.height;
  const ctx = jpgCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
    ctx.drawImage(canvas, 0, 0);
  }
  return jpgCanvas.toDataURL('image/jpeg', 0.96);
}

/**
 * Downloads a single DYMO label canvas as .png or .jpg for direct import into DYMO software.
 */
export function downloadCanvasAsImage(
  canvas: HTMLCanvasElement,
  filenameBase: string,
  format: DymoImageFormat
): void {
  const safeBase = filenameBase.replace(/\.[^.]+$/, '');
  const dataUrl = canvasToImageDataUrl(canvas, format);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${safeBase}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Downloads one or more DYMO label canvases as .png or .jpg files.
 */
export async function downloadDymoCanvasesAsImages(
  canvases: HTMLCanvasElement[],
  filenameBase: string,
  format: DymoImageFormat
): Promise<void> {
  if (canvases.length === 0) return;
  if (canvases.length === 1) {
    downloadCanvasAsImage(canvases[0], filenameBase, format);
    return;
  }

  for (let i = 0; i < canvases.length; i++) {
    const suffix = String(i + 1).padStart(2, '0');
    downloadCanvasAsImage(canvases[i], `${filenameBase}_${suffix}`, format);
    if (i < canvases.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }
}

