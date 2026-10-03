import React, { useState, useEffect } from 'react';

function thumbSrc(item) {
  if (!item.thumbnail_path) return null;
  return `vault-thumb://${encodeURIComponent(item.thumbnail_path)}`;
}

function faviconSrc(item) {
  if (!item.favicon_path) return null;
  return `vault-thumb://${encodeURIComponent(item.favicon_path)}`;
}

export default function DetailPanel({ item, onClose, onUpdate, onDelete, onOpenExternal }) {
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
  }

  function addTag(e) {
    if (e.key !== 'Enter' || !tagInput.trim()) return;
    const next = [...new Set([...tags, tagInput.trim().toLowerCase()])];
    setTags(next);
    commit({ tags: next });
    setTagInput('');
  }

  function removeTag(name) {
    const next = tags.filter((t) => t !== name);
    setTags(next);
    commit({ tags: next });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail" onClick={(e) => e.stopPropagation()}>
        <button className="btn close-btn" onClick={onClose}>✕</button>
        <div className="image-pane">
          {thumbSrc(item) ? (
            <img src={thumbSrc(item)} alt="" />
          ) : (
            <div style={{ color: 'var(--text-faint)' }}>No thumbnail</div>
          )}
        </div>
        <div className="info-pane">
          <div>
            <div className="field-label">Title</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => commit({ title })}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="rating-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={`star ${item.rating >= n ? 'filled' : ''}`}
                  onClick={() => commit({ rating: item.rating === n ? 0 : n })}
                >★</span>
              ))}
            </div>
            <button
              className={`heart-toggle ${item.favorite ? 'active' : ''}`}
              onClick={() => commit({ favorite: item.favorite ? 0 : 1 })}
              title="Favorite"
            >♥</button>
          </div>

          <div>
            <div className="field-label">Source</div>
            <div className="detail-source" style={{ fontSize: 12.5, color: 'var(--text-muted)', wordBreak: 'break-word' }}>
              {faviconSrc(item) && <img className="source-icon" src={faviconSrc(item)} alt="" />}
              {item.source || '—'}
            </div>
          </div>

          <div>
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

          <div>
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
    </div>
  );
}
