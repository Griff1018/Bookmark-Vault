const { app, BrowserWindow, ipcMain, shell, protocol } = require('electron');
const path = require('path');

let mainWindow;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#141311',
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
  const { startServer } = require('./server');
  const { launchIncognito } = require('./browserLaunch');

  startServer({
    db,
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
  ipcMain.handle('folders:matching', (_e, filter) => {
    const set = db.matchingFolderIds(filter);
    return set ? [...set] : null;
  });
  ipcMain.handle('settings:get', (_e, key, fallback) => db.getSetting(key, fallback));
  ipcMain.handle('settings:set', (_e, { key, value }) => db.setSetting(key, value));
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
