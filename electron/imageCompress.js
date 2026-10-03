let nativeImage = null;
try {
  // Only available when actually running inside Electron's main process —
  // this module is also loaded by plain-Node tests, where it stays null
  // and compressToLimit() just passes buffers through unchanged.
  nativeImage = require('electron').nativeImage;
} catch {
  nativeImage = null;
}

// Pure, dependency-injected shrink loop: given an `encodeFn(quality, width)`
// that returns { buffer, width } for a candidate encode, repeatedly lowers
// quality first, then width, until the buffer fits under `limitBytes` or we
// hit both floors. Kept separate from nativeImage so it can be unit-tested
// with a synthetic encoder that doesn't require a real image or Electron.
function reduceUntilUnderLimit({ initialWidth, limitBytes, encodeFn, minQuality = 35, minWidth = 480, qualityStep = 12 }) {
  let quality = 85;
  let width = initialWidth;
  let { buffer } = encodeFn(quality, width);
  let attempts = 0;
  const maxAttempts = 40; // safety cap — a pathological encode curve can't loop forever

  while (buffer.length > limitBytes && attempts < maxAttempts) {
    attempts++;
    if (quality > minQuality) {
      quality = Math.max(minQuality, quality - qualityStep);
    } else if (width > minWidth) {
      width = Math.max(minWidth, Math.round(width * 0.85));
    } else {
      break; // as small as we're willing to go; accept whatever we've got
    }
    ({ buffer } = encodeFn(quality, width));
  }

  return { buffer, quality, width, attempts, underLimit: buffer.length <= limitBytes };
}

// Compresses `buffer` toward `limitBytes` by re-encoding as JPEG at
// progressively lower quality, then progressively smaller dimensions.
// Returns { buffer, ext, compressed }. `ext` is 'jpg' whenever compression
// actually ran (JPEG re-encoding is what shrinks the file — PNG is
// lossless, so re-saving as PNG wouldn't help). If the buffer is already
// under the limit, isn't a decodable image, or nativeImage isn't available
// (e.g. running outside Electron), the original buffer passes through
// untouched.
function compressToLimit(buffer, limitBytes, opts = {}) {
  if (!limitBytes || buffer.length <= limitBytes) {
    return { buffer, ext: null, compressed: false };
  }
  if (!nativeImage) {
    return { buffer, ext: null, compressed: false };
  }

  const img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) {
    return { buffer, ext: null, compressed: false };
  }

  const { width: initialWidth } = img.getSize();
  const encodeFn = (quality, width) => {
    const source = width < initialWidth ? img.resize({ width }) : img;
    return { buffer: source.toJPEG(quality), width };
  };

  const result = reduceUntilUnderLimit({ initialWidth, limitBytes, encodeFn, ...opts });
  return { buffer: result.buffer, ext: 'jpg', compressed: true };
}

// Cheap sanity check: does this buffer actually decode as an image at all?
// Used to reject garbage (e.g. an HTML error page, or a wrong guessed URL)
// before it gets saved to disk as a "thumbnail". Outside Electron (e.g.
// tests), nativeImage is unavailable, so this can't verify anything and
// assumes valid — the real check only matters at runtime in the app.
function sniffImageExt(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function isDecodableImage(buffer) {
  if (!nativeImage) return true;
  if (!buffer || buffer.length === 0) return false;
  // nativeImage can't decode WebP/GIF, but the renderer shows them fine.
  if (sniffImageExt(buffer)) return true;
  try {
    return !nativeImage.createFromBuffer(buffer).isEmpty();
  } catch {
    return false;
  }
}

module.exports = { sniffImageExt, compressToLimit, reduceUntilUnderLimit, isDecodableImage };
