const LOG = '[Vault]';
const BRIDGE_URL = 'http://127.0.0.1:47564/api/bookmark';
const FOLDERS_URL = 'http://127.0.0.1:47564/api/folders';
const SAVE_PARENT_ID = 'vault-save';
const FOLDER_PREFIX = 'vault-folder-';
const NEW_FOLDER_ID = 'vault-new-folder';
const NONE_FOLDER_ID = 'vault-folder-none';
const REFRESH_ITEM_ID = 'vault-refresh-folders';
const BULK_SAVE_ID = 'vault-bulk-save-tabs';
const REFRESH_ALARM = 'vault-refresh-folders-alarm';

// --- Setup: build the menu, then keep the folder submenu fresh ---
//
// Important: Chrome's contextMenus API has NO per-click "about to show"
// hook (chrome.contextMenus.onShown does not exist in Chrome — that's a
// Firefox-only API, easy to confuse since they're both WebExtensions).
// So the folder submenu can only be refreshed by rebuilding it ourselves
// on a timer/trigger, not "just before the menu opens". We do that three
// ways: a periodic alarm, whenever you switch tabs, and on demand via the
// "Refresh folder list" item in the submenu itself.

chrome.runtime.onInstalled.addListener(() => {
  console.log(LOG, 'onInstalled — building menu');
  buildBaseMenu();
  setupRefreshTriggers();
});
chrome.runtime.onStartup.addListener(() => {
  console.log(LOG, 'onStartup — building menu');
  buildBaseMenu();
  setupRefreshTriggers();
});

// Wrapped defensively: if any of these APIs are unavailable for some
// reason, a synchronous throw here would otherwise kill the ENTIRE
// service worker script (including the base menu build), which is a much
// worse failure than just missing the periodic refresh.
function setupRefreshTriggers() {
  try {
    chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 0.5 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === REFRESH_ALARM) {
        console.log(LOG, 'periodic refresh tick');
        rebuildFolderSubmenu();
      }
    });
    console.log(LOG, 'periodic refresh alarm set up (every 30s)');
  } catch (err) {
    console.warn(LOG, 'could not set up periodic refresh alarm:', err.message);
  }

  try {
    chrome.tabs.onActivated.addListener(() => {
      console.log(LOG, 'tab switched — refreshing folder list');
      rebuildFolderSubmenu();
    });
    console.log(LOG, 'tab-switch refresh trigger set up');
  } catch (err) {
    console.warn(LOG, 'could not set up tab-activation refresh trigger:', err.message);
  }
}

function buildBaseMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'vault-page', title: 'Bookmark This Page', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'vault-image', title: 'Bookmark This Image', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'vault-link', title: 'Bookmark This Link', contexts: ['link'] });
    chrome.contextMenus.create({ id: 'vault-sep-1', type: 'separator', contexts: ['page', 'image', 'link', 'video', 'audio'] });
    chrome.contextMenus.create({
      id: SAVE_PARENT_ID,
      title: 'Bookmark to folder',
      contexts: ['page', 'image', 'link', 'video', 'audio']
    });
    chrome.contextMenus.create({ id: 'vault-sep-bulk', type: 'separator', contexts: ['page'] });
    chrome.contextMenus.create({
      id: BULK_SAVE_ID,
      title: '📑 Bookmark All Tabs → "Gooner Collect"',
      contexts: ['page']
    });
    lastFolderSignature = null; // force the next fetch to actually rebuild, even if unchanged
    rebuildFolderSubmenu();
  });
}

