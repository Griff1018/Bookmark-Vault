# Vault

A local-first bookmark manager: an Electron desktop app that stores saved links
and thumbnails in a SQLite database, plus a browser extension that adds
"Bookmark This Page / Image / Link" to your right-click menu.

Everything stays on your machine — the extension only ever talks to
`127.0.0.1:47563`, a server the desktop app starts for itself. No data goes
anywhere else.

## How it fits together

```
Browser (right-click) --POST--> 127.0.0.1:47563 (in the Electron app)
                                        |
                                        v
                              better-sqlite3 (vault.db)
                                        |
                                        v
                          React UI (grid, search, tags, detail view)
```

## 1. Run the desktop app

```bash
cd vault
npm install
npm run dev
```

`npm run dev` starts Vite (renderer) and Electron together. The app window
opens, and the bridge server starts listening on `127.0.0.1:47563`.

## 3. Build a real, double-clickable app

```bash
npm run dist
```

This builds the renderer, then runs `electron-builder`, which produces two
things in a new `release/` folder on Windows:

- **`Vault Setup <version>.exe`** — a normal installer (Start Menu shortcut,
  uninstaller, install location picker)
- **`Vault <version>.exe`** (portable) — a single standalone `.exe` you can
  run directly from anywhere, no installation needed

Either one is a real app from here on — double-click it, and it runs
independently of this project folder or any terminal.

A few notes:

- The first `npm run dist` will download Electron's prebuilt binaries for
  your platform (few hundred MB) — this only happens once and is cached.
- `better-sqlite3` is a native module. The build config already unpacks it
  from the app's asar archive (`asarUnpack: ["**/*.node"]`) so it loads
  correctly once packaged — this is easy to miss and causes a blank-window
  crash on launch if left out, so don't remove that line.
- There's no custom app icon yet — it'll ship with Electron's default one.
  To add your own: create `build/icon.ico` (Windows) and reference it via
  `"win": { "icon": "build/icon.ico" }` in `package.json`'s `build` block.

## 2. Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `vault/extension` folder

Right-click any page, image, or link and choose one of the **Bookmark This…**
options. If the Vault app is running, it saves instantly and you'll see a
notification; if not, the extension tells you the app isn't running.

### Optional: pairing token

If you want to require a shared secret before the bridge accepts a save
(useful if other local apps might guess the port), right-click the extension
icon → **Options**, set a token, and pass the same value into
`startServer({ token: '...' })` in `electron/main.js`. Left blank, the bridge
accepts any local request — reasonable for a single-user machine.

## What's implemented

- **Source/tag sidebar lists are folder-scoped**: while browsing a folder,
  Sources and Tags only show what actually exists inside that folder (e.g.
  browsing "nsfw" won't list `en.wikipedia.org` as a source if nothing from
  there is actually in that folder). Selecting a source/tag still combines
  with the active folder as a sub-selection, as before.
- **Subfolder tiles respect active source/tag filters**: if you've filtered
  by a source while browsing, only subfolders that actually contain a
  matching item (anywhere in their subtree) show as tiles — no more
  dead-end tiles into folders with nothing relevant inside.
- **"+ Folder" asks where**: if you're inside a real folder when you create
  a new one, it asks "Add inside *(current folder)*" vs "Add to Main
  Directory" instead of guessing.
- **Search facets never vanish**: the Tags/Sources/Bookmarks strip above
  search results always stays visible while searching, showing "No
  matching tags" etc. instead of the whole bar disappearing when a search
  happens to match nothing in one category. Also fixed a race condition
  where typing quickly could let an older, slower response overwrite a
  newer one (visible as results flickering).
- **Favicon shown on every card**: `{icon} domain` next to the source name
  in every view (grid, list, details, and the detail panel) — not just as a
  fallback thumbnail. A favicon is fetched and cached once per domain
  automatically and reused forever after. Classic `favicon.ico` files
  (still the most common format — most sites have no modern PNG `<link
  rel="icon">` tag) are converted to a real PNG with a small pure-JS
  decoder (`decode-ico`, zero native dependencies) and a from-scratch PNG
  encoder, since Electron's image decoder can't read raw ICO directly —
  this was the actual cause of favicons not showing before.
- **Scroll fixed**: the main panel now properly scrolls when content
  exceeds the window instead of silently growing past it with no way to
  reach the bottom (a CSS grid/flexbox sizing issue).

- **Storage**: SQLite (`better-sqlite3`) with items, tags, nested folders,
  and a cached favicon per domain.
