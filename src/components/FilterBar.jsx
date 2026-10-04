import React, { useEffect, useRef, useState } from 'react';

function Dropdown({ icon, label, activeLabel, items, onPick, onClear, searchable, align = 'left', emptyText }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const shown = q ? items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())) : items;

  return (
    <div className="fb-wrap" ref={ref}>
      <button className={`fb-btn ${activeLabel ? 'active' : ''}`} onClick={() => { setOpen(!open); setQ(''); }}>
        {icon && <span className="fb-icon">{icon}</span>}
        <span className="fb-label">{activeLabel || label}</span>
        <span className="fb-caret">▾</span>
        {activeLabel && onClear && (
          <span className="fb-clear" title="Clear filter" onClick={(e) => { e.stopPropagation(); onClear(); }}>✕</span>
        )}
      </button>
      {open && (
        <div className={`fb-pop ${align === 'right' ? 'right' : ''}`}>
          {searchable && (
            <input autoFocus className="fb-search" placeholder={`Filter ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          <div className="fb-list">
            {shown.length === 0 && <div className="fb-empty">{emptyText || 'None yet'}</div>}
            {shown.map((i) => (
              <div
                key={i.key}
                className={`fb-item ${i.active ? 'active' : ''}`}
                onClick={() => { onPick(i.key); setOpen(false); }}
              >
                <span className="fb-check">{i.active ? '✓' : ''}</span>
                <span className="fb-item-label" title={i.label}>{i.label}</span>
                {i.count !== undefined && <span className="fb-count">{i.count}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'title', label: 'Title A–Z' }
];

export default function FilterBar({ tags, sources, activeTag, activeSource, onTag, onSource, sort, onSort }) {
  return (
    <div className="filter-bar">
      <Dropdown
        icon="#"
        label="Tags"
        searchable
        activeLabel={activeTag ? `#${activeTag}` : null}
        onClear={() => onTag(null)}
        items={tags.map((t) => ({ key: t.name, label: `#${t.name}`, count: t.count, active: activeTag === t.name }))}
        onPick={(k) => onTag(activeTag === k ? null : k)}
      />
      <Dropdown
        icon="◎"
        label="Sources"
        searchable
        activeLabel={activeSource || null}
        onClear={() => onSource(null)}
        items={sources.map((s) => ({ key: s.source, label: s.source, count: s.count, active: activeSource === s.source }))}
        onPick={(k) => onSource(activeSource === k ? null : k)}
      />
      <span className="fb-sep" />
      <Dropdown
        icon="↕"
        label="Sort"
        align="right"
        activeLabel={SORTS.find((s) => s.key === sort)?.label}
        items={SORTS.map((s) => ({ ...s, active: sort === s.key }))}
        onPick={onSort}
      />
    </div>
  );
}