// Fetches the current folder tree from the Vault app and rebuilds the
// "Bookmark to folder" submenu to match.
let lastFolderSignature = null;
let refreshInFlight = false;
async function rebuildFolderSubmenu(force = false) {
  if (refreshInFlight) {
    console.log(LOG, 'refresh already in flight, skipping');
    return;
  }
  refreshInFlight = true;
  try {
    let folders = [];
    try {
      const res = await fetch(FOLDERS_URL);
      console.log(LOG, 'GET /api/folders ->', res.status);
      if (!res.ok) {
        console.warn(LOG, 'folders fetch not OK, leaving menu as-is');
        return;
      }
      folders = (await res.json()).folders || [];
      console.log(LOG, 'folders received:', folders.map((f) => `${f.id}:${f.name}`));
    } catch (err) {
      // App not running, or bridge unreachable — leave whatever submenu we already have.
      console.warn(LOG, 'could not reach Vault app at', FOLDERS_URL, '-', err.message);
      return;
    }

    const signature = JSON.stringify(folders.map((f) => [f.id, f.name, f.parent_id]));
    if (!force && signature === lastFolderSignature) {
      console.log(LOG, 'folder list unchanged, skipping menu rebuild');
      return;
    }
    lastFolderSignature = signature;
    console.log(LOG, 'rebuilding folder submenu —', folders.length, 'folder(s)');

    // Rebuild everything under the "Bookmark to folder" parent.
    // chrome.contextMenus has no "remove children of X" call, so the
    // reliable way is: remove all of our items, then recreate the base
    // menu items AND the folder tree together.
    await new Promise((resolve) => {
      chrome.contextMenus.removeAll(() => { buildStaticItems(resolve); });
    });

    function addNode(folder, parentMenuId) {
      const id = FOLDER_PREFIX + folder.id;
      chrome.contextMenus.create({
        id,
        parentId: parentMenuId,
        title: folder.name,
        contexts: ['page', 'image', 'link', 'video', 'audio']
      });
      return id;
    }

    const byParent = new Map();
    for (const f of folders) {
      const key = f.parent_id == null ? 'root' : f.parent_id;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(f);
    }

    chrome.contextMenus.create({
      id: REFRESH_ITEM_ID,
      parentId: SAVE_PARENT_ID,
      title: '🔄 Refresh folder list',
      contexts: ['page', 'image', 'link', 'video', 'audio']
    });
    chrome.contextMenus.create({
      id: 'vault-folder-sep-0',
      parentId: SAVE_PARENT_ID,
      type: 'separator',
      contexts: ['page', 'image', 'link', 'video', 'audio']
    });
    chrome.contextMenus.create({
      id: NONE_FOLDER_ID,
      parentId: SAVE_PARENT_ID,
      title: '(No folder)',
      contexts: ['page', 'image', 'link', 'video', 'audio']
    });
    if (folders.length > 0) {
      chrome.contextMenus.create({
        id: 'vault-folder-sep',
        parentId: SAVE_PARENT_ID,
        type: 'separator',
        contexts: ['page', 'image', 'link', 'video', 'audio']
      });
    }

    function walk(key, parentMenuId) {
      for (const folder of byParent.get(key) || []) {
        const menuId = addNode(folder, parentMenuId);
        walk(folder.id, menuId);
      }
    }
    walk('root', SAVE_PARENT_ID);

    chrome.contextMenus.create({
      id: 'vault-folder-sep-2',
      parentId: SAVE_PARENT_ID,
      type: 'separator',
      contexts: ['page', 'image', 'link', 'video', 'audio']
    });
    chrome.contextMenus.create({
      id: NEW_FOLDER_ID,
      parentId: SAVE_PARENT_ID,
      title: '+ New folder…',
      contexts: ['page', 'image', 'link', 'video', 'audio']
    });
    console.log(LOG, 'folder submenu rebuild complete');
  } finally {
    refreshInFlight = false;
  }
}

// Recreates just the top-level quick-bookmark items + the "Bookmark to
// folder" parent (the folder leaves themselves are added by the caller
// right after this resolves).
function buildStaticItems(done) {
  chrome.contextMenus.create({ id: 'vault-page', title: 'Bookmark This Page', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'vault-image', title: 'Bookmark This Image', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'vault-link', title: 'Bookmark This Link', contexts: ['link'] });
  chrome.contextMenus.create({ id: 'vault-sep-1', type: 'separator', contexts: ['page', 'image', 'link', 'video', 'audio'] });
  chrome.contextMenus.create({ id: SAVE_PARENT_ID, title: 'Bookmark to folder', contexts: ['page', 'image', 'link', 'video', 'audio'] });
  chrome.contextMenus.create({ id: 'vault-sep-bulk', type: 'separator', contexts: ['page'] });
  chrome.contextMenus.create({ id: BULK_SAVE_ID, title: '📑 Bookmark All Tabs → "Gooner Collect"', contexts: ['page'] }, done);
}

// Pulls a real content thumbnail from the page. Every candidate is checked
// against a "does this look like a video file?" guard, because some video
// players (rule34.xxx's included) overwrite a <video poster> attribute with
// the raw media file's own URL once playback starts — so the attribute
// existing isn't enough; its value has to actually look like an image.
function extractPageThumbnail() {
  const looksLikeVideo = (url) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url || '');

  const video = document.querySelector('video[poster]');
  if (video) {
    const poster = video.poster || video.getAttribute('poster');
    if (poster && !looksLikeVideo(poster)) return poster;
  }

  const og = document.querySelector(
    'meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]'
  );
  if (og && og.content && !looksLikeVideo(og.content)) return og.content;

  const linkImg = document.querySelector('link[rel="image_src"]');
  if (linkImg && linkImg.href && !looksLikeVideo(linkImg.href)) return linkImg.href;

  const loadedImgs = Array.from(document.images)
    .filter((img) => img.naturalWidth > 200 && img.naturalHeight > 200)
    .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
  if (loadedImgs.length) return loadedImgs[0].src;

  const lazyAttrs = ['data-src', 'data-original', 'data-lazy-src'];
  for (const img of document.images) {
    for (const attr of lazyAttrs) {
      const val = img.getAttribute(attr);
      if (val && !looksLikeVideo(val)) return val;
    }
  }

  const bgCandidates = Array.from(document.querySelectorAll('div, span, a'))
    .filter((el) => el.offsetWidth > 250 && el.offsetHeight > 250);
  for (const el of bgCandidates) {
    const bg = getComputedStyle(el).backgroundImage;
    const match = /url\(["']?([^"')]+)["']?\)/.exec(bg || '');
    if (match && !looksLikeVideo(match[1])) return match[1];
  }

  return null;
}

