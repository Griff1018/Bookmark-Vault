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
  toggleFolderBlur: (id) => ipcRenderer.invoke('folders:toggleBlur', id),
  matchingFolderIds: (filter) => ipcRenderer.invoke('folders:matching', filter),
  retryThumbnails: (folderId, itemIds) => ipcRenderer.invoke('items:retryThumbnails', folderId, itemIds),
  getSetting: (key, fallback) => ipcRenderer.invoke('settings:get', key, fallback),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', { key, value }),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openIncognito: (url) => ipcRenderer.invoke('shell:openIncognito', url),
  onProgress: (callback) => {
    const handler = (_event, evt) => callback(evt);
    ipcRenderer.on('progress:event', handler);
    return () => ipcRenderer.removeListener('progress:event', handler);
  },
  onItemSaved: (callback) => {
    const handler = (_event, item) => callback(item);
    ipcRenderer.on('item:saved', handler);
    return () => ipcRenderer.removeListener('item:saved', handler);
  }
});
