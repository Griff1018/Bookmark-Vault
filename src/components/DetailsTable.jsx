import React from 'react';
import { itemDragProps } from '../utils/dnd.js';

function thumbSrc(item) {
  if (!item.thumbnail_path) return null;
  return `vault-thumb://${encodeURIComponent(item.thumbnail_path)}`;
}

function faviconSrc(item) {
  if (!item.favicon_path) return null;
  return `vault-thumb://${encodeURIComponent(item.favicon_path)}`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DetailsTable({ items, onOpen, onContextMenu, sort, onSort, shouldBlur, selectedIds, onSelect }) {
  const columns = [
    { key: 'title', label: 'Name' },
    { key: null, label: 'Tags' },
    { key: null, label: 'Source' },
    { key: 'newest', label: 'Date added' }
  ];

  return (
    <table className="details-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.label}
              onClick={() => col.key && onSort(col.key === 'title' ? 'title' : col.key)}
              className={col.key && sort === col.key ? 'sorted' : ''}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            className={`${shouldBlur && shouldBlur(item) ? 'blurred-thumb' : ''} ${selectedIds && selectedIds.has(item.id) ? 'selected' : ''}`}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                onSelect && onSelect(item, e);
              } else {
                onOpen(item);
              }
            }}
            onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
            {...itemDragProps(item)}
          >
            <td className="name-cell">
              <div className="row-thumb">
                {thumbSrc(item) ? <img src={thumbSrc(item)} alt="" /> : faviconSrc(item) ? <img src={faviconSrc(item)} alt="" className="row-favicon-fallback" /> : <div className="row-thumb-empty" />}
              </div>
              <span className="row-title">{item.title || item.url}</span>
              {item.favorite ? <span className="row-fav">♥</span> : null}
            </td>
            <td className="tags-cell">
              {item.tags.length ? item.tags.map((t) => <span key={t} className="tag-pill">{t}</span>) : <span className="dim">—</span>}
            </td>
            <td className="dim source-cell">
              {faviconSrc(item) && <img className="source-icon" src={faviconSrc(item)} alt="" />}
              {item.source}
            </td>
            <td className="dim">{formatDate(item.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
