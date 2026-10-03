const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

const userData = app.getPath('userData');
const thumbsDir = path.join(userData, 'thumbnails');
const faviconsDir = path.join(userData, 'favicons');
fs.mkdirSync(thumbsDir, { recursive: true });
fs.mkdirSync(faviconsDir, { recursive: true });

const db = new Database(path.join(userData, 'vault.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  source TEXT,
  thumbnail_path TEXT,
  notes TEXT,
  rating INTEGER DEFAULT 0,
  favorite INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (item_id, tag_id),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at);
`);

// ---- Folders (nested) ----
db.exec(`
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER,
  created_at INTEGER NOT NULL
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// One cached favicon per domain, reused across every bookmark from that
// domain instead of downloading/storing a copy per item.
db.exec(`
CREATE TABLE IF NOT EXISTS favicons (
  domain TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

// Existing databases don't have items.folder_id yet — add it in place.
const itemColumns = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
if (!itemColumns.includes('folder_id')) {
  db.exec('ALTER TABLE items ADD COLUMN folder_id INTEGER');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_items_folder ON items(folder_id)');

function getOrCreateTag(name) {
  const clean = name.trim().toLowerCase();
  if (!clean) return null;
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(clean);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO tags (name) VALUES (?)').run(clean).lastInsertRowid;
}

function setTags(itemId, tagNames) {
  db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(itemId);
  for (const name of tagNames || []) {
    const tagId = getOrCreateTag(name);
    if (tagId) {
      db.prepare('INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)').run(itemId, tagId);
    }
  }
}

function tagsForItem(itemId) {
  return db.prepare(`
    SELECT t.name FROM tags t
    JOIN item_tags it ON it.tag_id = t.id
    WHERE it.item_id = ?
    ORDER BY t.name
  `).all(itemId).map(r => r.name);
}

function faviconPathForDomain(domain) {
  if (!domain) return null;
  const row = db.prepare('SELECT path FROM favicons WHERE domain = ?').get(domain);
  if (row && fs.existsSync(row.path)) return row.path;
  return null;
}

function hydrate(item) {
  if (!item) return item;
  return {
    ...item,
    tags: tagsForItem(item.id),
    favorite: !!item.favorite,
    favicon_path: faviconPathForDomain(item.source)
  };
}

// Plain substring search across every searchable field, including tags
// (which a raw SQL/FTS query can't reach without a join). Deliberately NOT
// using SQLite's FTS5 MATCH operator here: FTS5 treats characters like
// ( ) " : - as query syntax, not literal text, and bookmark titles from
// tag-heavy sites are full of parentheses (e.g. "aak (arknights)") — a
// bare MATCH query on raw user input throws a syntax error on exactly the
// kind of titles this app deals with constantly. A plain substring scan
// has no query syntax to break on, at the cost of no fancy ranking — fine
// at the scale a personal bookmark collection lives at.
function matchesQuery(item, needle) {
  const haystack = [
    item.title, item.notes, item.source, item.url, (item.tags || []).join(' ')
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

const queries = {
  thumbsDir,
  faviconsDir,

  insertItem(item) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO items (id, url, title, source, thumbnail_path, notes, rating, favorite, folder_id, created_at, updated_at)
      VALUES (@id, @url, @title, @source, @thumbnail_path, @notes, @rating, @favorite, @folder_id, @created_at, @updated_at)
    `).run({ folder_id: null, ...item, created_at: now, updated_at: now });
    setTags(item.id, item.tags);
    return hydrate(db.prepare('SELECT * FROM items WHERE id = ?').get(item.id));
  },

  updateItem(id, patch) {
    const current = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!current) return null;
    const next = { ...current, ...patch, updated_at: Date.now() };
    db.prepare(`
      UPDATE items SET title=@title, source=@source, notes=@notes, rating=@rating,
        favorite=@favorite, thumbnail_path=@thumbnail_path, folder_id=@folder_id,
        updated_at=@updated_at
      WHERE id=@id
    `).run(next);
    if (patch.tags) setTags(id, patch.tags);
    return hydrate(db.prepare('SELECT * FROM items WHERE id = ?').get(id));
  },

  deleteItem(id) {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    // Never delete a file that lives in the shared favicon cache — other
    // items may still be pointing at that same physical file.
    const isShared = item && item.thumbnail_path && item.thumbnail_path.startsWith(faviconsDir);
    if (item && item.thumbnail_path && !isShared && fs.existsSync(item.thumbnail_path)) {
      fs.unlinkSync(item.thumbnail_path);
    }
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return true;
  },

  listItems({ query, tag, source, folderId, favoritesOnly, sort } = {}) {
    let rows = db.prepare('SELECT * FROM items').all();
    if (source) rows = rows.filter(r => r.source === source);
    if (folderId === 'none') rows = rows.filter(r => r.folder_id == null);
    else if (folderId != null) rows = rows.filter(r => r.folder_id === folderId);
    if (favoritesOnly) rows = rows.filter(r => r.favorite);
    let hydrated = rows.map(hydrate);
    if (tag) hydrated = hydrated.filter(r => r.tags.includes(tag.toLowerCase()));
    if (query && query.trim()) {
      const needle = query.trim().toLowerCase();
      hydrated = hydrated.filter((item) => matchesQuery(item, needle));
    }
    const sorters = {
      newest: (a, b) => b.created_at - a.created_at,
      oldest: (a, b) => a.created_at - b.created_at,
      rating: (a, b) => b.rating - a.rating,
      title: (a, b) => (a.title || '').localeCompare(b.title || '')
    };
    hydrated.sort(sorters[sort] || sorters.newest);
    return hydrated;
  },

  // Returns matching tags and sources (not just items) for the sectioned
  // search UI — e.g. typing "rule34" should surface the #rule34 tag and
  // the rule34.xxx source as clickable results, not just bookmarks whose
  // title happens to contain the word.
  searchFacets(query, folderId) {
    const needle = (query || '').trim().toLowerCase();
    if (!needle) return { tags: [], sources: [] };
    const tags = this.allTags(folderId).filter((t) => t.name.toLowerCase().includes(needle));
    const sources = this.allSources(folderId).filter((s) => s.source.toLowerCase().includes(needle));
    return { tags, sources };
  },

  // folderId: undefined/null = unscoped (every tag in the library, including
  // zero-count ones — original global behavior). 'none' = only tags used by
  // Unsorted items. A number = only tags used by items in that folder.
  allTags(folderId) {
    if (folderId == null) {
      return db.prepare(`
        SELECT t.name, COUNT(it.item_id) as count
        FROM tags t LEFT JOIN item_tags it ON it.tag_id = t.id
        GROUP BY t.id ORDER BY count DESC, t.name ASC
      `).all();
    }
    const folderClause = folderId === 'none' ? 'i.folder_id IS NULL' : 'i.folder_id = ?';
    const params = folderId === 'none' ? [] : [folderId];
    return db.prepare(`
      SELECT t.name, COUNT(DISTINCT it.item_id) as count
      FROM tags t
      JOIN item_tags it ON it.tag_id = t.id
      JOIN items i ON i.id = it.item_id
      WHERE ${folderClause}
      GROUP BY t.id ORDER BY count DESC, t.name ASC
    `).all(...params);
  },

  allSources(folderId) {
    let where = "source IS NOT NULL AND source != ''";
    const params = [];
    if (folderId === 'none') {
      where += ' AND folder_id IS NULL';
    } else if (folderId != null) {
      where += ' AND folder_id = ?';
      params.push(folderId);
    }
    return db.prepare(`
      SELECT source, COUNT(*) as count FROM items
      WHERE ${where}
      GROUP BY source ORDER BY count DESC
    `).all(...params);
  },

  // Returns the set of folder ids that contain — directly, or in a nested
  // subfolder — at least one item matching the given source/tag filter.
  // Used so that while a source/tag filter is active, the subfolder tiles
  // shown only include folders actually worth navigating into (e.g.
  // selecting "en.wikipedia.org" while browsing shouldn't show a sibling
  // "nsfw" folder tile that contains no wikipedia bookmarks at all).
  // Returns null when neither filter is given, signaling "no filtering
  // needed — show every subfolder as normal".
  matchingFolderIds({ source, tag } = {}) {
    if (!source && !tag) return null;

    let itemRows;
    if (tag) {
      const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(tag.toLowerCase());
      if (!tagRow) return new Set();
      itemRows = source
        ? db.prepare('SELECT i.folder_id FROM items i JOIN item_tags it ON it.item_id = i.id WHERE it.tag_id = ? AND i.source = ?').all(tagRow.id, source)
        : db.prepare('SELECT i.folder_id FROM items i JOIN item_tags it ON it.item_id = i.id WHERE it.tag_id = ?').all(tagRow.id);
    } else {
      itemRows = db.prepare('SELECT folder_id FROM items WHERE source = ?').all(source);
    }

    const parentOf = new Map(db.prepare('SELECT id, parent_id FROM folders').all().map((f) => [f.id, f.parent_id]));
    const matched = new Set();
    for (const row of itemRows) {
      let cur = row.folder_id;
      while (cur != null && !matched.has(cur)) {
        matched.add(cur);
        cur = parentOf.has(cur) ? parentOf.get(cur) : null;
      }
    }
    return matched;
  },

  // ---- Folders ----
  allFolders() {
    return db.prepare(`
      SELECT f.id, f.name, f.parent_id, COUNT(i.id) AS count
      FROM folders f LEFT JOIN items i ON i.folder_id = f.id
      GROUP BY f.id ORDER BY f.name COLLATE NOCASE
    `).all();
  },

  folderExists(id) {
    return !!db.prepare('SELECT 1 FROM folders WHERE id = ?').get(id);
  },

  createFolder(name, parentId = null) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const info = db.prepare('INSERT INTO folders (name, parent_id, created_at) VALUES (?, ?, ?)')
      .run(clean, parentId, Date.now());
    return db.prepare('SELECT id, name, parent_id FROM folders WHERE id = ?').get(info.lastInsertRowid);
  },

  renameFolder(id, name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(clean, id);
    return true;
  },

  // Refuses to move a folder into itself or one of its own descendants.
  moveFolder(id, parentId = null) {
    let cur = parentId;
    while (cur != null) {
      if (cur === id) return false;
      const row = db.prepare('SELECT parent_id FROM folders WHERE id = ?').get(cur);
      cur = row ? row.parent_id : null;
    }
    db.prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(parentId, id);
    return true;
  },

  // Deleting a folder never deletes bookmarks: its items and subfolders
  // move up to the deleted folder's parent (or to Unsorted / top level).
  deleteFolder(id) {
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
    if (!folder) return false;
    db.transaction(() => {
      db.prepare('UPDATE folders SET parent_id = ? WHERE parent_id = ?').run(folder.parent_id, id);
      db.prepare('UPDATE items SET folder_id = ? WHERE folder_id = ?').run(folder.parent_id, id);
      db.prepare('DELETE FROM folders WHERE id = ?').run(id);
    })();
    return true;
  },

  // ---- Favicon cache (one file per domain, reused across items) ----
  getFaviconPath(domain) {
    return faviconPathForDomain(domain); // null if uncached or the cached file went missing
  },

  setFaviconPath(domain, filePath) {
    if (!domain) return false;
    db.prepare(`
      INSERT INTO favicons (domain, path, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET path = excluded.path, updated_at = excluded.updated_at
    `).run(domain, filePath, Date.now());
    return true;
  },

  // ---- Settings (key/value) ----
  getSetting(key, fallback) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  },

  setSetting(key, value) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
    return true;
  },

  stats() {
    const total = db.prepare('SELECT COUNT(*) c FROM items').get().c;
    const favorites = db.prepare('SELECT COUNT(*) c FROM items WHERE favorite = 1').get().c;
    const unsorted = db.prepare('SELECT COUNT(*) c FROM items WHERE folder_id IS NULL').get().c;
    return { total, favorites, unsorted };
  }
};

module.exports = queries;
