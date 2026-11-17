import QRCode from 'qrcode';
import { Product, CompanySettings } from '../types';

export type QrSheetPresetId =
  | 'qr_2x2_117'      // Ferramenta 2x2 cm · 9 col x 13 righe (117/foglio) · Mini per minuteria
  | 'qr_3x3_20'       // QR 3x3 cm · 4 col x 5 righe (20/foglio) · Spazio extra per nomi lunghi
  | 'qr_3x3_30'       // QR 3x3 cm · 5 col x 6 righe (30/foglio) · Alta densità
  | 'qr_3.5x3.5_16'   // QR 3.5x3.5 cm · 4 col x 4 righe (16/foglio) · Medio-Grande
  | 'qr_4x4_12'       // QR 4x4 cm · 3 col x 4 righe (12/foglio) · Grande da Scaffale/Piazzale
  | 'qr_horiz_14';    // QR 3.2x3.2 cm Orizzontale · 2 col x 7 righe (14/foglio) · Ideale per nomi lunghissimi

export interface QrSheetPreset {
  id: QrSheetPresetId;
  label: string;
  qrSizeCm: string;
  qrMm: number;
  cols: number;
  rows: number;
  orientation: 'vertical' | 'horizontal';
  description: string;
}

export const QR_SHEET_PRESETS: QrSheetPreset[] = [
  {
    id: 'qr_2x2_117',
    label: 'Ferramenta 2×2 cm · Mini (117/foglio)',
    qrSizeCm: '2×2 cm (Mini)',
    qrMm: 12.5,
    cols: 9,
    rows: 13,
    orientation: 'vertical',
    description: '9×13 mini-etichette (21×21 mm) · Ideale per ferramenta, viti, bulloni e sacchetti piccoli',
  },
  {
    id: 'qr_3x3_20',
    label: 'QR 3×3 cm · Standard (20/foglio)',
    qrSizeCm: '3×3 cm',
    qrMm: 30,
    cols: 4,
    rows: 5,
    orientation: 'vertical',
    description: '4×5 etichette (48×54 mm) · QR 3×3 cm netto + ampio spazio per descrizioni lunghe complete',
  },
  {
    id: 'qr_3x3_30',
    label: 'QR 3×3 cm · Compatto (30/foglio)',
    qrSizeCm: '2.8×2.8 cm',
    qrMm: 28,
    cols: 5,
    rows: 6,
    orientation: 'vertical',
    description: '5×6 etichette (39×45 mm) · Massima resa su foglio A4 con taglio unico',
  },
  {
    id: 'qr_3.5x3.5_16',
    label: 'QR 3.5×3.5 cm · Scaffale (16/foglio)',
    qrSizeCm: '3.5×3.5 cm',
    qrMm: 35,
    cols: 4,
    rows: 4,
    orientation: 'vertical',
    description: '4×4 etichette (48×68 mm) · QR 3.5×3.5 cm + testo grande ad alta visibilità',
  },
  {
    id: 'qr_4x4_12',
    label: 'QR 4×4 cm · Maxi (12/foglio)',
    qrSizeCm: '4×4 cm',
    qrMm: 40,
    cols: 3,
    rows: 4,
    orientation: 'vertical',
    description: '3×4 etichette (64×68 mm) · QR 4×4 cm per bancali, travi e piazzale esterno',
  },
  {
    id: 'qr_horiz_14',
    label: 'Striscia Scaffale Orizzontale (14/foglio)',
    qrSizeCm: '3.2×3.2 cm',
    qrMm: 32,
    cols: 2,
    rows: 7,
    orientation: 'horizontal',
    description: '2×7 strisce (97×39 mm) · QR a sinistra e descrizione estesa a destra (perfetto per acciai e tubi)',
  },
];

export interface QrRenderOptions {
  presetId: QrSheetPresetId;
  showHeaderLogo: boolean;
  showLogoInQrCenter: boolean;
  showUnitBadge: boolean;
  showCutLines: boolean;
  darkHeaderStyle: boolean;
  companyName: string;
}

