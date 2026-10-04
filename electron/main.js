const { app, BrowserWindow, ipcMain, shell, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

let mainWindow;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  // Serve local thumbnail files under a custom scheme so the renderer
  // can display them without granting broad filesystem access.
  protocol.registerFileProtocol('vault-thumb', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('vault-thumb://', ''));
    callback({ path: filePath });
  });

  const db = require('./db');
  const { startServer, downloadImageBuffer, extFromUrl, scrapeOgImage } = require('./server');
  const { compressToLimit, isDecodableImage, sniffImageExt } = require('./imageCompress.js');
  const { launchIncognito } = require('./browserLaunch');

  startServer({
    db,
    onProgress: (evt) => { if (mainWindow) mainWindow.webContents.send('progress:event', evt); },
    onSaved: (item) => {
      if (mainWindow) mainWindow.webContents.send('item:saved', item);
    }
  });

  ipcMain.handle('items:list', (_e, filters) => db.listItems(filters));
  ipcMain.handle('items:update', (_e, { id, patch }) => db.updateItem(id, patch));
  ipcMain.handle('items:delete', (_e, id) => db.deleteItem(id));
  ipcMain.handle('tags:list', (_e, folderId) => db.allTags(folderId));
  ipcMain.handle('sources:list', (_e, folderId) => db.allSources(folderId));
  ipcMain.handle('stats:get', () => db.stats());
  ipcMain.handle('search:facets', (_e, query, folderId) => db.searchFacets(query, folderId));
  ipcMain.handle('folders:list', () => db.allFolders());
  ipcMain.handle('folders:create', (_e, { name, parentId }) => db.createFolder(name, parentId ?? null));
  ipcMain.handle('folders:rename', (_e, { id, name }) => db.renameFolder(id, name));
  ipcMain.handle('folders:move', (_e, { id, parentId }) => db.moveFolder(id, parentId ?? null));
  ipcMain.handle('folders:delete', (_e, id) => db.deleteFolder(id));
  ipcMain.handle('folders:toggleBlur', (_e, id) => db.toggleFolderBlur(id));
  ipcMain.handle('folders:matching', (_e, filter) => {
    const set = db.matchingFolderIds(filter);
    return set ? [...set] : null;
  });
  ipcMain.handle('settings:get', (_e, key, fallback) => db.getSetting(key, fallback));
  ipcMain.handle('settings:set', (_e, { key, value }) => db.setSetting(key, value));
  ipcMain.handle('items:retryThumbnails', async (_e, folderId, itemIds) => {
    const emit = (evt) => { if (mainWindow) mainWindow.webContents.send('progress:event', { ts: Date.now(), ...evt }); };
    const kb = (n) => `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
    const items = Array.isArray(itemIds) ? db.itemsByIds(itemIds) : db.itemsMissingThumbnail(folderId);
    const batchId = `batch-${Date.now()}`;
    emit({ type: 'job', jobId: batchId, kind: 'batch', title: Array.isArray(itemIds) ? 'Load thumbnail' : 'Load failed thumbnails', total: items.length });
    if (items.length === 0) {
      emit({ type: 'end', jobId: batchId, ok: true, summary: 'nothing to fetch' });
      return { retried: 0, succeeded: 0 };
    }
    const limitKB = Number(db.getSetting('thumbnailLimitKB', 300));
    const limitBytes = limitKB > 0 ? limitKB * 1024 : 0;

    async function tryUrl(item, imgUrl, label, step) {
      step(label, 'running', imgUrl);
      const buf = await downloadImageBuffer(imgUrl);
      if (!buf || buf.length === 0) { step(label, 'fail', 'download failed'); return false; }
      if (!isDecodableImage(buf)) { step(label, 'fail', 'not a valid image'); return false; }
      step(label, 'ok', kb(buf.length));
      const { buffer: finalBuf, ext: forcedExt, compressed } = compressToLimit(buf, limitBytes);
      step('Compress thumbnail', compressed ? 'ok' : 'skip', compressed ? `${kb(buf.length)} → ${kb(finalBuf.length)}` : `within ${limitKB} KB limit`);
      const ext = forcedExt || sniffImageExt(buf) || extFromUrl(imgUrl);
      const dest = path.join(db.thumbsDir, `${item.id}.${ext}`);
      fs.writeFileSync(dest, finalBuf);
      db.resolvePendingThumbnail(item.id, dest);
      step('Save thumbnail', 'ok', path.basename(dest));
      return true;
    }

    let succeeded = 0;
    let finished = 0;
    for (const item of items) {
      const jobId = `${batchId}:${item.id}`;
      const step = (label, status, detail) => emit({ type: 'step', jobId, label, status, detail });
      emit({ type: 'job', jobId, parentId: batchId, kind: 'retry', title: item.title || item.url });
      let ok = false;
      let summary = 'no image found';
      try {
        const tried = new Set();
        if (item.pending_thumbnail_url) {
          tried.add(item.pending_thumbnail_url);
          ok = await tryUrl(item, item.pending_thumbnail_url, 'Saved image URL', step);
        } else {
          step('Saved image URL', 'skip', 'none stored');
        }
        if (!ok && item.url) {
          step('Scrape page for og:image', 'running', item.url);
          const og = await scrapeOgImage(item.url);
          if (!og) {
            step('Scrape page for og:image', 'fail', 'page has no og:image');
            summary = 'page has no og:image';
          } else if (tried.has(og)) {
            step('Scrape page for og:image', 'fail', 'same URL that already failed');
          } else {
            step('Scrape page for og:image', 'ok', og);
            ok = await tryUrl(item, og, 'Download og:image', step);
          }
        }
        if (ok) summary = 'thumbnail loaded';
        else if (summary === 'no image found') summary = 'could not load an image';
      } catch (err) {
        summary = err.message || 'error';
      }
      if (ok) succeeded++;
      finished++;
      emit({ type: 'end', jobId, ok, summary });
      emit({ type: 'progress', jobId: batchId, done: finished, succeeded });
    }
    emit({ type: 'end', jobId: batchId, ok: succeeded > 0, summary: `${succeeded} loaded, ${items.length - succeeded} failed` });
    return { retried: items.length, succeeded };
  });

  ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url));
  ipcMain.handle('shell:openIncognito', (_e, url) => {
    const override = db.getSetting('incognitoBrowserPath', null);
    return launchIncognito(url, override || undefined);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
