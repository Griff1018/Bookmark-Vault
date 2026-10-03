const zlib = require('zlib');
const decodeIco = require('decode-ico');

// Electron's nativeImage.createFromBuffer() reliably decodes PNG/JPEG on
// every platform, but classic .ico favicons are NOT a format Chromium's
// buffer decoder understands — most real-world favicon.ico files are still
// legacy BMP-in-ICO (not the newer PNG-embedded style), so they'd silently
// fail to decode and the card would be left with no icon at all. This
// module decodes the ICO with `decode-ico` (pure JS, zero native deps —
// important after the better-sqlite3 native-build pain) and, for the raw
// BMP-pixel case, encodes a real standalone PNG itself using Node's
// built-in zlib. This sidesteps nativeImage.createFromBitmap() entirely,
// whose raw pixel channel order is documented as "platform-dependent" —
// a real risk of silently swapped red/blue channels. A plain PNG has no
// such ambiguity.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Encodes raw RGBA pixel data (width*height*4 bytes, row-major, no padding)
// into a standalone, valid PNG file buffer. Verified pixel-perfect against
// an independent reference decoder (Pillow) during development.
function encodeRGBAToPNG(rgba, width, height) {
  if (rgba.length !== width * height * 4) {
    throw new Error(`rgba buffer length ${rgba.length} does not match ${width}x${height}x4`);
  }
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method
  const ihdr = pngChunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = pngChunk('IDAT', zlib.deflateSync(raw));
  const iend = pngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Quick check without fully parsing: does this buffer start with the ICO
// file signature (reserved=0, type=1)?
function looksLikeIco(buf) {
  return buf && buf.length >= 4 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1;
}

// Converts an ICO buffer to a single PNG buffer, picking the
// highest-resolution embedded image. Returns null if the buffer isn't a
// parseable ICO or contains no usable entries.
function icoToPng(buf) {
  let images;
  try {
    images = decodeIco(buf);
  } catch {
    return null;
  }
  if (!images || images.length === 0) return null;

  const largest = images.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));

  if (largest.type === 'png') {
    return Buffer.from(largest.data); // already a complete, valid PNG
  }
  // type === 'bmp': decode-ico has already done the hard part (parsing
  // the DIB header, handling bit depth, applying the AND mask) and handed
  // back clean RGBA pixels — just package them as a PNG.
  try {
    return encodeRGBAToPNG(Buffer.from(largest.data), largest.width, largest.height);
  } catch {
    return null;
  }
}

module.exports = { icoToPng, looksLikeIco, encodeRGBAToPNG };
