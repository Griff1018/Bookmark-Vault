import React from 'react';

const VIEWS = [
  { id: 'large', label: '瀑布 Waterfall', icon: (
    <svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
  ) },
  { id: 'rows', label: '平铺 Tiled rows', icon: (
    <svg viewBox="0 0 16 16"><rect x="1" y="1.5" width="5" height="5" rx="0.6"/><rect x="7.5" y="1.5" width="7.5" height="5" rx="0.6"/><rect x="1" y="9.5" width="8" height="5" rx="0.6"/><rect x="10.5" y="9.5" width="4.5" height="5" rx="0.6"/></svg>
  ) },
  { id: 'small', label: 'Grid', icon: (
    <svg viewBox="0 0 16 16"><rect x="1" y="1" width="3.5" height="3.5" rx="0.8"/><rect x="6.2" y="1" width="3.5" height="3.5" rx="0.8"/><rect x="11.4" y="1" width="3.5" height="3.5" rx="0.8"/><rect x="1" y="6.2" width="3.5" height="3.5" rx="0.8"/><rect x="6.2" y="6.2" width="3.5" height="3.5" rx="0.8"/><rect x="11.4" y="6.2" width="3.5" height="3.5" rx="0.8"/><rect x="1" y="11.4" width="3.5" height="3.5" rx="0.8"/><rect x="6.2" y="11.4" width="3.5" height="3.5" rx="0.8"/><rect x="11.4" y="11.4" width="3.5" height="3.5" rx="0.8"/></svg>
  ) },
  { id: 'list', label: 'List', icon: (
    <svg viewBox="0 0 16 16"><rect x="1" y="1.5" width="14" height="2" rx="1"/><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="1" y="12.5" width="14" height="2" rx="1"/></svg>
  ) },
  { id: 'details', label: 'Details', icon: (
    <svg viewBox="0 0 16 16"><rect x="1" y="1.5" width="4" height="2" rx="0.7"/><rect x="6.5" y="1.5" width="8.5" height="2" rx="0.7"/><rect x="1" y="7" width="4" height="2" rx="0.7"/><rect x="6.5" y="7" width="8.5" height="2" rx="0.7"/><rect x="1" y="12.5" width="4" height="2" rx="0.7"/><rect x="6.5" y="12.5" width="8.5" height="2" rx="0.7"/></svg>
  ) }
];

export default function ViewToolbar({ view, onChange }) {
  return (
    <div className="view-toolbar">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          className={`view-btn ${view === v.id ? 'active' : ''}`}
          title={v.label}
          onClick={() => onChange(v.id)}
        >
          {v.icon}
        </button>
      ))}
    </div>
  );
}
