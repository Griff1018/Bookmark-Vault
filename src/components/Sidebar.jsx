import React from 'react';
import FolderTree from './FolderTree.jsx';

export default function Sidebar({
  query, onQuery,
  view, onView,
  sources, activeSource, onSource,
  tags, activeTag, onTag,
  stats,
  folderTree, activeFolder, onSelectFolder, onFolderContextMenu,
  expandedFolders, onToggleExpandFolder,
  creatingFolderUnder, onStartCreateFolder, folderDraft, onFolderDraftChange,
  onCommitFolderDraft, onCancelFolderDraft,
  editingFolderId, dragOverFolderId, onDragOverFolder, onDragLeaveFolder,
  onDropOnFolder, onDragStartFolder, onDropUnsorted,
  onOpenSettings, darkMode, onToggleDarkMode
}) {
  return (
    <aside className="sidebar">
      <div className="wordmark">
        Vault
        <small>{stats.total} saved</small>
      </div>

      <div className="search-box">
        <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>⌕</span>
        <input
          placeholder="Search title, notes, source…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      <div className="nav-section">
        <div
          className={`nav-row ${view === 'all' ? 'active' : ''}`}
          onClick={() => onView('all')}
        >
          <span>All items</span>
          <span className="count">{stats.total}</span>
        </div>
        <div
          className={`nav-row ${view === 'favorites' ? 'active' : ''}`}
          onClick={() => onView('favorites')}
        >
          <span>Favorites</span>
          <span className="count">{stats.favorites}</span>
        </div>
      </div>

      <div className="nav-section">
        <div className="nav-section-head">
          <h4>Folders</h4>
          <button className="add-folder-btn" title="New folder" onClick={() => onStartCreateFolder('root')}>+</button>
        </div>
        <div
          className={`nav-row ${activeFolder === 'none' ? 'active' : ''} ${dragOverFolderId === 'unsorted' ? 'drop-target' : ''}`}
          onClick={() => onSelectFolder(activeFolder === 'none' ? null : 'none')}
          onDragOver={(e) => { e.preventDefault(); onDragOverFolder('unsorted'); }}
          onDragLeave={onDragLeaveFolder}
          onDrop={(e) => { e.preventDefault(); onDropUnsorted(e); }}
        >
          <span>Unsorted</span>
          <span className="count">{stats.unsorted}</span>
        </div>
        <FolderTree
          tree={folderTree}
          expanded={expandedFolders}
          onToggleExpand={onToggleExpandFolder}
          activeFolder={activeFolder}
          onSelect={onSelectFolder}
          onContextMenu={onFolderContextMenu}
          creatingUnder={creatingFolderUnder}
          editingId={editingFolderId}
          draftValue={folderDraft}
          onDraftChange={onFolderDraftChange}
          onCommitDraft={onCommitFolderDraft}
          onCancelDraft={onCancelFolderDraft}
          dragOverId={dragOverFolderId}
          onDragOverFolder={onDragOverFolder}
          onDropOnFolder={onDropOnFolder}
          onDragLeaveFolder={onDragLeaveFolder}
          onDragStartFolder={onDragStartFolder}
        />
      </div>

      <div className="nav-section">
        <h4>Sources</h4>
        <div className="nav-list">
          {sources.length === 0 && <div className="nav-row" style={{ color: 'var(--text-faint)' }}>None yet</div>}
          {sources.map((s) => (
            <div
              key={s.source}
              className={`nav-row ${activeSource === s.source ? 'active' : ''}`}
              onClick={() => onSource(activeSource === s.source ? null : s.source)}
              title={s.source}
            >
              <span>{s.source}</span>
              <span className="count">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="nav-section">
        <h4>Tags</h4>
        <div className="nav-list">
          {tags.length === 0 && <div className="nav-row" style={{ color: 'var(--text-faint)' }}>None yet</div>}
          {tags.map((t) => (
            <div
              key={t.name}
              className={`nav-row ${activeTag === t.name ? 'active' : ''}`}
              onClick={() => onTag(activeTag === t.name ? null : t.name)}
            >
              <span>#{t.name}</span>
              <span className="count">{t.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <span>Bridge: 127.0.0.1:47564</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="theme-toggle" title={darkMode ? 'Light mode' : 'Dark mode'} onClick={onToggleDarkMode}>
            {darkMode ? '☀' : '☾'}
          </button>
          <button className="settings-btn" title="Settings" onClick={onOpenSettings}>⚙</button>
        </div>
      </div>
    </aside>
  );
}
