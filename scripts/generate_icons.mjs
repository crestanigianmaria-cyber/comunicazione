import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, bgColor, drawSymbol = true) {
  // RGBA buffer with filter byte at start of each scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  const [bgR, bgG, bgB, bgA] = bgColor;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Check if pixel is within icon central mark
      let r = bgR, g = bgG, b = bgB, a = bgA;

      if (drawSymbol) {
        // Draw an industrial warehouse / pallet / cube geometric badge
        const cx = width / 2;
        const cy = height / 2;
        const scale = width / 100;
        const dx = (x - cx) / scale;
        const dy = (y - cy) / scale;

        // Draw warehouse roof / box shape
        const inBox = Math.abs(dx) <= 28 && Math.abs(dy) <= 24;
        const inBorder = Math.abs(dx) <= 30 && Math.abs(dy) <= 26 && !inBox;
        const inRoof = dy < -12 && dy >= -34 && Math.abs(dx) <= (34 + dy) * 1.5;

        // Brick/stack lines
        const isHorizontalDivider = inBox && (Math.abs(dy) < 1.5 || Math.abs(dy - 10) < 1.5 || Math.abs(dy + 10) < 1.5);
        const isVerticalDivider = inBox && (Math.abs(dx) < 1.5 && dy < 0 || Math.abs(dx - 12) < 1.5 && dy >= 0 || Math.abs(dx + 12) < 1.5 && dy >= 0);

        if (inRoof || inBorder) {
          r = 59; g = 130; b = 246; a = 255; // Blue-500
        } else if (isHorizontalDivider || isVerticalDivider) {
          r = 30; g = 41; b = 59; a = 255; // Slate-800
        } else if (inBox) {
          r = 241; g = 245; b = 249; a = 255; // Slate-100
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c ^= buf[n];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);

    return Buffer.concat([len, typeAndData, crc]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate Icons
console.log('Generating PWA icons...');
const navyBg = [15, 23, 42, 255]; // #0F172A

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, navyBg));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, navyBg));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, navyBg));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, navyBg));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(32, 32, navyBg));

// Write SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="112" fill="#0F172A"/>
  <path d="M256 96 L416 192 L416 384 L256 480 L96 384 L96 192 Z" fill="#1E293B" stroke="#38BDF8" stroke-width="14" stroke-linejoin="round"/>
  <path d="M256 96 L256 480" stroke="#38BDF8" stroke-width="12"/>
  <path d="M96 192 L256 288 L416 192" stroke="#38BDF8" stroke-width="12" fill="none"/>
  <path d="M176 144 L336 240" stroke="#60A5FA" stroke-width="6" stroke-linecap="round" opacity="0.6"/>
  <rect x="160" y="320" width="60" height="50" rx="8" fill="#3B82F6"/>
  <rect x="292" y="320" width="60" height="50" rx="8" fill="#3B82F6"/>
  <circle cx="256" cy="288" r="10" fill="#F59E0B"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
console.log('PWA icons created successfully in /public');
