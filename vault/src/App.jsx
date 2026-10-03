import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Gallery from './components/Gallery.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import BulkEditBar from './components/BulkEditBar.jsx';
import ResizeHandle from './components/ResizeHandle.jsx';
import Toast from './components/Toast.jsx';
import ThumbProgress from './components/ThumbProgress.jsx';
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
  const [activeFolder, setActiveFolder] = useState(null);
  const [sort, setSort] = useState('newest');
  const [openItem, setOpenItem] = useState(null);
  const [galleryView, setGalleryView] = useState(() => localStorage.getItem('vault:galleryView') || 'large');
  const [cardSize, setCardSize] = useState(() => Number(localStorage.getItem('vault:cardSize')) || 240);
  const [menu, setMenu] = useState(null);
  const [folderMenu, setFolderMenu] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchFacets, setSearchFacets] = useState({ tags: [], sources: [] });
  const [matchingFolderIds, setMatchingFolderIds] = useState(null);
  const [newFolderChoiceMenu, setNewFolderChoiceMenu] = useState(null);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Keyboard nav — focused item index
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Toast
  const [toast, setToast] = useState(null);
  const toastSeq = useRef(0);
  function showToast(msg) {
    toastSeq.current++;
    setToast({ msg, seq: toastSeq.current });
  }

  // Thumbnail retry progress
  const [jobs, setJobs] = useState([]);
  const [progressOpen, setProgressOpen] = useState(false);

  // Resizable panels
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem('vault:sidebarW')) || 268);
  const [detailWidth, setDetailWidth] = useState(() => Number(localStorage.getItem('vault:detailW')) || 340);

  useEffect(() => { localStorage.setItem('vault:sidebarW', String(sidebarWidth)); }, [sidebarWidth]);
  useEffect(() => { localStorage.setItem('vault:detailW', String(detailWidth)); }, [detailWidth]);

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('vault:theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('vault:theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Folder tree UI state
  const [expandedFolders, setExpandedFolders] = useState(() => new Set());
  const [creatingFolderUnder, setCreatingFolderUnder] = useState(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [folderDraft, setFolderDraft] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState(null);

  useEffect(() => { localStorage.setItem('vault:galleryView', galleryView); }, [galleryView]);
  useEffect(() => { localStorage.setItem('vault:cardSize', String(cardSize)); }, [cardSize]);

  const folderTree = useMemo(() => buildTree(folders), [folders]);
  const flatFolders = useMemo(() => flattenTree(folderTree), [folderTree]);

  const blurredFolderIds = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const set = new Set();
    for (const f of folders) {
      let cur = f;
      while (cur) {
        if (cur.blur) { set.add(f.id); break; }
        cur = cur.parent_id != null ? byId.get(cur.parent_id) : null;
      }
    }
    return set;
  }, [folders]);

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

  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    return window.vault.onProgress((evt) => {
      if (evt.type === 'job') setProgressOpen(true);
      setJobs((prev) => {
        if (evt.type === 'job') {
          const job = { id: evt.jobId, parentId: evt.parentId || null, kind: evt.kind, title: evt.title, total: evt.total || 0, done: 0, succeeded: 0, steps: [], status: 'running', summary: '', startedAt: evt.ts, endedAt: null };
          return [job, ...prev].slice(0, 200);
        }
        return prev.map((j) => {
          if (j.id !== evt.jobId) return j;
          if (evt.type === 'step') {
            const entry = { label: evt.label, status: evt.status, detail: evt.detail, ts: evt.ts };
            const i = j.steps.findIndex((st) => st.label === evt.label);
            const steps = i >= 0 ? j.steps.map((st, k) => (k === i ? entry : st)) : [...j.steps, entry];
            return { ...j, steps };
          }
          if (evt.type === 'progress') return { ...j, done: evt.done, succeeded: evt.succeeded };
          if (evt.type === 'end') return { ...j, status: evt.ok ? 'ok' : 'fail', summary: evt.summary, endedAt: evt.ts };
          return j;
        });
      });
      if (evt.type === 'end' && evt.ok) refreshRef.current();
    });
  }, []);

  useEffect(() => {
    const unsubscribe = window.vault.onItemSaved((item) => {
      showToast(`Saved "${item?.title || 'bookmark'}"`);
      refresh();
    });
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
    const item = items.find((i) => i.id === id);
    await window.vault.deleteItem(id);
    setOpenItem((prev) => (prev && prev.id === id ? null : prev));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setMenu(null);
    showToast(`Deleted "${item?.title || 'bookmark'}"`);
    refresh();
  }

  function toggleFavorite(item) {
    handleUpdate(item.id, { favorite: item.favorite ? 0 : 1 });
    showToast(item.favorite ? 'Removed from favorites' : 'Added to favorites');
  }

  function toggleTagOnItem(item, tagName) {
    const has = item.tags.includes(tagName);
    const nextTags = has ? item.tags.filter((t) => t !== tagName) : [...item.tags, tagName];
    handleUpdate(item.id, { tags: nextTags });
  }

  function addNewTag(item) {
    const clean = tagDraft.trim().toLowerCase();
    if (!clean) return;
    if (!item.tags.includes(clean)) {
      handleUpdate(item.id, { tags: [...item.tags, clean] });
      showToast(`Added tag #${clean}`);
    }
    setTagDraft('');
    setMenu(null);
  }

  function moveItemToFolder(itemId, folderId) {
    handleUpdate(itemId, { folder_id: folderId });
    const folderName = folderId ? flatFolders.find((f) => f.id === folderId)?.name : 'Unsorted';
    showToast(`Moved to ${folderName || 'folder'}`);
  }

  // ---------- Multi-select ----------

  function handleSelectItem(item, e) {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    }
  }

  function handleOpenItem(item) {
    setSelectedIds(new Set());
    setOpenItem(item);
  }

  async function bulkFavorite() {
    for (const id of selectedIds) await handleUpdate(id, { favorite: 1 });
    showToast(`${selectedIds.size} items favorited`);
  }

  async function bulkUnfavorite() {
    for (const id of selectedIds) await handleUpdate(id, { favorite: 0 });
    showToast(`${selectedIds.size} items unfavorited`);
  }

  async function bulkAddTag(tagName) {
    let count = 0;
    for (const id of selectedIds) {
      const item = items.find((i) => i.id === id);
      if (item && !item.tags.includes(tagName)) {
        await handleUpdate(id, { tags: [...item.tags, tagName] });
        count++;
      }
    }
    showToast(`Added #${tagName} to ${count} items`);
  }

  async function bulkRemoveTag(tagName) {
    let count = 0;
    for (const id of selectedIds) {
      const item = items.find((i) => i.id === id);
      if (item && item.tags.includes(tagName)) {
        await handleUpdate(id, { tags: item.tags.filter((t) => t !== tagName) });
        count++;
      }
    }
    showToast(`Removed #${tagName} from ${count} items`);
  }

  async function bulkMoveToFolder(folderId) {
    const count = selectedIds.size;
    for (const id of selectedIds) await handleUpdate(id, { folder_id: folderId });
    const folderName = folderId ? flatFolders.find((f) => f.id === folderId)?.name : 'Unsorted';
    showToast(`Moved ${count} items to ${folderName || 'folder'}`);
    setSelectedIds(new Set());
  }

  async function bulkDelete() {
    const count = selectedIds.size;
    const ids = [...selectedIds];
    for (const id of ids) {
      await window.vault.deleteItem(id);
    }
    setSelectedIds(new Set());
    setOpenItem(null);
    showToast(`Deleted ${count} items`);
    refresh();
  }

  // ---------- Keyboard shortcuts ----------

  useEffect(() => {
    function isTyping() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    function handler(e) {
      if (isTyping()) return;

      // Escape — close detail, clear selection, close menus/settings
      if (e.key === 'Escape') {
        if (menu) { setMenu(null); return; }
        if (folderMenu) { setFolderMenu(null); return; }
        if (newFolderChoiceMenu) { setNewFolderChoiceMenu(null); return; }
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (selectedIds.size > 0) { setSelectedIds(new Set()); showToast('Selection cleared'); return; }
        if (openItem) { setOpenItem(null); return; }
        return;
      }

      // Ctrl+A — select all visible items
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (items.length === 0) return;
        setSelectedIds(new Set(items.map((i) => i.id)));
        showToast(`Selected all ${items.length} items`);
        return;
      }

      // Delete / Backspace — delete focused or selected items
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          bulkDelete();
          return;
        }
        if (openItem) {
          e.preventDefault();
          handleDelete(openItem.id);
          return;
        }
        return;
      }

      // F — toggle favorite on focused/open item
      if (e.key === 'f' || e.key === 'F') {
        if (selectedIds.size > 0) {
          const allFav = [...selectedIds].every((id) => items.find((i) => i.id === id)?.favorite);
          allFav ? bulkUnfavorite() : bulkFavorite();
          return;
        }
        if (openItem) { toggleFavorite(openItem); return; }
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          toggleFavorite(items[focusedIndex]);
          return;
        }
        return;
      }

      // / — focus search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) searchInput.focus();
        return;
      }

      // J/K — navigate items
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, items.length - 1);
          scrollItemIntoView(next);
          return next;
        });
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          scrollItemIntoView(next);
          return next;
        });
        return;
      }

      // Enter — open focused item
      if (e.key === 'Enter') {
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          handleOpenItem(items[focusedIndex]);
        }
        return;
      }

      // O — open focused item's URL in browser
      if (e.key === 'o' || e.key === 'O') {
        const target = openItem || (focusedIndex >= 0 && focusedIndex < items.length ? items[focusedIndex] : null);
        if (target) {
          window.vault.openExternal(target.url);
          showToast('Opened in browser');
        }
        return;
      }

      // C — copy link
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
        const target = openItem || (focusedIndex >= 0 && focusedIndex < items.length ? items[focusedIndex] : null);
        if (target) {
          navigator.clipboard.writeText(target.url);
          showToast('Link copied');
        }
        return;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, openItem, menu, folderMenu, newFolderChoiceMenu, settingsOpen, selectedIds, focusedIndex]);

  function scrollItemIntoView(index) {
    requestAnimationFrame(() => {
      const gallery = document.querySelector('.gallery');
      if (!gallery) return;
      const cards = gallery.querySelectorAll('.card, .list-row, .details-table tbody tr');
      if (cards[index]) cards[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  // Reset focused index when items change
  useEffect(() => { setFocusedIndex(-1); }, [items]);

  // ---------- Resize handlers ----------

  const handleSidebarResize = useCallback((clientX) => {
    setSidebarWidth(Math.max(200, Math.min(450, clientX)));
  }, []);

  const handleDetailResize = useCallback((clientX) => {
    const newWidth = window.innerWidth - clientX;
    setDetailWidth(Math.max(280, Math.min(600, newWidth)));
  }, []);

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
        showToast(`Created folder "${name}"`);
      }
      setCreatingFolderUnder(null);
    } else if (editingFolderId != null) {
      if (name) {
        await window.vault.renameFolder(editingFolderId, name);
        showToast(`Renamed to "${name}"`);
      }
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
    setActiveSource(null);
    setView('all');
  }

  function navigateFolder(folderId) {
    setActiveFolder(folderId);
    setActiveSource(null);
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
    showToast(`Deleted folder "${folder.name}"`);
    refresh();
  }

  async function toggleFolderBlur(folder) {
    await window.vault.toggleFolderBlur(folder.id);
    showToast(folder.blur ? `Unblurred "${folder.name}"` : `Blurred "${folder.name}" in All Items`);
    refresh();
  }

  function openFolderContextMenu(e, folder) {
    setFolderMenu({ x: e.clientX, y: e.clientY, folder });
  }

  async function retryFolderThumbnails(folderId) {
    showToast('Fetching thumbnails…');
    const result = await window.vault.retryThumbnails(folderId);
    if (result.retried === 0) {
      showToast('No items missing thumbnails');
    } else {
      showToast(`Loaded ${result.succeeded} of ${result.retried} thumbnails`);
    }
    refresh();
  }

  function buildFolderMenuItems(folder) {
    return [
      { label: 'New subfolder', onClick: () => startCreateFolder(folder.id) },
      { label: 'Rename', onClick: () => { setEditingFolderId(folder.id); setFolderDraft(folder.name); setCreatingFolderUnder(null); } },
      { separator: true },
      {
        label: folder.blur ? 'Unblur in All Items' : 'Blur in All Items',
        checked: !!folder.blur,
        onClick: () => toggleFolderBlur(folder)
      },
      { label: 'Load failed thumbnails', onClick: () => retryFolderThumbnails(folder.id) },
      { separator: true },
      { label: 'Delete (keeps bookmarks)', danger: true, onClick: () => deleteFolderAndReparent(folder) }
    ];
  }

  // ---------- Drag and drop ----------

  function handleDropOnFolder(targetFolderId, { itemId, folderId }) {
    setDragOverFolderId(null);
    if (itemId) {
      moveItemToFolder(itemId, targetFolderId);
    } else if (folderId != null && folderId !== targetFolderId) {
      window.vault.moveFolder(folderId, targetFolderId).then(() => {
        showToast('Folder moved');
        refresh();
      });
    }
  }

  function handleDropUnsorted(e) {
    setDragOverFolderId(null);
    const itemId = e.dataTransfer.getData('application/x-vault-item');
    const folderId = e.dataTransfer.getData(FOLDER_MIME);
    if (itemId) moveItemToFolder(itemId, null);
    else if (folderId) window.vault.moveFolder(Number(folderId), null).then(() => { showToast('Moved to Unsorted'); refresh(); });
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
      { label: 'Open details', onClick: () => handleOpenItem(item) },
      { label: 'Open link in browser', onClick: () => { window.vault.openExternal(item.url); showToast('Opened in browser'); } },
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
      { label: 'Tags', submenu: tagSubmenu },
      { label: 'Move to folder', submenu: folderSubmenu },
      { separator: true },
      { label: 'Copy link', onClick: () => { navigator.clipboard.writeText(item.url); showToast('Link copied'); } },
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
  const showFolderUi = view === 'all' && !isSearching;
  const subfolderParentId = activeFolder && activeFolder !== 'none' ? activeFolder : null;
  const subfolders = showFolderUi
    ? folders.filter((f) => f.parent_id === subfolderParentId)
      .filter((f) => matchingFolderIds === null || matchingFolderIds.has(f.id))
    : [];
  const breadcrumbPath = showFolderUi ? folderPath(folders, activeFolder && activeFolder !== 'none' ? activeFolder : null) : [];

  const hasSelection = selectedIds.size > 0;

  return (
    <div
      className={`app ${openItem ? 'has-detail' : ''}`}
      style={{
        gridTemplateColumns: openItem
          ? `${sidebarWidth}px auto minmax(0,1fr) auto ${detailWidth}px`
          : `${sidebarWidth}px auto minmax(0,1fr)`
      }}
    >
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
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />
      <ResizeHandle side="left" onResize={handleSidebarResize} />
      <Gallery
        items={items}
        onOpen={handleOpenItem}
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
        blurredFolderIds={blurredFolderIds}
        activeFolder={activeFolder}
        cardSize={cardSize}
        onCardSizeChange={setCardSize}
        selectedIds={selectedIds}
        onSelectItem={handleSelectItem}
        focusedIndex={focusedIndex}
      />
      {openItem && (
        <>
          <ResizeHandle side="right" onResize={handleDetailResize} />
          <DetailPanel
            item={openItem}
            onClose={() => setOpenItem(null)}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onOpenExternal={(url) => window.vault.openExternal(url)}
            onToast={showToast}
          />
        </>
      )}
      {hasSelection && (
        <BulkEditBar
          count={selectedIds.size}
          folders={flatFolders}
          tags={tags}
          onFavorite={bulkFavorite}
          onUnfavorite={bulkUnfavorite}
          onAddTag={bulkAddTag}
          onRemoveTag={bulkRemoveTag}
          onMoveToFolder={bulkMoveToFolder}
          onDelete={bulkDelete}
          onClear={() => { setSelectedIds(new Set()); showToast('Selection cleared'); }}
        />
      )}
      {toast && (
        <Toast
          message={toast.msg}
          key={toast.seq}
          onDone={() => setToast(null)}
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
      {progressOpen && jobs.length > 0 && (
        <ThumbProgress jobs={jobs} onClose={() => setProgressOpen(false)} onClear={() => { setJobs([]); setProgressOpen(false); }} />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
