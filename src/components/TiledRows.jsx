import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { itemDragProps } from '../utils/dnd.js';

const GAP = 8;          // gap between tiles (matches .tile-row in CSS)
const PAD = 18;         // horizontal padding of a tile (border + padding, both sides)
const CAPTION_H = 62;   // vertical space the caption needs under the image
const DEFAULT_RATIO = 1.4;

// Natural sizes survive view switches so rows don't re-flow every time.
const sizeCache = new Map(); // item id -> { w, h }

function thumbSrc(item) {
  if (!item.thumbnail_path) return null;
  return `vault-thumb://${encodeURIComponent(item.thumbnail_path)}`;
}

function faviconSrc(item) {
  if (!item.favicon_path) return null;
  return `vault-thumb://${encodeURIComponent(item.favicon_path)}`;
}

function shortDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

// Greedy justified layout: fill each row until it reaches the container
// width, then scale the row's height so it ends flush with the right edge.
// The last row keeps the target height rather than stretching.
function layoutRows(items, ratioOf, width, targetH) {
  const rows = [];
  let cur = [];
  let sum = 0;
  const flush = (last) => {
    if (cur.length === 0) return;
    const gaps = GAP * (cur.length - 1) + PAD * cur.length;
    let h = (width - gaps) / sum;
    if (last && h > targetH) h = targetH;
    rows.push({ h, items: cur });
    cur = [];
    sum = 0;
  };
  for (const item of items) {
    const r = ratioOf(item);
    cur.push({ item, r });
    sum += r;
    const gaps = GAP * (cur.length - 1) + PAD * cur.length;
    if (sum * targetH + gaps >= width) flush(false);
  }
  flush(true);
  return rows;
}

export default function TiledRows({
  items, rowHeight, onOpen, onContextMenu, onToggleFavorite,
  shouldBlur, selectedIds, focusedIndex, onItemClick
}) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [, setTick] = useState(0);
  const pending = useRef(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Batch image-load size reports into one re-layout per frame.
  const reportSize = useRef((id, w, h) => {
    const prev = sizeCache.get(id);
    if (prev && prev.w === w && prev.h === h) return;
    sizeCache.set(id, { w, h });
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => { pending.current = false; setTick((t) => t + 1); });
  }).current;

  useEffect(() => () => { pending.current = false; }, []);

  const ratioOf = (item) => {
    const s = sizeCache.get(item.id);
    if (s && s.h > 0) return s.w / s.h;
    return item.thumbnail_path ? DEFAULT_RATIO : 1.2;
  };

  const rows = width > 0 ? layoutRows(items, ratioOf, width, rowHeight) : [];
  let index = 0;

  return (
    <div className="tiles" ref={wrapRef}>
      {rows.map((row, ri) => (
        <div className="tile-row" key={ri}>
          {row.items.map(({ item, r }) => {
            const idx = index++;
            const size = sizeCache.get(item.id);
            const imgW = Math.floor(r * row.h);
            const imgH = Math.floor(row.h);
            return (
              <div
                key={item.id}
                className={`tile ${shouldBlur(item) ? 'blurred-thumb' : ''} ${selectedIds && selectedIds.has(item.id) ? 'selected' : ''} ${focusedIndex === idx ? 'focused' : ''}`}
                style={{ width: imgW + PAD }}
                onClick={(e) => onItemClick(item, e)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
                {...itemDragProps(item)}
              >
                <div className="tile-img" style={{ width: imgW, height: imgH }}>
                  {thumbSrc(item) ? (
                    <img
                      src={thumbSrc(item)}
                      alt=""
                      loading="lazy"
                      onLoad={(e) => reportSize(item.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                    />
                  ) : (
                    <div className="no-thumb">
                      {faviconSrc(item) && <img src={faviconSrc(item)} alt="" />}
                      <span>{faviconSrc(item) ? item.source : 'No thumbnail'}</span>
                    </div>
                  )}
                  <button
                    className={`card-fav-btn ${item.favorite ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
                    title="Toggle favorite"
                  >♥</button>
                </div>
                <div className="tile-cap" style={{ height: CAPTION_H - 7 }}>
                  <div className="tile-dim">{size ? `${size.w} × ${size.h}` : '— × —'}</div>
                  <div className="tile-title" title={item.title || item.url}>{item.title || item.url}</div>
                  <div className="tile-sub">{item.source}{item.created_at ? ` · ${shortDate(item.created_at)}` : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
