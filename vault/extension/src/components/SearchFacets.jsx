import React from 'react';

export default function SearchFacets({ facets, onPickTag, onPickSource, itemCount, query }) {
  const tags = facets.tags || [];
  const sources = facets.sources || [];

  return (
    <div className="search-facets">
      <div className="facet-row">
        <span className="facet-label">Tags</span>
        {tags.length > 0 ? (
          <div className="facet-chips">
            {tags.map((t) => (
              <button key={t.name} className="facet-chip" onClick={() => onPickTag(t.name)}>
                #{t.name} <span className="facet-chip-count">{t.count}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="facet-hint">No matching tags</span>
        )}
      </div>
      <div className="facet-row">
        <span className="facet-label">Sources</span>
        {sources.length > 0 ? (
          <div className="facet-chips">
            {sources.map((s) => (
              <button key={s.source} className="facet-chip" onClick={() => onPickSource(s.source)}>
                {s.source} <span className="facet-chip-count">{s.count}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="facet-hint">No matching sources</span>
        )}
      </div>
      <div className="facet-row">
        <span className="facet-label">Bookmarks</span>
        <span className="facet-hint">
          {itemCount > 0 ? `${itemCount} matching "${query}" below` : `No bookmarks matching "${query}"`}
        </span>
      </div>
    </div>
  );
}
