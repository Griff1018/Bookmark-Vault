const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vault', {
  listItems: (filters) => ipcRenderer.invoke('items:list', filters),
  updateItem: (id, patch) => ipcRenderer.invoke('items:update', { id, patch }),
  deleteItem: (id) => ipcRenderer.invoke('items:delete', id),
  listTags: (folderId) => ipcRenderer.invoke('tags:list', folderId),
  listSources: (folderId) => ipcRenderer.invoke('sources:list', folderId),
  getStats: () => ipcRenderer.invoke('stats:get'),
  searchFacets: (query, folderId) => ipcRenderer.invoke('search:facets', query, folderId),
  listFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (name, parentId) => ipcRenderer.invoke('folders:create', { name, parentId }),
  renameFolder: (id, name) => ipcRenderer.invoke('folders:rename', { id, name }),
  moveFolder: (id, parentId) => ipcRenderer.invoke('folders:move', { id, parentId }),
  deleteFolder: (id) => ipcRenderer.invoke('folders:delete', id),
  matchingFolderIds: (filter) => ipcRenderer.invoke('folders:matching', filter),
  getSetting: (key, fallback) => ipcRenderer.invoke('settings:get', key, fallback),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openIncognito: (url) => ipcRenderer.invoke('shell:openIncognito', url),
  onItemSaved: (callback) => {
    const handler = (_event, item) => callback(item);
    ipcRenderer.on('item:saved', handler);
    return () => ipcRenderer.removeListener('item:saved', handler);
  }
});
