const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { compressToLimit, isDecodableImage, sniffImageExt } = require('./imageCompress.js');
const { icoToPng, looksLikeIco } = require('./icoToPng.js');

const PORT = 47564; // fixed local port the extension is configured to hit
const DEFAULT_THUMBNAIL_LIMIT_KB = 300;

function downloadImageBuffer(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImageBuffer(res.headers.location).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function extFromUrl(url) {
  const match = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.exec(url || '');
  return match ? match[1].toLowerCase() : 'jpg';
}

function scrapeOgImage(pageUrl) {
  return new Promise((resolve) => {
    if (!pageUrl) return resolve(null);
    const lib = pageUrl.startsWith('https') ? https : http;
    const req = lib.get(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        scrapeOgImage(res.headers.location).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      let html = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        html += chunk;
        if (html.length > 50000) { res.destroy(); resolve(extractOgUrl(html, pageUrl)); }
      });
      res.on('end', () => resolve(extractOgUrl(html, pageUrl)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function extractOgUrl(html, base) {
  const patterns = [
    /< *meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /< *meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /< *meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /< *meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) {
      const raw = m[1].replace(/&amp;/g, '&').trim();
      try { return new URL(raw, base).href; } catch { return null; }
    }
  }
  return null;
}

const LOG = '[Vault:server]';

function startServer({ db, onSaved, onProgress, token }) {
  const emit = (evt) => { try { if (onProgress) onProgress({ ts: Date.now(), ...evt }); } catch {} };
  const kb = (n) => `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  const server = http.createServer(async (req, res) => {
    console.log(LOG, req.method, req.url);

    // CORS for the extension's fetch() call
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Vault-Token');

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    // Folder list for the extension's right-click menu
    if (req.method === 'GET' && req.url === '/api/folders') {
      if (token && req.headers['x-vault-token'] !== token) {
        console.warn(LOG, 'GET /api/folders — rejected: bad token');
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'unauthorized' }));
      }
      const folders = db.allFolders();
      console.log(LOG, 'GET /api/folders — returning', folders.length, 'folder(s):', folders.map((f) => `${f.id}:${f.name}`));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ folders }));
    }

    if (req.method === 'POST' && req.url === '/api/folders/create') {
      if (token && req.headers['x-vault-token'] !== token) {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'unauthorized' }));
      }
      let fbody = '';
      req.on('data', (chunk) => { fbody += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(fbody || '{}');
          console.log(LOG, 'POST /api/folders/create — payload:', payload);
          const parentId = Number.isInteger(payload.parent_id) && db.folderExists(payload.parent_id)
            ? payload.parent_id
            : null;
          const folder = db.createFolder(payload.name, parentId);
          if (!folder) {
            console.warn(LOG, 'folder creation rejected — empty/invalid name');
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'invalid name' }));
          }
          console.log(LOG, 'folder created:', folder);
          if (onSaved) onSaved(null); // nudge the app to refresh its folder list
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, folder }));
        } catch (err) {
          console.error(LOG, 'POST /api/folders/create failed:', err.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/bookmark') {
      if (token && req.headers['x-vault-token'] !== token) {
        console.warn(LOG, 'POST /api/bookmark — rejected: bad token');
        res.writeHead(401);
        return res.end(JSON.stringify({ error: 'unauthorized' }));
      }
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        let jobId = null;
        try {
          const payload = JSON.parse(body || '{}');
          console.log(LOG, 'POST /api/bookmark — payload:', payload);
          const id = crypto.randomUUID();
          jobId = id;
          const t0 = Date.now();
          const step = (label, status, detail) => emit({ type: 'step', jobId: id, label, status, detail });
          emit({ type: 'job', jobId: id, kind: 'save', title: payload.title || payload.url || 'New bookmark' });
          step('Received from extension', 'ok', payload.url);

          // Ignore folder ids that no longer exist (e.g. a stale browser menu)
          let folderId = null;
          if (payload.folder_id != null) {
            if (!Number.isInteger(payload.folder_id)) {
              console.warn(LOG, 'folder_id', JSON.stringify(payload.folder_id), 'is not an integer — saving as Unsorted');
            } else if (!db.folderExists(payload.folder_id)) {
              console.warn(LOG, 'folder_id', payload.folder_id, 'does not exist in the database — saving as Unsorted. Known folder ids:', db.allFolders().map((f) => f.id));
            } else {
              folderId = payload.folder_id;
            }
          }
          console.log(LOG, 'resolved folder_id:', folderId, folderId === null ? '(Unsorted)' : '');

          let thumbPath = null;
          let pendingThumbnailUrl = null;
          const domain = payload.source || (payload.url ? new URL(payload.url).hostname : '');

          if (payload.thumbnail) {
            console.log(LOG, 'downloading thumbnail from', payload.thumbnail);
            step('Download thumbnail', 'running', payload.thumbnail);
            const buf = await downloadImageBuffer(payload.thumbnail);
            if (buf && buf.length > 0 && isDecodableImage(buf)) {
              console.log(LOG, 'thumbnail downloaded,', buf.length, 'bytes');
              step('Download thumbnail', 'ok', kb(buf.length));
              const limitKB = Number(db.getSetting('thumbnailLimitKB', DEFAULT_THUMBNAIL_LIMIT_KB));
              const limitBytes = limitKB > 0 ? limitKB * 1024 : 0;
              const { buffer: finalBuf, ext: forcedExt, compressed } = compressToLimit(buf, limitBytes);
              if (compressed) console.log(LOG, 'compressed thumbnail from', buf.length, 'to', finalBuf.length, 'bytes');
              step('Compress thumbnail', compressed ? 'ok' : 'skip', compressed ? `${kb(buf.length)} → ${kb(finalBuf.length)}` : `within ${limitKB} KB limit`);
              const ext = forcedExt || sniffImageExt(buf) || extFromUrl(payload.thumbnail);
              const dest = path.join(db.thumbsDir, `${id}.${ext}`);
              fs.writeFileSync(dest, finalBuf);
              thumbPath = dest;
              step('Save thumbnail', 'ok', path.basename(dest));
              console.log(LOG, 'thumbnail saved to', dest);
            } else if (buf && buf.length > 0) {
              console.warn(LOG, 'downloaded bytes do not decode as a real image (wrong/stale URL?) — storing URL for retry');
              step('Download thumbnail', 'fail', 'not a valid image — queued for retry');
              pendingThumbnailUrl = payload.thumbnail;
            } else {
              console.warn(LOG, 'thumbnail download failed or returned 0 bytes — storing URL for retry');
              step('Download thumbnail', 'fail', 'download failed — queued for retry');
              pendingThumbnailUrl = payload.thumbnail;
            }
          } else {
            console.log(LOG, 'no thumbnail URL provided in payload — falling back to favicon');
            step('Download thumbnail', 'skip', 'extension sent no image');
          }

          // Always ensure this domain's favicon is cached — independent of
          // whether the real thumbnail succeeded. It's used for the small
          // {icon} next to the domain name shown on every card, not just
          // as a last-resort thumbnail.
          if (domain) {
            let faviconPath = db.getFaviconPath(domain);
            if (faviconPath) {
              console.log(LOG, 'favicon already cached for', domain, '->', faviconPath);
              step('Favicon', 'skip', `already cached for ${domain}`);
            } else if (payload.favicon) {
              console.log(LOG, 'downloading favicon for', domain, 'from', payload.favicon);
              step('Favicon', 'running', payload.favicon);
              let favBuf = await downloadImageBuffer(payload.favicon);
              let ext = extFromUrl(payload.favicon) || 'png';

              // Classic favicon.ico isn't a format Electron's buffer decoder
              // understands — convert it to a real PNG first. This is the
              // common case: most sites with no modern <link rel="icon">
              // PNG tag still serve a plain .ico, which would otherwise
              // silently fail isDecodableImage below and leave no icon at all.
              if (favBuf && looksLikeIco(favBuf)) {
                console.log(LOG, 'favicon is .ico format, converting to PNG');
                const converted = icoToPng(favBuf);
                if (converted) {
                  favBuf = converted;
                  ext = 'png';
                  console.log(LOG, 'ico->png conversion succeeded,', converted.length, 'bytes');
                } else {
                  console.warn(LOG, 'ico->png conversion failed, will try the raw bytes as a last resort');
                }
              }

              if (favBuf && favBuf.length > 0 && isDecodableImage(favBuf)) {
                const dest = path.join(db.faviconsDir, `${domain}.${ext}`);
                fs.writeFileSync(dest, favBuf);
                db.setFaviconPath(domain, dest);
                faviconPath = dest;
                console.log(LOG, 'favicon cached for', domain, '->', dest);
                step('Favicon', 'ok', `${kb(favBuf.length)} cached for ${domain}`);
              } else {
                console.warn(LOG, 'favicon download/decode failed for', domain);
                step('Favicon', 'fail', 'download/decode failed');
              }
            } else {
              console.log(LOG, 'no favicon URL provided for', domain, '— card will show domain text with no icon');
              step('Favicon', 'skip', 'extension sent no favicon');
            }

          }

          // Duplicate detection — tag the item if the URL already exists
          const dupTags = [];
          if (payload.url) {
            const existing = db.findByUrl(payload.url);
            if (existing) dupTags.push('duplicate');
          }

          const item = db.insertItem({
            id,
            url: payload.url || '',
            title: payload.title || '',
            source: domain,
            thumbnail_path: thumbPath,
            notes: '',
            rating: 0,
            favorite: 0,
            folder_id: folderId,
            pending_thumbnail_url: pendingThumbnailUrl,
            tags: [...(payload.tags || []), ...dupTags]
          });
          console.log(LOG, 'saved item:', { id: item.id, title: item.title, folder_id: item.folder_id, thumbnail_path: item.thumbnail_path });
          step('Save to library', 'ok', dupTags.length ? 'tagged #duplicate' : (folderId === null ? 'Unsorted' : `folder ${folderId}`));
          emit({ type: 'end', jobId: id, ok: true, summary: `${thumbPath ? 'with thumbnail' : 'no thumbnail'} · ${Date.now() - t0} ms` });
          if (onSaved) onSaved(item);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, item }));
        } catch (err) {
          console.error(LOG, 'POST /api/bookmark failed:', err.message);
          if (jobId) emit({ type: 'end', jobId, ok: false, summary: err.message });
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    console.warn(LOG, '404 for', req.method, req.url);
    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(LOG, `listening on http://127.0.0.1:${PORT}`);
  });
  return server;
}

module.exports = { startServer, downloadImageBuffer, extFromUrl, scrapeOgImage, PORT };
