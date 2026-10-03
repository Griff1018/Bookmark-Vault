import React from 'react';
import { ITEM_MIME, FOLDER_MIME } from '../utils/dnd.js';

function FolderRow({
  node, depth, expanded, onToggleExpand,
  activeFolder, onSelect, onContextMenu,
  creatingUnder, editingId, draftValue, onDraftChange, onCommitDraft, onCancelDraft,
  dragOverId, onDragOverFolder, onDropOnFolder, onDragLeaveFolder,
  onDragStartFolder
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isEditing = editingId === node.id;

  return (
    <>
      <div
        className={`nav-row folder-row ${activeFolder === node.id ? 'active' : ''} ${dragOverId === node.id ? 'drop-target' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => !isEditing && onSelect(node.id)}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node); }}
        draggable={!isEditing}
        onDragStart={(e) => onDragStartFolder(e, node)}
        onDragOver={(e) => { e.preventDefault(); onDragOverFolder(node.id); }}
        onDragLeave={onDragLeaveFolder}
        onDrop={(e) => {
          e.preventDefault();
          const itemId = e.dataTransfer.getData(ITEM_MIME);
          const folderId = e.dataTransfer.getData(FOLDER_MIME);
          onDropOnFolder(node.id, { itemId: itemId || null, folderId: folderId ? Number(folderId) : null });
        }}
      >
        <span
          className={`folder-caret ${hasChildren ? '' : 'empty'}`}
          onClick={(e) => { e.stopPropagation(); hasChildren && onToggleExpand(node.id); }}
        >
          {hasChildren ? (isOpen ? '▾' : '▸') : ''}
        </span>
        <span className="folder-icon">📁</span>
        {isEditing ? (
          <input
            autoFocus
            className="inline-rename"
            value={draftValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitDraft();
              if (e.key === 'Escape') onCancelDraft();
            }}
            onBlur={onCommitDraft}
          />
        ) : (
          <span className="folder-name">{node.name}</span>
        )}
        {!isEditing && <span className="count">{node.count}</span>}
      </div>

      {creatingUnder === node.id && (
        <div className="nav-row folder-row" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
          <span className="folder-caret empty" />
          <span className="folder-icon">📁</span>
          <input
            autoFocus
            className="inline-rename"
            placeholder="Folder name"
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitDraft();
              if (e.key === 'Escape') onCancelDraft();
            }}
            onBlur={onCommitDraft}
          />
        </div>
      )}

      {hasChildren && isOpen && node.children.map((child) => (
        <FolderRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          activeFolder={activeFolder}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          creatingUnder={creatingUnder}
          editingId={editingId}
          draftValue={draftValue}
          onDraftChange={onDraftChange}
          onCommitDraft={onCommitDraft}
          onCancelDraft={onCancelDraft}
          dragOverId={dragOverId}
          onDragOverFolder={onDragOverFolder}
          onDropOnFolder={onDropOnFolder}
          onDragLeaveFolder={onDragLeaveFolder}
          onDragStartFolder={onDragStartFolder}
        />
      ))}
    </>
  );
}

export default function FolderTree(props) {
  const { tree, creatingUnder, draftValue, onDraftChange, onCommitDraft, onCancelDraft } = props;
  return (
    <div className="nav-list folder-tree">
      {tree.map((node) => (
        <FolderRow key={node.id} node={node} depth={0} {...props} />
      ))}
      {creatingUnder === 'root' && (
        <div className="nav-row folder-row" style={{ paddingLeft: 8 }}>
          <span className="folder-caret empty" />
          <span className="folder-icon">📁</span>
          <input
            autoFocus
            className="inline-rename"
            placeholder="Folder name"
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitDraft();
              if (e.key === 'Escape') onCancelDraft();
            }}
            onBlur={onCommitDraft}
          />
        </div>
      )}
    </div>
  );
}
