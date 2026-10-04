import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

function thumbSrc(item) {
  if (!item.thumbnail_path) return null;
  return `vault-thumb://${encodeURIComponent(item.thumbnail_path)}`;
}

function faviconSrc(item) {
  if (!item.favicon_path) return null;
  return `vault-thumb://${encodeURIComponent(item.favicon_path)}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function DetailPanel({ item, onClose, onUpdate, onDelete, onOpenExternal, onOpenIncognito, onLoadThumbnail, onToast }) {
  const [title, setTitle] = useState(item.title || '');
  const [notes, setNotes] = useState(item.notes || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState(item.tags || []);
  const [dims, setDims] = useState(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    setTitle(item.title || '');
    setNotes(item.notes || '');
    setTags(item.tags || []);
    setDims(null);
    setZoomed(false);
  }, [item.id]);

  useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setZoomed(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoomed]);

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
        <span className="detail-sidebar-title">DETAIL <i>/ {String(item.id).slice(0, 8)}</i></span>
        <button className="btn detail-close-btn" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="detail-sidebar-body">
        <figure className="detail-figure">
          <span className="tick tl" /><span className="tick tr" /><span className="tick bl" /><span className="tick br" />
          <div className="detail-thumb-area">
            {thumbSrc(item) ? (
              <img
                className="zoomable"
                src={thumbSrc(item)}
                alt=""
                title="Click to enlarge"
                onClick={() => setZoomed(true)}
                onLoad={(e) => setDims(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)}
              />
            ) : faviconSrc(item) ? (
              <div className="detail-no-thumb favicon-fallback"><img src={faviconSrc(item)} alt="" /></div>
            ) : (
              <div className="detail-no-thumb">No thumbnail</div>
            )}
            {(!item.thumbnail_path || item.has_pending_thumbnail) && (
              <button className="btn detail-load-thumb" onClick={onLoadThumbnail}>Load thumbnail</button>
            )}
          </div>
          {dims && <span className="detail-dim-tag">[{dims}]</span>}
        </figure>

        <div className="detail-fields">
          <input
            className="detail-title-input"
            type="text"
            value={title}
            placeholder="Untitled"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => commit({ title })}
          />

          <div className="detail-toolbar">
            <button
              className={`btn fav ${item.favorite ? 'active' : ''}`}
              onClick={() => commit({ favorite: item.favorite ? 0 : 1 })}
              title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
            >♥</button>
            <button className="btn incognito" onClick={onOpenIncognito} title="Open link in incognito">
              <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor"><path d="M2 8.5h12v1H2zM4 8.5l.9-4.2c.1-.5.6-.8 1.1-.6L8 4.5l2-.8c.5-.2 1 .1 1.1.6l.9 4.2z"/><circle cx="5" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.2"/><circle cx="11" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M7 12h2" stroke="currentColor" strokeWidth="1.2"/></svg>
            </button>
            <button className="btn primary" onClick={() => onOpenExternal(item.url)}>Open link</button>
            <button className="btn danger" onClick={() => onDelete(item.id)}>Delete</button>
          </div>

          <dl className="detail-specs">
            <div className="spec">
              <dt>Source</dt>
              <dd>
                {faviconSrc(item) && <img className="source-icon" src={faviconSrc(item)} alt="" />}
                {item.source || '—'}
              </dd>
            </div>
            <div className="spec">
              <dt>Added</dt>
              <dd>{formatDate(item.created_at)}</dd>
            </div>
            <div className="spec">
              <dt>URL</dt>
              <dd className="url" title={item.url} onClick={() => onOpenExternal(item.url)}>{item.url}</dd>
            </div>
          </dl>

          <div className="detail-field">
            <div className="field-label">Tags</div>
            {tags.length > 0 && (
              <div className="tag-chip-row" style={{ marginBottom: 8 }}>
                {tags.map((t) => (
                  <span className="tag-chip" key={t}>
                    #{t}
                    <button onClick={() => removeTag(t)}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              placeholder="add tag + enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
            />
          </div>

          <div className="detail-field">
            <div className="field-label">Notes</div>
            <textarea
              value={notes}
              placeholder="write something…"
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => commit({ notes })}
            />
          </div>
        </div>
      </div>
      {zoomed && thumbSrc(item) && createPortal(
        <div className="lightbox" onClick={() => setZoomed(false)}>
          <button className="lightbox-close" onClick={() => setZoomed(false)} title="Close (Esc)">✕</button>
          <img src={thumbSrc(item)} alt="" onClick={(e) => e.stopPropagation()} />
          {dims && <span className="lightbox-dim">[{dims}]</span>}
        </div>,
        document.body
      )}
    </aside>
  );
}