// Cache loaded logo image
let cachedLogoImg: HTMLImageElement | null = null;

export async function loadSagginLogo(): Promise<HTMLImageElement | null> {
  if (cachedLogoImg) return cachedLogoImg;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedLogoImg = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = '/saggin-logo.png';
  });
}

// Word-wrap helper that returns lines for a given font size and width
function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidthPx) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      // If a single word is wider than maxWidthPx, split it gracefully
      if (ctx.measureText(word).width > maxWidthPx) {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width <= maxWidthPx) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Fits the complete product description inside [boxWidthPx x boxHeightPx]
 * without EVER cutting off or truncating words, by automatically stepping down
 * the font size until all lines fit inside boxHeightPx.
 */
function fitFullDescriptionInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxWidthPx: number,
  boxHeightPx: number,
  maxFontPx: number,
  minFontPx: number
): { fontPx: number; lines: string[]; lineHeightPx: number } {
  for (let fontPx = maxFontPx; fontPx >= minFontPx; fontPx -= 1) {
    ctx.font = `700 ${fontPx}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
    const lines = wrapTextLines(ctx, text, boxWidthPx);
    const lineHeightPx = Math.round(fontPx * 1.18);
    if (lines.length * lineHeightPx <= boxHeightPx) {
      return { fontPx, lines, lineHeightPx };
    }
  }
  // Fallback at minimum font size: still return all lines with tight line height
  ctx.font = `700 ${minFontPx}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
  const lines = wrapTextLines(ctx, text, boxWidthPx);
  return {
    fontPx: minFontPx,
    lines,
    lineHeightPx: Math.round(minFontPx * 1.12),
  };
}

/**
 * Renders a single A4 page (210mm x 297mm) at high resolution (10 px per mm = 2100 x 2970 px, ~254 DPI)
 * with continuous guillotine cut lines and external crop marks.
 */
export async function renderA4SheetToCanvas(
  pageProducts: Product[],
  pageIndex: number,
  totalPages: number,
  totalProductsCount: number,
  options: QrRenderOptions
): Promise<HTMLCanvasElement> {
  const preset = QR_SHEET_PRESETS.find((p) => p.id === options.presetId) || QR_SHEET_PRESETS[0];
  const logoImg = await loadSagginLogo();

  // Scale: 10 pixels = 1 millimeter -> 2100 x 2970 px (Crystal clear vector-grade print)
  const PX_PER_MM = 10;
  const pageWidthMm = 210;
  const pageHeightMm = 297;

  const canvas = document.createElement('canvas');
  canvas.width = pageWidthMm * PX_PER_MM;
  canvas.height = pageHeightMm * PX_PER_MM;
  const ctx = canvas.getContext('2d')!;

  // White A4 background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer margins for safe printing on any laser/inkjet printer:
  // Left/Right: 8 mm -> Grid width = 194 mm
  // Top: 14 mm (includes 7 mm compact sheet title + 2 mm gap) -> Grid starts at Y = 14 mm
  // Bottom: 9 mm -> Grid height = 274 mm
  const gridLeftMm = 8;
  const gridTopMm = 14;
  const gridWidthMm = 194;
  const gridHeightMm = 274;

  const gridLeftPx = gridLeftMm * PX_PER_MM;
  const gridTopPx = gridTopMm * PX_PER_MM;
  const gridWidthPx = gridWidthMm * PX_PER_MM;
  const gridHeightPx = gridHeightMm * PX_PER_MM;

  const cellWidthPx = gridWidthPx / preset.cols;
  const cellHeightPx = gridHeightPx / preset.rows;

  // 1. Draw Top Sheet Info Bar (outside the cut grid, in the top margin 5mm..11mm)
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 ${2.8 * PX_PER_MM}px "Plus Jakarta Sans", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${options.companyName || 'SAGGIN GUGLIELMO S.R.L.'} · ETICHETTE QR CODE (${preset.qrSizeCm})`,
    gridLeftPx,
    8.5 * PX_PER_MM
  );

  ctx.fillStyle = '#64748b';
  ctx.font = `600 ${2.4 * PX_PER_MM}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'right';
  ctx.fillText(
    `✂ Griglia Taglio Unico Taglierina · Foglio ${pageIndex + 1}/${totalPages} (${totalProductsCount} art.)`,
    gridLeftPx + gridWidthPx,
    8.5 * PX_PER_MM
  );
  ctx.restore();

  // 2. Pre-generate QR Code images for all items on this page
  // IMPORTANT: Never draw a logo on top of the QR matrix modules! Short product codes use
  // Version 1 (21x21) where a center badge destroys format info bits. The Saggin logo is
  // already prominently displayed in the label header bar right above the QR code.
  const qrImages = await Promise.all(
    pageProducts.map(async (prod) => {
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, prod.code.trim(), {
        width: Math.round(preset.qrMm * PX_PER_MM),
        margin: 3,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
      return qrCanvas;
    })
  );

  // 3. Draw Each Cell Content
  for (let i = 0; i < pageProducts.length; i++) {
    const product = pageProducts[i];
    const qrCanvas = qrImages[i];
    const col = i % preset.cols;
    const row = Math.floor(i / preset.cols);

    const cellX = gridLeftPx + col * cellWidthPx;
    const cellY = gridTopPx + row * cellHeightPx;

    ctx.save();
    // Clip to cell boundaries so nothing ever bleeds into neighbor cell
    ctx.beginPath();
    ctx.rect(cellX, cellY, cellWidthPx, cellHeightPx);
    ctx.clip();

    if (preset.orientation === 'horizontal') {
      // ================================================================
      // HORIZONTAL STRIP LAYOUT (QR on Left, Logo + Code + Full Desc on Right)
      // ================================================================
      const padPx = 2.2 * PX_PER_MM;
      const qrSizePx = preset.qrMm * PX_PER_MM;
      const qrX = cellX + padPx;
      const qrY = cellY + (cellHeightPx - qrSizePx) / 2;

      // Draw QR on left
      ctx.drawImage(qrCanvas, qrX, qrY, qrSizePx, qrSizePx);

      // Right side content box
      const rightX = qrX + qrSizePx + 2.5 * PX_PER_MM;
      const rightW = cellX + cellWidthPx - rightX - padPx;
      let cursorY = cellY + padPx;

      // Top row on right: Logo + Code + U.M.
      const headerH = 6.5 * PX_PER_MM;
      if (options.darkHeaderStyle) {
        ctx.fillStyle = '#0b0f19';
        ctx.beginPath();
        ctx.roundRect(rightX, cursorY, rightW, headerH, 6);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.roundRect(rightX, cursorY, rightW, headerH, 6);
        ctx.fill();
      }

      let codeLeftX = rightX + 1.5 * PX_PER_MM;
      if (options.showHeaderLogo && logoImg) {
        const lh = 4.6 * PX_PER_MM;
        const lw = (logoImg.width / logoImg.height) * lh;
        if (options.darkHeaderStyle) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(codeLeftX - 2, cursorY + (headerH - lh) / 2 - 2, lw + 4, lh + 4, 4);
          ctx.fill();
        }
        ctx.drawImage(logoImg, codeLeftX, cursorY + (headerH - lh) / 2, lw, lh);
        codeLeftX += lw + 1.8 * PX_PER_MM;
      }

      // Product Code
      ctx.fillStyle = options.darkHeaderStyle ? '#ffffff' : '#0f172a';
      ctx.font = `800 ${3.4 * PX_PER_MM}px "JetBrains Mono", monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(product.code, codeLeftX, cursorY + headerH / 2);

      // Unit of Measure Badge
      if (options.showUnitBadge && product.unit_of_measure) {
        ctx.fillStyle = '#dc2626';
        ctx.font = `800 ${2.5 * PX_PER_MM}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(
          product.unit_of_measure.toUpperCase(),
          rightX + rightW - 1.5 * PX_PER_MM,
          cursorY + headerH / 2
        );
      }

      cursorY += headerH + 1.8 * PX_PER_MM;

      // Full Description Box on the right
      const descBoxH = cellY + cellHeightPx - cursorY - padPx;
      const fitted = fitFullDescriptionInBox(
        ctx,
        product.description,
        rightW,
        descBoxH,
        Math.round(3.1 * PX_PER_MM),
        Math.round(2.0 * PX_PER_MM)
      );

      ctx.fillStyle = '#0f172a';
      ctx.font = `700 ${fitted.fontPx}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      fitted.lines.forEach((line, idx) => {
        ctx.fillText(line, rightX, cursorY + idx * fitted.lineHeightPx);
      });
    } else {
      // ================================================================
      // VERTICAL LABEL LAYOUT (Top Bar -> Centered QR -> Full Description)
      // ================================================================
      const isMiniCell = preset.rows >= 10;
      const padX = (isMiniCell ? 1.0 : 2.0) * PX_PER_MM;
      const headerH = (isMiniCell ? 3.4 : preset.rows >= 6 ? 5.6 : 6.8) * PX_PER_MM;

      // Top Header Bar
      if (options.darkHeaderStyle) {
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(cellX, cellY, cellWidthPx, headerH);
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(cellX, cellY, cellWidthPx, headerH);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cellX, cellY + headerH);
        ctx.lineTo(cellX + cellWidthPx, cellY + headerH);
        ctx.stroke();
      }

      if (isMiniCell) {
        // Mini 2x2 cm cell: centered product code in top bar for maximum legibility
        const codeFontPx = Math.round(2.1 * PX_PER_MM);
        ctx.fillStyle = options.darkHeaderStyle ? '#ffffff' : '#0f172a';
        ctx.font = `900 ${codeFontPx}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(product.code, cellX + cellWidthPx / 2, cellY + headerH / 2, cellWidthPx - padX * 2);
      } else {
        let codeStartX = cellX + padX;
        if (options.showHeaderLogo && logoImg) {
          const lh = headerH * 0.68;
          const lw = (logoImg.width / logoImg.height) * lh;
          const ly = cellY + (headerH - lh) / 2;
          if (options.darkHeaderStyle) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(codeStartX - 2, ly - 1, lw + 4, lh + 2, 3);
            ctx.fill();
          }
          ctx.drawImage(logoImg, codeStartX, ly, lw, lh);
          codeStartX += lw + 1.4 * PX_PER_MM;
        }

        // Draw Product Code
        const codeFontPx = Math.round((preset.rows >= 6 ? 2.6 : 3.1) * PX_PER_MM);
        ctx.fillStyle = options.darkHeaderStyle ? '#ffffff' : '#0f172a';
        ctx.font = `800 ${codeFontPx}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(product.code, codeStartX, cellY + headerH / 2);

        // Draw Unit of Measure on far right of header
        if (options.showUnitBadge && product.unit_of_measure) {
          const umFontPx = Math.round((preset.rows >= 6 ? 2.1 : 2.4) * PX_PER_MM);
          ctx.fillStyle = options.darkHeaderStyle ? '#f87171' : '#dc2626';
          ctx.font = `800 ${umFontPx}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'right';
          ctx.fillText(
            product.unit_of_measure.toUpperCase(),
            cellX + cellWidthPx - padX,
            cellY + headerH / 2
          );
        }
      }

      // Draw QR Code Centered below header
      const qrSizePx = preset.qrMm * PX_PER_MM;
      const qrX = cellX + (cellWidthPx - qrSizePx) / 2;
      const qrY = cellY + headerH + (isMiniCell ? 0.5 : 1.0) * PX_PER_MM;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSizePx, qrSizePx);

      // Full Description Area underneath the QR code
      const descTopY = qrY + qrSizePx + (isMiniCell ? 0.4 : 0.8) * PX_PER_MM;
      const descBottomPad = (isMiniCell ? 0.5 : 1.2) * PX_PER_MM;
      const descBoxHeight = cellY + cellHeightPx - descTopY - descBottomPad;
      const descBoxWidth = cellWidthPx - padX * 2;

      const maxDescFont = Math.round((isMiniCell ? 1.65 : preset.rows >= 6 ? 2.3 : 2.8) * PX_PER_MM);
      const minDescFont = Math.round((isMiniCell ? 1.25 : 1.65) * PX_PER_MM);

      const fitted = fitFullDescriptionInBox(
        ctx,
        product.description,
        descBoxWidth,
        descBoxHeight,
        maxDescFont,
        minDescFont
      );

      ctx.fillStyle = '#0f172a';
      ctx.font = `700 ${fitted.fontPx}px "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Vertically center the wrapped lines inside the description box
      const totalTextH = fitted.lines.length * fitted.lineHeightPx;
      const startTextY =
        descTopY + Math.max(0, (descBoxHeight - totalTextH) / 2);

      fitted.lines.forEach((line, idx) => {
        ctx.fillText(
          line,
          cellX + cellWidthPx / 2,
          startTextY + idx * fitted.lineHeightPx
        );
      });
    }

    ctx.restore();
  }

  // 4. Draw Guillotine Cut Grid Lines (Continuous Edge-to-Edge) & External Crop Marks
  if (options.showCutLines) {
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5; // 0.15 mm hairline
    ctx.setLineDash([8, 6]); // Subtle dashed line for effortless guillotine alignment

    // Vertical grid lines (from top of grid to bottom of grid)
    for (let c = 0; c <= preset.cols; c++) {
      const x = Math.round(gridLeftPx + c * cellWidthPx);
      ctx.beginPath();
      ctx.moveTo(x, gridTopPx);
      ctx.lineTo(x, gridTopPx + gridHeightPx);
      ctx.stroke();
    }

    // Horizontal grid lines (from left of grid to right of grid)
    for (let r = 0; r <= preset.rows; r++) {
      const y = Math.round(gridTopPx + r * cellHeightPx);
      ctx.beginPath();
      ctx.moveTo(gridLeftPx, y);
      ctx.lineTo(gridLeftPx + gridWidthPx, y);
      ctx.stroke();
    }

    // Solid External Crop Marks (Crocini di Taglio per Taglierina) in the outer margins
    ctx.setLineDash([]);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
    const cropLen = 4.5 * PX_PER_MM;
    const cropGap = 1.2 * PX_PER_MM;

    // Top & Bottom vertical crop marks
    for (let c = 0; c <= preset.cols; c++) {
      const x = Math.round(gridLeftPx + c * cellWidthPx);
      // Top margin tick
      ctx.beginPath();
      ctx.moveTo(x, gridTopPx - cropGap);
      ctx.lineTo(x, gridTopPx - cropGap - cropLen * 0.55);
      ctx.stroke();
      // Bottom margin tick
      ctx.beginPath();
      ctx.moveTo(x, gridTopPx + gridHeightPx + cropGap);
      ctx.lineTo(x, gridTopPx + gridHeightPx + cropGap + cropLen);
      ctx.stroke();
    }

    // Left & Right horizontal crop marks
    for (let r = 0; r <= preset.rows; r++) {
      const y = Math.round(gridTopPx + r * cellHeightPx);
      // Left margin tick
      ctx.beginPath();
      ctx.moveTo(gridLeftPx - cropGap, y);
      ctx.lineTo(gridLeftPx - cropGap - cropLen, y);
      ctx.stroke();
      // Right margin tick
      ctx.beginPath();
      ctx.moveTo(gridLeftPx + gridWidthPx + cropGap, y);
      ctx.lineTo(gridLeftPx + gridWidthPx + cropGap + cropLen, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  return canvas;
}

/**
 * Pure TypeScript Multi-Page A4 PDF Builder from rendered high-resolution canvases.
 * Zero external library dependencies, 100% compatible with Adobe Reader, Edge, Chrome & Windows Print.
 */
export function buildPdfFromJpegDataUrls(jpegDataUrls: string[], widthPt = 595.28, heightPt = 841.89): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-indexed object offsets
  let currentLength = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentLength += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentLength += bytes.length;
  };

  const startObj = (id: number) => {
    offsets[id] = currentLength;
    pushStr(`${id} 0 obj\n`);
  };

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  pushStr(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  const numPages = jpegDataUrls.length;
  // Object IDs:
  // 1: Catalog
  // 2: Pages
  // For each page i (0..numPages-1):
  //   pageObjId = 3 + i * 3
  //   contentObjId = 4 + i * 3
  //   imageObjId = 5 + i * 3

  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  const kidsRefs = jpegDataUrls.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  startObj(2);
  pushStr(`<< /Type /Pages /Kids [ ${kidsRefs} ] /Count ${numPages} >>`);
  endObj();

  for (let i = 0; i < numPages; i++) {
    const pageObjId = 3 + i * 3;
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;

    const base64 = jpegDataUrls[i].replace(/^data:image\/jpeg;base64,/, '');
    const binaryStr = atob(base64);
    const imgBytes = new Uint8Array(binaryStr.length);
    for (let j = 0; j < binaryStr.length; j++) {
      imgBytes[j] = binaryStr.charCodeAt(j);
    }

    // Page object
    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(
        2
      )}] /Resources << /XObject << /Im${i} ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content stream drawing the full A4 image
    const contentStream = `q\n${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm\n/Im${i} Do\nQ`;
    startObj(contentObjId);
    pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);
    endObj();

    // Image XObject
    startObj(imageObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width 2100 /Height 2970 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
    );
    pushBytes(imgBytes);
    pushStr(`\nendstream`);
    endObj();
  }

  const totalObjects = 2 + numPages * 3;
  const xrefOffset = currentLength;
  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjects; id++) {
    const off = String(offsets[id]).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

/**
 * Generates all A4 sheets and downloads a ready-to-cut multi-page PDF file.
 */
export async function downloadQrSheetsAsPdf(
  products: Product[],
  options: QrRenderOptions,
  filename = 'Etichette_QR_Saggin_A4.pdf'
): Promise<void> {
  const preset = QR_SHEET_PRESETS.find((p) => p.id === options.presetId) || QR_SHEET_PRESETS[0];
  const itemsPerPage = preset.cols * preset.rows;
  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const jpegPages: string[] = [];

  for (let p = 0; p < totalPages; p++) {
    const slice = products.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
    const canvas = await renderA4SheetToCanvas(
      slice,
      p,
      totalPages,
      products.length,
      options
    );
    jpegPages.push(canvas.toDataURL('image/jpeg', 0.96));
  }

  const pdfBlob = buildPdfFromJpegDataUrls(jpegPages);
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Opens a dedicated, isolated A4 print iframe containing ONLY the rendered A4 canvases
 * so that browser printing never includes modal scrollbars or background UI.
 */
export async function printQrSheetsDirectly(
  products: Product[],
  options: QrRenderOptions
): Promise<void> {
  const preset = QR_SHEET_PRESETS.find((p) => p.id === options.presetId) || QR_SHEET_PRESETS[0];
  const itemsPerPage = preset.cols * preset.rows;
  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const dataUrls: string[] = [];

  for (let p = 0; p < totalPages; p++) {
    const slice = products.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
    const canvas = await renderA4SheetToCanvas(
      slice,
      p,
      totalPages,
      products.length,
      options
    );
    dataUrls.push(canvas.toDataURL('image/png'));
  }

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
    .map(
      (src) =>
        `<div class="a4-sheet"><img src="${src}" alt="Foglio A4 QR" /></div>`
    )
    .join('');

  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Stampa Etichette QR Code A4 - Saggin Guglielmo S.R.L.</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 210mm;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .a4-sheet {
      width: 210mm;
      height: 297mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .a4-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .a4-sheet img {
      width: 210mm;
      height: 297mm;
      display: block;
    }
  </style>
</head>
<body>
  ${imgsHtml}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 150);
    };
  </script>
</body>
</html>`);
  doc.close();
}
