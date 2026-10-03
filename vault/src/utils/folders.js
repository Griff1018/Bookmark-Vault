// Folders arrive from the database as a flat list: { id, name, parent_id, count }.
// These helpers turn that into a tree (sidebar) or an indented flat list (dropdowns/menus).

export function buildTree(flat) {
  const byParent = new Map();
  for (const f of flat) {
    const key = f.parent_id == null ? 'root' : f.parent_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(f);
  }
  const make = (key) => (byParent.get(key) || []).map((f) => ({ ...f, children: make(f.id) }));
  return make('root');
}

export function flattenTree(tree, depth = 0, out = []) {
  for (const node of tree) {
    out.push({ ...node, depth });
    flattenTree(node.children, depth + 1, out);
  }
  return out;
}

// Returns the ancestor chain from root to `folderId` (inclusive), using the
// flat folder list (each item has id/name/parent_id). Used for the
// breadcrumb bar — e.g. [{id:1,name:'Reference'}, {id:2,name:'Body ref'}].
export function folderPath(flatFolders, folderId) {
  if (folderId == null) return [];
  const byId = new Map(flatFolders.map((f) => [f.id, f]));
  const path = [];
  let cur = byId.get(folderId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parent_id == null ? null : byId.get(cur.parent_id);
  }
  return path;
}