// Fallback for when no real thumbnail can be found (or its download fails
// server-side): the site's favicon. Checked separately from the main
// thumbnail chain since the app treats favicons differently — cached once
// per domain and reused, rather than downloaded fresh per bookmark.
function extractFavicon() {
  const link = document.querySelector(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );
  if (link && link.href) return link.href;
  try {
    return new URL('/favicon.ico', location.origin).href;
  } catch {
    return null;
  }
}

async function getPageThumbnail(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractPageThumbnail });
    console.log(LOG, 'page-scanned thumbnail:', result);
    return result || null;
  } catch (err) {
    console.warn(LOG, 'getPageThumbnail failed:', err.message);
    return null;
  }
}

async function getFavicon(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, func: extractFavicon });
    console.log(LOG, 'page favicon:', result);
    return result || null;
  } catch (err) {
    console.warn(LOG, 'getFavicon failed:', err.message);
    return null;
  }
}

async function promptInPage(tabId, message) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg) => window.prompt(msg),
      args: [message]
    });
    return result;
  } catch (err) {
    console.warn(LOG, 'promptInPage failed:', err.message);
    return null;
  }
}

// Raw POST with no notification side-effects — used directly by bulk saves
// (bookmarkAllTabs) which show one summary notification instead of one per
// item. Throws on failure; callers decide how to report that.
async function postBookmark(payload) {
  console.log(LOG, 'sending to Vault:', payload);
  const { token } = await chrome.storage.sync.get('token');
  const res = await fetch(BRIDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Vault-Token': token } : {}) },
    body: JSON.stringify(payload)
  });
  const json = await res.json().catch(() => null);
  console.log(LOG, 'bridge response:', res.status, json);
  if (!res.ok) throw new Error(`Bridge responded ${res.status}: ${json && json.error}`);
  if (payload.folder_id != null && json && json.item && json.item.folder_id !== payload.folder_id) {
    console.warn(LOG, 'requested folder_id', payload.folder_id, 'but saved item has folder_id', json.item.folder_id, '— the folder id may no longer exist in the app.');
  }
  return json;
}

async function sendToVault(payload) {
  try {
    await postBookmark(payload);
    notify('Saved to Vault', payload.title || payload.url);
    rebuildFolderSubmenu(true); // counts changed; force-refresh next time
  } catch (err) {
    console.error(LOG, 'save failed:', err.message);
    notify('Vault app not running', 'Open the Vault desktop app and try again.');
  }
}

// Resolves (creating if needed) a top-level folder with the given name,
// reusing it across repeated invocations rather than making a new one
// every time.
async function resolveNamedFolder(name) {
  const { token } = await chrome.storage.sync.get('token');
  const authHeaders = token ? { 'X-Vault-Token': token } : {};

  const listRes = await fetch(FOLDERS_URL, { headers: authHeaders });
  if (listRes.ok) {
    const { folders = [] } = await listRes.json();
    const existing = folders.find((f) => f.parent_id == null && f.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      console.log(LOG, `reusing existing "${name}" folder, id`, existing.id);
      return existing.id;
    }
  }

  const createRes = await fetch('http://127.0.0.1:47564/api/folders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ name })
  });
  const created = await createRes.json().catch(() => null);
  if (!createRes.ok) throw new Error((created && created.error) || `status ${createRes.status}`);
  console.log(LOG, `created new "${name}" folder, id`, created.folder.id);
  return created.folder.id;
}

