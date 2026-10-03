import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Gallery from './components/Gallery.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { buildTree, flattenTree, folderPath } from './utils/folders.js';
import { FOLDER_MIME } from './utils/dnd.js';

export default function App() {
  const [items, setItems] = useState([]);
  const [tags, setTags] = useState([]);
  const [sources, setSources] = useState([]);
  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState({ total: 0, favorites: 0, unsorted: 0 });

  const [query, setQuery] = useState('');
  const [view, setView] = useState('all');
  const [activeSource, setActiveSource] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null); // null | 'none' | folderId
  const [sort, setSort] = useState('newest');
  const [openItem, setOpenItem] = useState(null);
  const [galleryView, setGalleryView] = useState(() => localStorage.getItem('vault:galleryView') || 'large');
  const [menu, setMenu] = useState(null); // { x, y, item } for item context menu
  const [folderMenu, setFolderMenu] = useState(null); // { x, y, folder } for folder context menu
  const [tagDraft, setTagDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchFacets, setSearchFacets] = useState({ tags: [], sources: [] });
  const [matchingFolderIds, setMatchingFolderIds] = useState(null); // null = no source/tag filter active, show all subfolders
  const [newFolderChoiceMenu, setNewFolderChoiceMenu] = useState(null); // { x, y } — Main Directory vs Current Folder popup

  // Folder tree UI state
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
  const [creatingFolderUnder, setCreatingFolderUnder] = useState(null); // 'root' | folderId | null
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderDraft, setFolderDraft] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  useEffect(() => { localStorage.setItem('vault:galleryView', galleryView); }, [galleryView]);

  const folderTree = useMemo(() => buildTree(folders), [folders]);
  const flatFolders = useMemo(() => flattenTree(folderTree), [folderTree]);

  const refreshSeq = useRef(0);

  const refresh = useCallback(async () => {
    const mySeq = ++refreshSeq.current;
    const filters = {
      query,
      tag: activeTag,
      source: activeSource,
      folderId: activeFolder,
      favoritesOnly: view === 'favorites',
      sort
    };
    // Tags/Sources are scoped to the current folder — e.g. while browsing
    // "nsfw", the sidebar should only ever list sources/tags that actually
    // exist inside that folder, not every source in the whole library.
    const hasFolderFilter = !!(activeSource || activeTag);
    const [list, tagList, sourceList, folderList, statObj, facets, matchIds] = await Promise.all([
      window.vault.listItems(filters),
      window.vault.listTags(activeFolder),
      window.vault.listSources(activeFolder),
      window.vault.listFolders(),
      window.vault.getStats(),
      query && query.trim() ? window.vault.searchFacets(query, activeFolder) : Promise.resolve({ tags: [], sources: [] }),
      hasFolderFilter ? window.vault.matchingFolderIds({ source: activeSource, tag: activeTag }) : Promise.resolve(null)
    ]);
    // Discard this response if a newer refresh() has started since —
    // without this, a slower older request can resolve after a newer one
    // and overwrite fresh results with stale ones (visible as the facets
    // bar / results flickering while typing quickly).
    if (mySeq !== refreshSeq.current) return;
    setItems(list);
    setTags(tagList);
    setSources(sourceList);
    setFolders(folderList);
    setStats(statObj);
    setSearchFacets(facets);
    setMatchingFolderIds(matchIds ? new Set(matchIds) : null);
  }, [query, activeTag, activeSource, activeFolder, view, sort]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const unsubscribe = window.vault.onItemSaved(() => refresh());
    return unsubscribe;
  }, [refresh]);

  async function handleUpdate(id, patch) {
    const updated = await window.vault.updateItem(id, patch);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setOpenItem((prev) => (prev && prev.id === id ? updated : prev));
    if (patch.tags || patch.favorite !== undefined || patch.folder_id !== undefined) refresh();
    return updated;
  }

  async function handleDelete(id) {
    await window.vault.deleteItem(id);
    setOpenItem(null);
    setMenu(null);
    refresh();
  }

  function toggleFavorite(item) {
    handleUpdate(item.id, { favorite: item.favorite ? 0 : 1 });
  }

  function setRating(item, n) {
    handleUpdate(item.id, { rating: item.rating === n ? 0 : n });
  }

  function toggleTagOnItem(item, tagName) {
    const has = item.tags.includes(tagName);
    const nextTags = has ? item.tags.filter((t) => t !== tagName) : [...item.tags, tagName];
    handleUpdate(item.id, { tags: nextTags });
  }

  function addNewTag(item) {
    const clean = tagDraft.trim().toLowerCase();
    if (!clean) return;
    if (!item.tags.includes(clean)) handleUpdate(item.id, { tags: [...item.tags, clean] });
    setTagDraft('');
    setMenu(null);
  }

  function moveItemToFolder(itemId, folderId) {
    handleUpdate(itemId, { folder_id: folderId });
  }

  // ---------- Folder tree actions ----------

  function toggleExpandFolder(id) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startCreateFolder(parentKey) {
    setFolderDraft('');
    setCreatingFolderUnder(parentKey);
    setEditingFolderId(null);
    if (parentKey !== 'root') setExpandedFolders((prev) => new Set(prev).add(parentKey));
  }

  async function commitFolderDraft() {
    const name = folderDraft.trim();
    if (creatingFolderUnder != null) {
      if (name) {
        const parentId = creatingFolderUnder === 'root' ? null : creatingFolderUnder;
        await window.vault.createFolder(name, parentId);
      }
      setCreatingFolderUnder(null);
    } else if (editingFolderId != null) {
      if (name) await window.vault.renameFolder(editingFolderId, name);
      setEditingFolderId(null);
    }
    setFolderDraft('');
    refresh();
  }

  function cancelFolderDraft() {
    setCreatingFolderUnder(null);
    setEditingFolderId(null);
    setFolderDraft('');
  }

  function selectFolder(idOrNone) {
    setActiveFolder((prev) => (prev === idOrNone ? null : idOrNone));
    setView('all');
  }

  // Unlike selectFolder (sidebar toggle), this always navigates IN and
  // never toggles back out — matches how double-clicking a folder works
  // in a real file explorer. Used by breadcrumb clicks and in-grid tiles.
  function navigateFolder(folderId) {
    setActiveFolder(folderId);
    setView('all');
  }

  function expandAncestors(folderId) {
    const path = folderPath(folders, folderId);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      path.forEach((f) => next.add(f.id));
      return next;
    });
  }

  // Clicking "+ Folder" while at the root/Unsorted has nothing to choose
  // between, so it creates there directly. Inside a real folder, it's
  // ambiguous whether "new folder" means "next to this one" or "inside
  // it" — so ask, via a small two-option popup near the click.
  function createFolderHere(e) {
    const insideRealFolder = activeFolder && activeFolder !== 'none';
    if (!insideRealFolder) {
      startCreateFolder('root');
      return;
    }
    setNewFolderChoiceMenu({ x: e.clientX, y: e.clientY });
  }

  function createFolderAt(parent) {
    setNewFolderChoiceMenu(null);
    if (parent !== 'root') expandAncestors(parent);
    startCreateFolder(parent);
  }

  function pickFacetTag(tagName) {
    setQuery('');
    setActiveTag(tagName);
    setView('all');
  }

  function pickFacetSource(sourceName) {
    setQuery('');
    setActiveSource(sourceName);
    setView('all');
  }

  async function deleteFolderAndReparent(folder) {
    await window.vault.deleteFolder(folder.id);
    if (activeFolder === folder.id) setActiveFolder(null);
    refresh();
  }

  function openFolderContextMenu(e, folder) {
    setFolderMenu({ x: e.clientX, y: e.clientY, folder });
  }

  function buildFolderMenuItems(folder) {
    return [
      { label: 'New subfolder', onClick: () => startCreateFolder(folder.id) },
      { label: 'Rename', onClick: () => { setEditingFolderId(folder.id); setFolderDraft(folder.name); setCreatingFolderUnder(null); } },
      { separator: true },
      { label: 'Delete (keeps bookmarks)', danger: true, onClick: () => deleteFolderAndReparent(folder) }
    ];
  }

  // ---------- Drag and drop ----------

  function handleDropOnFolder(targetFolderId, { itemId, folderId }) {
    setDragOverFolderId(null);
    if (itemId) moveItemToFolder(itemId, targetFolderId);
    else if (folderId != null && folderId !== targetFolderId) window.vault.moveFolder(folderId, targetFolderId).then(refresh);
  }

  function handleDropUnsorted(e) {
    setDragOverFolderId(null);
    const itemId = e.dataTransfer.getData('application/x-vault-item');
    const folderId = e.dataTransfer.getData(FOLDER_MIME);
    if (itemId) moveItemToFolder(itemId, null);
    else if (folderId) window.vault.moveFolder(Number(folderId), null).then(refresh);
  }

  function handleDragStartFolder(e, folder) {
    e.dataTransfer.setData(FOLDER_MIME, String(folder.id));
    e.dataTransfer.effectAllowed = 'move';
  }

  // ---------- Item context menu ----------

  function openContextMenu(e, item) {
    setTagDraft('');
    setMenu({ x: e.clientX, y: e.clientY, item });
  }

  function buildMenuItems(item) {
    const ratingSubmenu = (
      <div className="submenu-pad">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="context-menu-item" onClick={() => { setRating(item, n); setMenu(null); }}>
            <span className="context-menu-check">{item.rating === n ? '✓' : ''}</span>
            <span className="context-menu-label">{'★'.repeat(n)}</span>
          </div>
        ))}
        <div className="context-menu-sep" />
        <div className="context-menu-item" onClick={() => { setRating(item, 0); setMenu(null); }}>
          <span className="context-menu-check" />
          <span className="context-menu-label">Clear rating</span>
        </div>
      </div>
    );

    const tagSubmenu = (
      <div className="submenu-pad">
        {tags.length === 0 && <div className="context-menu-item dim-item">No tags yet</div>}
        {tags.map((t) => (
          <div key={t.name} className="context-menu-item" onClick={() => toggleTagOnItem(item, t.name)}>
            <span className="context-menu-check">{item.tags.includes(t.name) ? '✓' : ''}</span>
            <span className="context-menu-label">#{t.name}</span>
          </div>
        ))}
        <div className="context-menu-sep" />
        <div className="context-menu-tag-input" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            placeholder="New tag…"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNewTag(item); }}
          />
        </div>
      </div>
    );

    const folderSubmenu = (
      <div className="submenu-pad">
        <div className="context-menu-item" onClick={() => { moveItemToFolder(item.id, null); setMenu(null); }}>
          <span className="context-menu-check">{item.folder_id == null ? '✓' : ''}</span>
          <span className="context-menu-label">Unsorted</span>
        </div>
        {flatFolders.length > 0 && <div className="context-menu-sep" />}
        {flatFolders.map((f) => (
          <div
            key={f.id}
            className="context-menu-item"
            style={{ paddingLeft: 8 + f.depth * 12 }}
            onClick={() => { moveItemToFolder(item.id, f.id); setMenu(null); }}
          >
            <span className="context-menu-check">{item.folder_id === f.id ? '✓' : ''}</span>
            <span className="context-menu-label">{f.name}</span>
          </div>
        ))}
      </div>
    );

    return [
      { label: 'Open details', onClick: () => setOpenItem(item) },
      { label: 'Open link in browser', onClick: () => window.vault.openExternal(item.url) },
      {
        label: 'Open link in Incognito',
        onClick: async () => {
          const result = await window.vault.openIncognito(item.url);
          if (!result || !result.ok) {
            window.alert(
              (result && result.error) ||
              'Could not open an incognito window. Set a browser path in Settings if auto-detection failed.'
            );
          }
        }
      },
      { separator: true },
      { label: 'Favorite', checked: !!item.favorite, onClick: () => toggleFavorite(item) },
      { label: 'Rating', submenu: ratingSubmenu },
      { label: 'Tags', submenu: tagSubmenu },
      { label: 'Move to folder', submenu: folderSubmenu },
      { separator: true },
      { label: 'Copy link', onClick: () => navigator.clipboard.writeText(item.url) },
      { separator: true },
      { label: 'Delete', danger: true, onClick: () => handleDelete(item.id) }
    ];
  }

  const currentFolderName = activeFolder && activeFolder !== 'none'
    ? flatFolders.find((f) => f.id === activeFolder)?.name
    : null;

  const panelTitle = view === 'favorites'
    ? 'Favorites'
    : activeFolder === 'none' ? 'Unsorted'
    : currentFolderName || (activeTag ? `#${activeTag}` : activeSource || 'All items');

  const isSearching = query && query.trim().length > 0;
  // Subfolder navigation only makes sense in the plain "browse" context —
  // not while searching (results span every folder) and not in Favorites.
  const showFolderUi = view === 'all' && !isSearching;
  const subfolderParentId = activeFolder && activeFolder !== 'none' ? activeFolder : null;
  const subfolders = showFolderUi
    ? folders.filter((f) => f.parent_id === subfolderParentId)
      // When a source/tag filter is active, only show subfolders that
      // actually contain (directly or nested) at least one matching item —
      // e.g. filtering by a source while browsing shouldn't offer a tile
      // into a sibling folder that has none of that source in it at all.
      .filter((f) => matchingFolderIds === null || matchingFolderIds.has(f.id))
    : [];
  const breadcrumbPath = showFolderUi ? folderPath(folders, activeFolder && activeFolder !== 'none' ? activeFolder : null) : [];

  return (
    <div className="app">
      <Sidebar
        query={query}
        onQuery={setQuery}
        view={view}
        onView={(v) => { setView(v); setActiveSource(null); setActiveTag(null); setActiveFolder(null); }}
        sources={sources}
        activeSource={activeSource}
        onSource={(s) => { setActiveSource(s); setView('all'); }}
        tags={tags}
        activeTag={activeTag}
        onTag={(t) => { setActiveTag(t); setView('all'); }}
        stats={stats}
        folderTree={folderTree}
        activeFolder={activeFolder}
        onSelectFolder={selectFolder}
        onFolderContextMenu={openFolderContextMenu}
        expandedFolders={expandedFolders}
        onToggleExpandFolder={toggleExpandFolder}
        creatingFolderUnder={creatingFolderUnder}
        onStartCreateFolder={startCreateFolder}
        folderDraft={folderDraft}
        onFolderDraftChange={setFolderDraft}
        onCommitFolderDraft={commitFolderDraft}
        onCancelFolderDraft={cancelFolderDraft}
        editingFolderId={editingFolderId}
        dragOverFolderId={dragOverFolderId}
        onDragOverFolder={setDragOverFolderId}
        onDragLeaveFolder={() => setDragOverFolderId(null)}
        onDropOnFolder={handleDropOnFolder}
        onDragStartFolder={handleDragStartFolder}
        onDropUnsorted={handleDropUnsorted}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Gallery
        items={items}
        onOpen={setOpenItem}
        onContextMenu={openContextMenu}
        onToggleFavorite={toggleFavorite}
        sort={sort}
        onSort={setSort}
        title={panelTitle}
        view={galleryView}
        onViewChange={setGalleryView}
        showFolderUi={showFolderUi}
        breadcrumbPath={breadcrumbPath}
        onBreadcrumbNavigate={navigateFolder}
        subfolders={subfolders}
        onNavigateFolder={navigateFolder}
        onFolderContextMenu={openFolderContextMenu}
        dragOverFolderId={dragOverFolderId}
        onDragOverFolder={setDragOverFolderId}
        onDragLeaveFolder={() => setDragOverFolderId(null)}
        onDropOnFolder={handleDropOnFolder}
        onCreateFolderHere={createFolderHere}
        searchQuery={query}
        searchFacets={searchFacets}
        onPickTag={pickFacetTag}
        onPickSource={pickFacetSource}
      />
      {openItem && (
        <DetailPanel
          item={openItem}
          onClose={() => setOpenItem(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onOpenExternal={(url) => window.vault.openExternal(url)}
        />
      )}
      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={buildMenuItems(menu.item)} onClose={() => setMenu(null)} />
      )}
      {folderMenu && (
        <ContextMenu
          x={folderMenu.x}
          y={folderMenu.y}
          items={buildFolderMenuItems(folderMenu.folder)}
          onClose={() => setFolderMenu(null)}
        />
      )}
      {newFolderChoiceMenu && (
        <ContextMenu
          x={newFolderChoiceMenu.x}
          y={newFolderChoiceMenu.y}
          items={[
            { label: `Add inside "${currentFolderName}"`, onClick: () => createFolderAt(activeFolder) },
            { label: 'Add to Main Directory', onClick: () => createFolderAt('root') }
          ]}
          onClose={() => setNewFolderChoiceMenu(null)}
        />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
