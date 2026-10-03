import React, { useState, useEffect } from 'react';

function thumbSrc(item) {
  if (!item.thumbnail_path) return null;
  return `vault-thumb://${encodeURIComponent(item.thumbnail_path)}`;
}

function faviconSrc(item) {
  if (!item.favicon_path) return null;
  return `vault-thumb://${encodeURIComponent(item.favicon_path)}`;
}

export default function DetailPanel({ item, onClose, onUpdate, onDelete, onOpenExternal, onToast }) {
  const [title, setTitle] = useState(item.title || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(item.tags || []);

  useEffect(() => {
    setTitle(item.title || '');
    setNotes(item.notes || '');
    setTags(item.tags || []);
  }, [item.id]);

  function commit(patch) {
    onUpdate(item.id, patch);
    if (patch.title) onToast && onToast('Title updated');
    if (patch.notes) onToast && onToast('Notes saved');
    if (patch.favorite !== undefined) onToast && onToast(patch.favorite ? 'Added to favorites' : 'Removed from favorites');
  }

  function addTag(e) {
    if (e.key !== 'Enter' || !tagInput.trim()) return;
    const next = [...new Set([...tags, tagInput.trim().toLowerCase()])];
    setTags(next);
    onUpdate(item.id, { tags: next });
    onToast && onToast(`Added tag #${tagInput.trim().toLowerCase()}`);
    setTagInput('');
  }

  function removeTag(name) {
    const next = tags.filter((t) => t !== name);
    setTags(next);
    onUpdate(item.id, { tags: next });
    onToast && onToast(`Removed tag #${name}`);
  }

  return (
    <aside className="detail-sidebar">
      <div className="detail-sidebar-header">
        <span className="detail-sidebar-title">Details</span>
        <button className="btn detail-close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="detail-sidebar-body">
        <div className="detail-thumb-area">
          {thumbSrc(item) ? (
            <img src={thumbSrc(item)} alt="" />
          ) : faviconSrc(item) ? (
            <div className="detail-no-thumb favicon-fallback"><img src={faviconSrc(item)} alt="" /></div>
          ) : (
            <div className="detail-no-thumb">No thumbnail</div>
          )}
        </div>

        <div className="detail-fields">
          <div className="detail-field">
            <div className="field-label">Title</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => commit({ title })}
            />
          </div>

          <div className="detail-field">
            <div className="field-label">URL</div>
            <div className="detail-url" title={item.url}>{item.url}</div>
          </div>

          <div className="detail-field">
            <div className="detail-fav-row">
              <button
                className={`heart-toggle ${item.favorite ? 'active' : ''}`}
                onClick={() => commit({ favorite: item.favorite ? 0 : 1 })}
                title="Favorite"
              >♥</button>
              <span className="detail-fav-label">{item.favorite ? 'Favorited' : 'Add to favorites'}</span>
            </div>
          </div>

          <div className="detail-field">
            <div className="field-label">Source</div>
            <div className="detail-source" style={{ fontSize: 12.5, color: 'var(--text-muted)', wordBreak: 'break-word' }}>
              {faviconSrc(item) && <img className="source-icon" src={faviconSrc(item)} alt="" />}
              {item.source || '—'}
            </div>
          </div>

          <div className="detail-field">
            <div className="field-label">Tags</div>
            <div className="tag-chip-row" style={{ marginBottom: 8 }}>
              {tags.map((t) => (
                <span className="tag-chip" key={t}>
                  #{t}
                  <button onClick={() => removeTag(t)}>✕</button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add tag, press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
            />
          </div>

          <div className="detail-field">
            <div className="field-label">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => commit({ notes })}
            />
          </div>

          <div className="detail-actions">
            <button className="btn primary" onClick={() => onOpenExternal(item.url)}>Open link</button>
            <button className="btn danger" onClick={() => onDelete(item.id)}>Delete</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