// Bookmarks every normal http(s) tab in the current window into a single
// (reused-if-it-already-exists) top-level folder. Triggered either by the
// toolbar icon or the "Bookmark all tabs" context menu item.
async function bookmarkAllTabs() {
  const FOLDER_NAME = 'Gooner Collect';
  console.log(LOG, 'bookmarking all tabs in window as', FOLDER_NAME);

  let folderId;
  try {
    folderId = await resolveNamedFolder(FOLDER_NAME);
  } catch (err) {
    console.error(LOG, 'could not resolve folder:', err.message);
    notify('Vault app not running', 'Open the Vault desktop app and try again.');
    return;
  }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const eligible = tabs.filter((t) => /^https?:\/\//.test(t.url || ''));
  console.log(LOG, 'found', eligible.length, 'eligible tab(s) out of', tabs.length, 'total');

  if (eligible.length === 0) {
    notify('Vault', 'No bookmarkable tabs in this window.');
    return;
  }
  notify('Vault', `Saving ${eligible.length} tab(s) to "${FOLDER_NAME}"…`);

  let saved = 0;
  let failed = 0;
  for (const tab of eligible) {
    try {
      const source = (() => { try { return new URL(tab.url).hostname; } catch { return ''; } })();
      const [thumbnail, favicon] = await Promise.all([getPageThumbnail(tab.id), getFavicon(tab.id)]);
      await postBookmark({ url: tab.url, title: tab.title, thumbnail, favicon, source, folder_id: folderId });
      saved++;
    } catch (err) {
      console.error(LOG, 'failed to save tab', tab.url, '-', err.message);
      failed++;
    }
  }

  console.log(LOG, 'bulk save complete:', saved, 'saved,', failed, 'failed');
  notify('Vault', `Saved ${saved} tab(s) to "${FOLDER_NAME}"${failed ? `, ${failed} failed` : ''}.`);
  rebuildFolderSubmenu(true);
}

function notify(title, message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title, message: message || '' });
}

async function targetFromInfo(info, tab) {
  const source = (() => { try { return new URL(tab.url).hostname; } catch { return ''; } })();
  const favicon = await getFavicon(tab.id);

  if (info.mediaType === 'image' && info.srcUrl) {
    return { url: tab.url, title: tab.title, thumbnail: info.srcUrl, favicon, source };
  }
  if (info.linkUrl) {
    return { url: info.linkUrl, title: tab.title, thumbnail: null, favicon, source };
  }
  const thumbnail = await getPageThumbnail(tab.id);
  return { url: tab.url, title: tab.title, thumbnail, favicon, source };
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  const id = info.menuItemId;
  console.log(LOG, 'menu item clicked:', id, '| mediaType:', info.mediaType, '| srcUrl:', info.srcUrl, '| linkUrl:', info.linkUrl);
  const source = (() => { try { return new URL(tab.url).hostname; } catch { return ''; } })();

  if (id === 'vault-page') {
    const [thumbnail, favicon] = await Promise.all([getPageThumbnail(tab.id), getFavicon(tab.id)]);
    return sendToVault({ url: tab.url, title: tab.title, thumbnail, favicon, source });
  }
  if (id === 'vault-image') {
    const favicon = await getFavicon(tab.id);
    return sendToVault({ url: tab.url, title: tab.title, thumbnail: info.srcUrl, favicon, source });
  }
  if (id === 'vault-link') {
    const [thumbnail, favicon] = await Promise.all([getPageThumbnail(tab.id), getFavicon(tab.id)]);
    return sendToVault({ url: info.linkUrl, title: tab.title, thumbnail, favicon, source });
  }

  if (id === REFRESH_ITEM_ID) {
    console.log(LOG, 'manual folder refresh requested');
    await rebuildFolderSubmenu(true);
    notify('Vault', 'Folder list refreshed — open the menu again to see it.');
    return;
  }

  if (id === BULK_SAVE_ID) {
    return bookmarkAllTabs();
  }

  if (id === NEW_FOLDER_ID) {
    const name = await promptInPage(tab.id, 'New Vault folder name:');
    if (!name || !name.trim()) return;
    try {
      const { token } = await chrome.storage.sync.get('token');
      const res = await fetch('http://127.0.0.1:47564/api/folders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Vault-Token': token } : {}) },
        body: JSON.stringify({ name: name.trim() })
      });
      const json = await res.json().catch(() => null);
      console.log(LOG, 'folder create response:', res.status, json);
      if (!res.ok) throw new Error((json && json.error) || `status ${res.status}`);
      await rebuildFolderSubmenu(true);
      notify('Folder created', name.trim());
    } catch (err) {
      console.error(LOG, 'folder creation failed:', err.message);
      notify('Vault app not running', 'Open the Vault desktop app and try again.');
    }
    return;
  }

  if (id === NONE_FOLDER_ID || String(id).startsWith(FOLDER_PREFIX)) {
    const folderId = id === NONE_FOLDER_ID ? null : Number(String(id).slice(FOLDER_PREFIX.length));
    const target = await targetFromInfo(info, tab);
    return sendToVault({ ...target, folder_id: folderId });
  }
});

// One-click convenience: clicking the toolbar icon itself also triggers
// the bulk save (no popup is declared in the manifest, so this fires
// instead of opening one).
chrome.action.onClicked.addListener(() => {
  console.log(LOG, 'toolbar icon clicked');
  // Must return the promise (not just fire-and-forget) so Chrome keeps the
  // service worker alive until the whole bulk save actually finishes.
  return bookmarkAllTabs();
});
