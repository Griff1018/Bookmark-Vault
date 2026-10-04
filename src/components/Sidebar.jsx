import React from 'react';
import FolderTree from './FolderTree.jsx';

export default function Sidebar({
  query, onQuery,
  view, onView,
  stats,
  folderTree, activeFolder, onSelectFolder, onFolderContextMenu,
  expandedFolders, onToggleExpandFolder,
  creatingFolderUnder, onStartCreateFolder, folderDraft, onFolderDraftChange,
  onCommitFolderDraft, onCancelFolderDraft,
  editingFolderId, dragOverFolderId, onDragOverFolder, onDragLeaveFolder,
  onDropOnFolder, onDragStartFolder, onDropUnsorted,
  onOpenSettings
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

      <div className="sidebar-footer">
        <span>Bridge: 127.0.0.1:47564</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="settings-btn" title="Settings" onClick={onOpenSettings}>⚙</button>
        </div>
      </div>
    </aside>
  );
}
