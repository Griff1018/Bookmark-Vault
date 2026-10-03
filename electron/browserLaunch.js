const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Maps a browser executable's name to its private-browsing flag. Kept as a
// pure function so it's testable without touching the filesystem.
function incognitoFlagFor(execPath) {
  const name = path.basename(execPath).toLowerCase();
  if (name.includes('msedge') || name.includes('edge')) return '--inprivate';
  if (name.includes('firefox')) return '--private-window';
  return '--incognito'; // Chrome, Brave, Chromium, Vivaldi (Chromium-based) all use this
}

// Candidate (name, path) pairs to check, in priority order, per platform.
// Windows/macOS paths are checked with fs.existsSync before ever being
// tried; Linux entries are bare command names resolved via PATH at spawn
// time, since there's no single standard install location to check.
function candidatePaths() {
  const home = os.homedir();
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env['LocalAppData'] || path.join(home, 'AppData', 'Local');

  if (process.platform === 'win32') {
    return [
      { name: 'Chrome', path: path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe') },
      { name: 'Chrome', path: path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe') },
      { name: 'Chrome', path: path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe') },
      { name: 'Edge', path: path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe') },
      { name: 'Edge', path: path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe') },
      { name: 'Brave', path: path.join(programFiles, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe') },
      { name: 'Brave', path: path.join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe') },
      { name: 'Firefox', path: path.join(programFiles, 'Mozilla Firefox\\firefox.exe') },
      { name: 'Firefox', path: path.join(programFilesX86, 'Mozilla Firefox\\firefox.exe') }
    ];
  }
  if (process.platform === 'darwin') {
    return [
      { name: 'Chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { name: 'Edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
      { name: 'Brave', path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
      { name: 'Firefox', path: '/Applications/Firefox.app/Contents/MacOS/firefox' }
    ];
  }
  // Linux: no fixed install path, rely on PATH lookup at spawn time
  return [
    { name: 'Chrome', path: 'google-chrome' },
    { name: 'Chrome', path: 'google-chrome-stable' },
    { name: 'Chromium', path: 'chromium-browser' },
    { name: 'Chromium', path: 'chromium' },
    { name: 'Edge', path: 'microsoft-edge' },
    { name: 'Brave', path: 'brave-browser' },
    { name: 'Firefox', path: 'firefox' }
  ];
}

// Returns the first browser to actually launch, given a list of candidates
// and a `checkExists` function — injected so this is testable with a fake
// filesystem instead of the real one.
function pickBrowser(candidates, checkExists) {
  for (const c of candidates) {
    // On Linux we can't cheaply verify a bare command name exists, so those
    // candidates are always "picked" (spawn will fail later if it's missing,
    // and the caller tries the next one).
    if (checkExists(c.path)) return c;
  }
  return null;
}

// Launches `url` in the given browser's private-browsing mode. Tries
// candidates in order, moving to the next one if spawning fails (e.g. a
// Windows path existed but the exe is somehow unlaunchable). Resolves with
// { ok: true, browser } on success, or { ok: false, error } if every
// candidate failed or none were found at all.
function launchIncognito(url, overridePath) {
  return new Promise((resolve) => {
    const platform = process.platform;
    const candidates = overridePath
      ? [{ name: 'Configured browser', path: overridePath }]
      : candidatePaths();

    const checkExists = (p) => {
      if (platform === 'linux' && !overridePath) return true; // can't pre-check PATH entries cheaply
      try { return fs.existsSync(p); } catch { return false; }
    };

    const toTry = overridePath ? candidates : candidates.filter((c) => checkExists(c.path));

    function tryNext(i) {
      if (i >= toTry.length) {
        resolve({ ok: false, error: 'No supported browser (Chrome, Edge, Brave, Firefox) was found.' });
        return;
      }
      const candidate = toTry[i];
      const flag = incognitoFlagFor(candidate.path);
      const child = spawn(candidate.path, [flag, url], { detached: true, stdio: 'ignore' });
      let settled = false;
      child.once('error', () => {
        if (settled) return;
        settled = true;
        tryNext(i + 1);
      });
      // spawn() doesn't confirm success synchronously; give it a tick to
      // fail before assuming it launched fine.
      setTimeout(() => {
        if (settled) return;
        settled = true;
        child.unref();
        resolve({ ok: true, browser: candidate.name });
      }, 150);
    }

    tryNext(0);
  });
}

module.exports = { incognitoFlagFor, candidatePaths, pickBrowser, launchIncognito };
