import React from 'react';
import { FOLDER_MIME, ITEM_MIME } from '../utils/dnd.js';

export default function FolderTiles({ folders, onNavigate, onContextMenu, onDropItem, dragOverId, onDragOver, onDragLeave }) {
  if (!folders.length) return null;

  return (
    <div className="folder-tiles">
      {folders.map((f) => (
        <div
          key={f.id}
          className={`folder-tile ${dragOverId === f.id ? 'drop-target' : ''}`}
          onClick={() => onNavigate(f.id)}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, f); }}
          onDragOver={(e) => { e.preventDefault(); onDragOver(f.id); }}
          onDragLeave={onDragLeave}
          onDrop={(e) => {
            e.preventDefault();
            const itemId = e.dataTransfer.getData(ITEM_MIME);
            const folderId = e.dataTransfer.getData(FOLDER_MIME);
            onDropItem(f.id, { itemId: itemId || null, folderId: folderId ? Number(folderId) : null });
          }}
        >
          <span className="folder-tile-icon">📁</span>
          <span className="folder-tile-name">{f.name}</span>
          <span className="folder-tile-count">{f.count}</span>
        </div>
      ))}
    </div>
  );
}