- **Search that actually works**: type anything in the sidebar search box
  and it matches title, notes, URL, source, *and tags* — all as plain
  substring matching, immune to special characters. (Earlier versions used
  SQLite's FTS5 `MATCH` operator directly on raw input, which treats `(`,
  `)`, `"`, `:`, `-` as query syntax rather than literal text — any search
  containing a parenthesis, extremely common in tag-heavy titles like
  `aak (arknights)`, threw a syntax error. That's gone now.) While
  searching, a **facets strip** above the results shows matching **tags**
  and **sources** as clickable chips, alongside the matching bookmarks
  themselves.
- **Folders, as real navigation**: a breadcrumb bar (Home / Reference / Body
  reference) at the top of the main panel shows where you are; subfolders
  of whatever you're viewing appear as clickable tiles right in the main
  panel (not just the sidebar tree); a **"+ Folder"** button in the toolbar
  creates a new folder inside wherever you're currently browsing, not just
  at the top level. Drag a bookmark onto a sidebar folder row or an in-grid
  folder tile to file it there; drag a folder onto another to nest it
  (blocked if that would create a cycle). Right-click a folder (sidebar or
  tile) for New subfolder / Rename / Delete — deleting one never deletes
  your bookmarks, its contents move up to the parent automatically.
- **Thumbnails**: downloaded to the app's local userData folder the moment a
  bookmark comes in, so your library still works if the source site goes
  down or removes the image. If no real thumbnail can be found (or its
  download fails validation — see below), the app falls back to the site's
  **favicon**, cached once per domain and reused for every future bookmark
  from that domain rather than re-downloaded each time. Every downloaded
  image (thumbnail or favicon) is verified to actually decode as an image
  before being saved — a wrong or broken URL just falls through to the next
  option instead of corrupting your library with an unopenable file.
  Anything over a configurable size limit (**⚙ button** in the sidebar
  footer, default 300 KB) is automatically re-encoded as JPEG at
  progressively lower quality — and, if that alone isn't enough,
  progressively smaller dimensions — until it fits, using Electron's
  built-in image encoder (no extra native dependency). Set the limit to 0
  to disable compression. This only applies going forward; existing
  thumbnails aren't touched retroactively.
- **Explorer-style views**: a toolbar (top right, next to sort) switches
  between Large icons, Icons, List, and Details — same idea as Windows
  Explorer's view modes. Your choice is remembered between launches.
- **Right-click context menu** on any item (in every view): Open details,
  Open link in browser, toggle Favorite, a Rating submenu, a Tags submenu
  (checkbox-toggle existing tags or type a new one inline), a **Move to
  folder** submenu, **Open link in Incognito**, Copy link, and Delete.
- **Hover quick-actions**: a small heart button appears on hover in the grid
  and list views for one-click favoriting without opening any menu.
- **Detail panel**: still available (click an item) for full editing —
  title, notes, tags, star rating, favorite, delete.
- **Bookmark every open tab at once**: click the extension's toolbar icon,
  or right-click any page and choose **"📑 Bookmark All Tabs → 'Gooner
  Collect'"**, to save every normal http(s) tab in the current window in
  one go. They all land in a top-level folder named "Gooner Collect" —
  created the first time, reused (not duplicated) every time after. One
  summary notification at the end rather than one per tab.
- **Extension**: context menu for page/image/link, with automatic `og:image`
  detection for plain page bookmarks, plus a **"Bookmark to folder"**
  submenu that mirrors your app's folder tree live — pick a folder (or
  "(No folder)") right from the browser, or create a new top-level folder
  on the spot with **"+ New folder…"**. The submenu refreshes from the app
  each time the folder list actually changes — details below.
  A **video/audio right-click also works correctly** — right-clicking a
  `<video>` element and using "Bookmark to folder" pulls the video's poster
  frame as the thumbnail instead of mistakenly trying to save the raw video
  file itself, with a guard against players (rule34.xxx included) that
  overwrite the `poster` attribute with the raw video file's own URL once
  playback starts. If no usable thumbnail can be found at all, the
  extension falls back to the page's favicon.
- **Open in Incognito** — available in the **app's** right-click menu
  ("Open link in Incognito"). The app auto-detects an installed browser
  (Chrome, Edge, Brave, Firefox); if it picks the wrong one or finds none,
  set an explicit path in **Settings** (⚙ in the sidebar footer). (Not in
  the browser extension — removed after adding it, since it needed Chrome's
  per-extension "Allow in Incognito" consent toggle to work at all, which
  made it more friction than it was worth there; the app-side version has
  no such requirement.)

### Keeping the extension's folder list in sync

Chrome's `contextMenus` API has no "about to open" hook — despite some
docs/blog posts suggesting otherwise, `chrome.contextMenus.onShown` is a
Firefox-only API and doesn't exist in Chrome. So the folder submenu can't
refresh itself right as you open it; instead it refreshes three ways:
- automatically every 30 seconds while the browser is open
- automatically whenever you switch tabs
- immediately if you click **"🔄 Refresh folder list"** at the top of the
  "Bookmark to folder" submenu (useful right after creating a folder in the
  app if you don't want to wait ~30s or switch tabs)

### Debugging the extension

Every step (folder fetch, menu clicks, save payloads, bridge responses) is
logged with a `[Vault]` prefix. To see it: go to `chrome://extensions`,
find Vault Bookmarker, click **"service worker"** (or "Inspect views") to
open its DevTools, and check the Console tab. The app side logs the same
way (`[Vault:server]` prefix) to the terminal you ran `npm run dev` in —
useful for checking exactly why a folder_id was or wasn't applied, whether
a thumbnail download succeeded, etc.

## Where things live on disk

- Database: Electron `userData` path (e.g. on macOS
  `~/Library/Application Support/vault/vault.db`; on Windows
  `%APPDATA%/vault/vault.db`; on Linux `~/.config/vault/vault.db`)
- Thumbnails: `<userData>/thumbnails/`

If you're upgrading from a version without folders, nothing needs to be
done manually — the app adds the `folder_id` column and `folders` table to
your existing database automatically the first time it starts, and every
bookmark you already saved just starts out Unsorted.

## Natural next steps

- Bulk import/export (JSON) for backup or migrating machines
- Duplicate-URL detection when saving
- Drag-select multi-tagging in the grid
- A Firefox build of the extension (manifest already avoids Chrome-only APIs
  apart from `chrome.*` namespacing — swap for the `browser.*` polyfill)
