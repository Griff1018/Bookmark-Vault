import React, { useState, useEffect } from 'react';

export default function SettingsPanel({ onClose }) {
  const [limitKB, setLimitKB] = useState('300');
  const [browserPath, setBrowserPath] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      window.vault.getSetting('thumbnailLimitKB', 300),
      window.vault.getSetting('incognitoBrowserPath', '')
    ]).then(([limit, path]) => {
      setLimitKB(String(limit));
      setBrowserPath(path || '');
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    const n = Math.max(0, Math.floor(Number(limitKB) || 0));
    await Promise.all([
      window.vault.setSetting('thumbnailLimitKB', n),
      window.vault.setSetting('incognitoBrowserPath', browserPath.trim())
    ]);
    setLimitKB(String(n));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <button className="btn close-btn" onClick={onClose}>✕</button>
        <h3 className="settings-title">Settings</h3>

        <div className="settings-field">
          <div className="field-label">Compress thumbnails over</div>
          <div className="settings-input-row">
            <input
              type="number"
              min="0"
              step="10"
              value={limitKB}
              disabled={loading}
              onChange={(e) => setLimitKB(e.target.value)}
            />
            <span className="settings-unit">KB</span>
          </div>
          <p className="settings-hint">
            New bookmarks with a thumbnail larger than this are re-encoded as JPEG
            at progressively lower quality (and, if needed, smaller dimensions)
            until they fit. Set to <strong>0</strong> to disable compression
            entirely. This only affects bookmarks saved from now on — existing
            thumbnails aren't touched.
          </p>
        </div>

        <div className="settings-field">
          <div className="field-label">Browser for "Open in Incognito" (optional)</div>
          <input
            type="text"
            placeholder="Auto-detects Chrome / Edge / Brave / Firefox — leave blank unless it picks the wrong one"
            value={browserPath}
            disabled={loading}
            onChange={(e) => setBrowserPath(e.target.value)}
            style={{ width: '100%' }}
          />
          <p className="settings-hint">
            Full path to a browser executable, e.g.{' '}
            <code>C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe</code>.
            Only needed if auto-detection fails or finds the wrong browser.
          </p>
        </div>

        <div className="detail-actions">
          <button className="btn primary" onClick={handleSave} disabled={loading}>
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
