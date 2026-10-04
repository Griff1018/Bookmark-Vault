import React from 'react';
import ViewToolbar from './ViewToolbar.jsx';
import DetailsTable from './DetailsTable.jsx';
import TiledRows from './TiledRows.jsx';
import FolderTiles from './FolderTiles.jsx';
import Breadcrumb from './Breadcrumb.jsx';
import SearchFacets from './SearchFacets.jsx';
import { itemDragProps } from '../utils/dnd.js';

function thumbSrc(item) {
  if (!item.thumbnail_path) return null;
  return `vault-thumb://${encodeURIComponent(item.thumbnail_path)}`;
}

function faviconSrc(item) {
  if (!item.favicon_path) return null;
  return `vault-thumb://${encodeURIComponent(item.favicon_path)}`;
}

export default function Gallery({
  items, onOpen, onContextMenu, onToggleFavorite,
  sort, onSort, title, view, onViewChange,
  breadcrumbPath, onBreadcrumbNavigate,
  subfolders, onNavigateFolder, onFolderContextMenu,
  dragOverFolderId, onDragOverFolder, onDragLeaveFolder, onDropOnFolder,
  onCreateFolderHere, showFolderUi,
  searchQuery, searchFacets, onPickTag, onPickSource,
  blurredFolderIds, activeFolder,
  cardSize, onCardSizeChange,
  selectedIds, onSelectItem,
  focusedIndex
}) {
  const gridClass = view === 'small' ? 'grid grid-small' : 'grid';
  const isSearching = searchQuery && searchQuery.trim().length > 0;
  const isAllItems = !activeFolder && !isSearching;

  function shouldBlur(item) {
    return isAllItems && item.folder_id && blurredFolderIds && blurredFolderIds.has(item.folder_id);
  }

  function handleItemClick(item, e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onSelectItem && onSelectItem(item, e);
    } else {
      onOpen(item);
    }
  }

  return (
    <div className="main">
      <div className="topbar">
        <div>
          {showFolderUi && <Breadcrumb path={breadcrumbPath} onNavigate={onBreadcrumbNavigate} />}
          <h2>
            {title}
            <span className="subcount">{items.length} item{items.length === 1 ? '' : 's'}</span>
          </h2>
        </div>
        <div className="topbar-controls">
          {showFolderUi && (
            <button className="btn new-folder-btn" onClick={(e) => onCreateFolderHere(e)} title="New folder here">
              + Folder
            </button>
          )}
          <ViewToolbar view={view} onChange={onViewChange} />
          <select className="sort-select" value={sort} onChange={(e) => onSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
          {(view === 'large' || view === 'small' || view === 'rows') && (
            <div className="size-slider" title={`Card size: ${cardSize}px`}>
              <span className="size-slider-icon size-slider-icon--small">▪</span>
              <input
                type="range"
                min="120"
                max="400"
                step="10"
                value={cardSize}
                onChange={(e) => onCardSizeChange(Number(e.target.value))}
              />
              <span className="size-slider-icon size-slider-icon--large">⬛</span>
            </div>
          )}
        </div>
      </div>

      <div className="gallery">
        {isSearching && searchFacets && (
          <SearchFacets
            facets={searchFacets}
            onPickTag={onPickTag}
            onPickSource={onPickSource}
            itemCount={items.length}
            query={searchQuery}
          />
        )}

        {showFolderUi && subfolders.length > 0 && (
          <FolderTiles
            folders={subfolders}
            onNavigate={onNavigateFolder}
            onContextMenu={onFolderContextMenu}
            onDropItem={onDropOnFolder}
            dragOverId={dragOverFolderId}
            onDragOver={onDragOverFolder}
            onDragLeave={onDragLeaveFolder}
          />
        )}

        {items.length === 0 && subfolders.length === 0 ? (
          <div className="empty-state">
            <div className="headline">Nothing here yet</div>
            <div>Right-click a page in your browser and choose "Bookmark This Page" to send it here.</div>
            <div style={{ marginTop: 6 }}>Bridge: <code>http://127.0.0.1:47564</code></div>
          </div>
        ) : items.length === 0 ? null : view === 'details' ? (
          <DetailsTable
            items={items}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            sort={sort}
            onSort={onSort}
            shouldBlur={shouldBlur}
            selectedIds={selectedIds}
            onSelect={onSelectItem}
          />
        ) : view === 'rows' ? (
          <TiledRows
            items={items}
            rowHeight={cardSize}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            onToggleFavorite={onToggleFavorite}
            shouldBlur={shouldBlur}
            selectedIds={selectedIds}
            focusedIndex={focusedIndex}
            onItemClick={handleItemClick}
          />
        ) : view === 'list' ? (
          <div className="list-view">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`list-row ${shouldBlur(item) ? 'blurred-thumb' : ''} ${selectedIds && selectedIds.has(item.id) ? 'selected' : ''} ${focusedIndex === idx ? 'focused' : ''}`}
                onClick={(e) => handleItemClick(item, e)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
                {...itemDragProps(item)}
              >
                <div className="row-thumb">
                  {thumbSrc(item) ? <img src={thumbSrc(item)} alt="" /> : faviconSrc(item) ? <img src={faviconSrc(item)} alt="" className="row-favicon-fallback" /> : <div className="row-thumb-empty" />}
                </div>
                <div className="row-body">
                  <div className="row-title">{item.title || item.url}</div>
                  <div className="row-sub">
                    {faviconSrc(item) && <img className="source-icon" src={faviconSrc(item)} alt="" />}
                    <span>{item.source}{item.tags.length ? ` · ${item.tags.join(', ')}` : ''}</span>
                  </div>
                </div>
                <button
                  className={`heart-toggle ${item.favorite ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
                >♥</button>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={gridClass}
            style={
              view === 'small'
                ? { gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` }
                : { columns: `${cardSize}px` }
            }
          >
            {items.map((item, idx) => (
              <div
                key={item.id}
                className={`card ${shouldBlur(item) ? 'blurred-thumb' : ''} ${selectedIds && selectedIds.has(item.id) ? 'selected' : ''} ${focusedIndex === idx ? 'focused' : ''}`}
                onClick={(e) => handleItemClick(item, e)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
                {...itemDragProps(item)}
              >
                <div className="thumb-wrap">
                  {thumbSrc(item) ? (
                    <img src={thumbSrc(item)} loading="lazy" alt="" />
                  ) : faviconSrc(item) ? (
                    <div className="no-thumb favicon-fallback"><img src={faviconSrc(item)} alt="" /><span>{item.source}</span></div>
                  ) : (
                    <div className="no-thumb">No thumbnail</div>
                  )}
                  <button
                    className={`card-fav-btn ${item.favorite ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
                    title="Toggle favorite"
                  >♥</button>
                </div>
                {view !== 'small' && (
                  <div className="meta">
                    <div className="title">{item.title || item.url}</div>
                    <div className="source">
                      {faviconSrc(item) && <img className="source-icon" src={faviconSrc(item)} alt="" />}
                      <span>{item.source}</span>
                    </div>
                    {item.tags.length > 0 && (
                      <div className="card-tags">
                        {item.tags.slice(0, 3).map((t) => (
                          <span key={t} className="card-tag">#{t}</span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="card-tag">+{item.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
