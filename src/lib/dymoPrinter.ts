import QRCode from 'qrcode';
import { CustomerCommitment, Product } from '../types';
import { loadSagginLogo } from './qrSheetGenerator';
import { encodeCommitmentQrPayload, loadVeluxLogo, drawVeluxLogo } from './commitmentQr';

export type DymoLabelSizeId = '89x36' | '101x54' | '57x32' | '102x152';

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

/**
 * Renders a crisp 300-DPI thermal-ready landscape label canvas for a Customer Commitment
 * sized proportionally to the selected DYMO roll.
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

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const qrPayload = encodeCommitmentQrPayload(commitment);
  const pad = Math.round(2.2 * PX_PER_MM);

  // Portrait 102x152 uses vertical stack; landscape rolls use QR on left + details on right
  if (fmt.id === '102x152') {
    const qrSize = Math.round(W * 0.68);
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, qrPayload, {
      width: qrSize,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Top logos
    let y = pad + 12;
    if (isVelux) {
      if (sagginImg) {
        const sh = 64;
        const sw = (sagginImg.width / sagginImg.height) * sh;
        ctx.drawImage(sagginImg, W / 2 - 20 - sw, y, sw, sh);
      }
      if (veluxImg) {
        const vh = 64;
        const vw = (veluxImg.width / veluxImg.height) * vh;
        ctx.drawImage(veluxImg, W / 2 + 20, y, vw, vh);
      } else {
        drawVeluxLogo(ctx, W / 2 + 20, y, 180, 64);
      }
    } else if (sagginImg) {
      const sh = 70;
      const sw = (sagginImg.width / sagginImg.height) * sh;
      ctx.drawImage(sagginImg, (W - sw) / 2, y, sw, sh);
    }

    y += 96;
    ctx.fillStyle = '#000000';
    ctx.fillRect(pad, y, W - pad * 2, 76);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`IMPEGNO N° ${commitment.commitment_number}`, W / 2, y + 38, W - pad * 4);

    y += 96;
    ctx.drawImage(qrCanvas, (W - qrSize) / 2, y, qrSize, qrSize);

    y += qrSize + 28;
    ctx.fillStyle = '#000000';
    ctx.font = '900 44px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText((commitment.customer_name || 'CLIENTE').toUpperCase(), W / 2, y, W - pad * 2);

    if (hasInstaller) {
      y += 66;
      ctx.font = '800 32px "Plus Jakarta Sans", Arial, sans-serif';
      ctx.fillText(`INST: ${(commitment.installer_name || '').toUpperCase()}`, W / 2, y, W - pad * 2);
    }
    return canvas;
  }

  // Landscape DYMO roll (101x54, 89x36, 57x32)
  const qrSize = H - pad * 2;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, qrPayload, {
    width: qrSize,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });

  // Left: Crisp QR code
  ctx.drawImage(qrCanvas, pad, pad, qrSize, qrSize);

  // Right column
  const rightX = pad + qrSize + Math.round(2.5 * PX_PER_MM);
  const rightW = W - rightX - pad;
  let cursorY = pad;

  // Top Logo Row
  const logoH = Math.round(H * 0.16);
  if (isVelux) {
    let lx = rightX;
    if (sagginImg) {
      const sw = (sagginImg.width / sagginImg.height) * logoH;
      ctx.drawImage(sagginImg, lx, cursorY, sw, logoH);
      lx += sw + Math.round(1.8 * PX_PER_MM);
    }
    if (veluxImg) {
      const vw = (veluxImg.width / veluxImg.height) * logoH;
      ctx.drawImage(veluxImg, lx, cursorY, vw, logoH);
    } else {
      drawVeluxLogo(ctx, lx, cursorY, Math.round(logoH * 2.8), logoH);
    }
  } else if (sagginImg) {
    const sw = (sagginImg.width / sagginImg.height) * logoH;
    ctx.drawImage(sagginImg, rightX, cursorY, sw, logoH);
  }

  cursorY += logoH + Math.round(1.5 * PX_PER_MM);

  // Commitment Number Bar
  const barH = Math.round(H * 0.18);
  ctx.fillStyle = '#000000';
  ctx.fillRect(rightX, cursorY, rightW, barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(barH * 0.56)}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `IMP. ${commitment.commitment_number}`,
    rightX + Math.round(1.5 * PX_PER_MM),
    cursorY + barH / 2,
    rightW - Math.round(3 * PX_PER_MM)
  );

  cursorY += barH + Math.round(1.8 * PX_PER_MM);

  // Customer Name
  ctx.fillStyle = '#000000';
  const custFont = Math.round(H * (hasInstaller ? 0.14 : 0.17));
  ctx.font = `900 ${custFont}px "Plus Jakarta Sans", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText((commitment.customer_name || 'CLIENTE').toUpperCase(), rightX, cursorY, rightW);

  if (hasInstaller) {
    cursorY += Math.round(custFont * 1.25);
    ctx.font = `800 ${Math.round(H * 0.11)}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.fillText(`INST: ${(commitment.installer_name || '').toUpperCase()}`, rightX, cursorY, rightW);
  }

  return canvas;
}

/**
 * Renders a crisp 300-DPI thermal DYMO label for a single Catalog Product.
 */
export async function renderProductDymoCanvas(
  product: Product,
  formatId: DymoLabelSizeId
): Promise<HTMLCanvasElement> {
  const fmt = DYMO_LABEL_FORMATS.find((f) => f.id === formatId) || DYMO_LABEL_FORMATS[1]; // default 89x36
  const PX_PER_MM = 12;
  const W = Math.round(fmt.widthMm * PX_PER_MM);
  const H = Math.round(fmt.heightMm * PX_PER_MM);

  const sagginImg = await loadSagginLogo();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const pad = Math.round(2 * PX_PER_MM);
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

  // Convert mm to twips (1 mm = 56.692913 twips)
  const wTwips = Math.round(fmt.widthMm * 56.692913);
  const hTwips = Math.round(fmt.heightMm * 56.692913);

  const labelXml = `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Custom</Id>
  <PaperName>${fmt.dymoPaperName}</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${hTwips}" Height="${wTwips}" Rx="180" Ry="180" />
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
    @page { size: ${fmt.widthMm}mm ${fmt.heightMm}mm; margin: 0mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: ${fmt.widthMm}mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dymo-label { width: ${fmt.widthMm}mm; height: ${fmt.heightMm}mm; page-break-after: always; break-after: page; overflow: hidden; }
    .dymo-label:last-child { page-break-after: auto; break-after: auto; }
    .dymo-label img { width: ${fmt.widthMm}mm; height: ${fmt.heightMm}mm; display: block; object-fit: contain; }
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
