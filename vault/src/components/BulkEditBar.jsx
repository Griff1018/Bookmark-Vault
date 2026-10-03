import React, { useState } from 'react';

export default function BulkEditBar({ count, folders, tags, onFavorite, onUnfavorite, onAddTag, onRemoveTag, onMoveToFolder, onDelete, onClear }) {
  const [showTags, setShowTags] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [tagInput, setTagInput] = useState('');

  return (
    <div className="bulk-bar">
      <div className="bulk-bar-inner">
        <span className="bulk-count">{count} selected</span>

        <div className="bulk-actions">
          <button className="btn bulk-btn" onClick={onFavorite} title="Favorite all">♥ Favorite</button>
          <button className="btn bulk-btn" onClick={onUnfavorite} title="Unfavorite all">♡ Unfavorite</button>

          <div className="bulk-dropdown-wrap">
            <button className="btn bulk-btn" onClick={() => { setShowTags(!showTags); setShowFolders(false); }}>
              # Tags ▾
            </button>
            {showTags && (
              <div className="bulk-dropdown">
                <div className="bulk-dropdown-section">
                  <div className="bulk-dropdown-label">Add tag</div>
                  <div className="bulk-tag-input-row">
                    <input
                      autoFocus
                      placeholder="Type tag name…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          onAddTag(tagInput.trim().toLowerCase());
                          setTagInput('');
                        }
                      }}
                    />
                  </div>
                  {tags.length > 0 && (
                    <>
                      <div className="bulk-dropdown-label" style={{ marginTop: 8 }}>Quick add</div>
                      {tags.map((t) => (
                        <div key={t.name} className="bulk-dropdown-item" onClick={() => onAddTag(t.name)}>
                          + #{t.name}
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {tags.length > 0 && (
                  <div className="bulk-dropdown-section">
                    <div className="bulk-dropdown-label">Remove tag</div>
                    {tags.map((t) => (
                      <div key={t.name} className="bulk-dropdown-item danger" onClick={() => onRemoveTag(t.name)}>
                        − #{t.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bulk-dropdown-wrap">
            <button className="btn bulk-btn" onClick={() => { setShowFolders(!showFolders); setShowTags(false); }}>
              📁 Move ▾
            </button>
            {showFolders && (
              <div className="bulk-dropdown">
                <div className="bulk-dropdown-item" onClick={() => { onMoveToFolder(null); setShowFolders(false); }}>
                  Unsorted
                </div>
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="bulk-dropdown-item"
                    style={{ paddingLeft: 10 + f.depth * 12 }}
                    onClick={() => { onMoveToFolder(f.id); setShowFolders(false); }}
                  >
                    {f.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="btn bulk-btn danger" onClick={onDelete}>🗑 Delete</button>
        </div>

        <button className="btn bulk-clear" onClick={onClear}>✕ Clear</button>
      </div>
    </div>
  );
}
