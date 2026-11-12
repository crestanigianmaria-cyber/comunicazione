import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'public');
const sourcePath = path.join(publicDir, 'logoiphone.png');

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('logoiphone.png non è un PNG valido');

  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error('Formato PNG non supportato: serve un PNG RGB/RGBA a 8 bit non interlacciato');
  }

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(height * stride);

  let sourceOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[sourceOffset++];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[sourceOffset++];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[rowOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel ? pixels[rowOffset - stride + x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else if (filter !== 0) throw new Error('Filtro PNG non supportato: ' + filter);
      pixels[rowOffset + x] = (value + predictor) & 255;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += channels) {
    const k = i * 4;
    rgba[k] = pixels[j];
    rgba[k + 1] = pixels[j + 1];
    rgba[k + 2] = pixels[j + 2];
    rgba[k + 3] = channels === 4 ? pixels[j + 3] : 255;
  }
  return { width, height, pixels: rgba };
}

function resize(source, targetSize, scale = 1) {
  const canvas = Buffer.alloc(targetSize * targetSize * 4, 255);
  const drawSize = Math.round(targetSize * scale);
  const offset = Math.floor((targetSize - drawSize) / 2);
  for (let y = 0; y < drawSize; y++) {
    const sy = Math.min(source.height - 1, Math.max(0, ((y + 0.5) * source.height / drawSize) - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(source.height - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < drawSize; x++) {
      const sx = Math.min(source.width - 1, Math.max(0, ((x + 0.5) * source.width / drawSize) - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(source.width - 1, x0 + 1), fx = sx - x0;
      const dst = ((y + offset) * targetSize + x + offset) * 4;
      const p00 = (y0 * source.width + x0) * 4;
      const p10 = (y0 * source.width + x1) * 4;
      const p01 = (y1 * source.width + x0) * 4;
      const p11 = (y1 * source.width + x1) * 4;
      for (let c = 0; c < 4; c++) {
        const top = source.pixels[p00 + c] * (1 - fx) + source.pixels[p10 + c] * fx;
        const bottom = source.pixels[p01 + c] * (1 - fx) + source.pixels[p11 + c] * fx;
        canvas[dst + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return canvas;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

if (!fs.existsSync(sourcePath)) {
  throw new Error('Manca public/logoiphone.png: impossibile generare le icone del brand.');
}
const source = decodePng(fs.readFileSync(sourcePath));
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(publicDir, `pwa-${size}x${size}.png`), encodePng(size, resize(source, size)));
}
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), encodePng(512, resize(source, 512, 0.78)));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), encodePng(180, resize(source, 180)));
fs.writeFileSync(path.join(publicDir, 'favicon.png'), encodePng(64, resize(source, 64)));
fs.writeFileSync(path.join(publicDir, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image href="/logoiphone.png" width="512" height="512" preserveAspectRatio="xMidYMid meet"/></svg>`);
console.log('Icone Saggin generate da logoiphone.png (PWA, iOS e favicon).');
