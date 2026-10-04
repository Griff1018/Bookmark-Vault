import React, { useState, useEffect } from 'react';

// swatch = [paper, ink]
const THEMES = [
  { id: 'blueprint', label: 'Blueprint', swatch: ['#f6f6f8', '#1f2bff'] },
  { id: 'blueprint-dark', label: 'Blueprint Dark', swatch: ['#0e0e10', '#4d6bff'] },
  { id: 'white', label: 'White', swatch: ['#ffffff', '#111111'] },
  { id: 'black', label: 'Black', swatch: ['#000000', '#f2f2f2'] }
];

const VIEWS = [
  { id: 'large', label: 'Waterfall' },
  { id: 'rows', label: 'Tiled' },
  { id: 'small', label: 'Grid' },
  { id: 'list', label: 'List' },
  { id: 'details', label: 'Details' }
];

function Switch({ on, onChange }) {
  return <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export default function SettingsPanel({
  onClose, theme, onTheme, showGrid, onShowGrid, view, onView, cardSize, onCardSize, onRetryAllThumbnails
}) {
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
        <div className="settings-head">
          <h3 className="settings-title">Settings</h3>
          <button className="btn detail-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <section className="settings-section">
          <h4>Appearance</h4>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button key={t.id} className={`theme-card ${theme === t.id ? 'active' : ''}`} onClick={() => onTheme(t.id)}>
                <span className="theme-swatch" style={{ background: t.swatch[0] }}>
                  <span />
                  <i style={{ background: t.swatch[1] }} />
                </span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <b>Dotted paper background</b>
              <span>The faint dot grid and column band behind the gallery.</span>
            </div>
            <Switch on={showGrid} onChange={onShowGrid} />
          </div>
        </section>

        <section className="settings-section">
          <h4>Gallery</h4>
          <div className="settings-row">
            <div className="settings-row-label">
              <b>Default view</b>
              <span>Layout used for the bookmark gallery.</span>
            </div>
            <div className="seg">
              {VIEWS.map((v) => (
                <button key={v.id} className={view === v.id ? 'active' : ''} onClick={() => onView(v.id)}>{v.label}</button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">
              <b>Thumbnail size</b>
              <span>Column width for Waterfall / Grid, row height for Tiled.</span>
            </div>
            <div className="settings-range">
              <input type="range" min="120" max="400" step="10" value={cardSize} onChange={(e) => onCardSize(Number(e.target.value))} />
              <span className="mono-val">{cardSize}px</span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h4>Thumbnails</h4>
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
          <div className="settings-row">
            <div className="settings-row-label">
              <b>Load failed thumbnails</b>
              <span>Retry every bookmark that still shows an icon instead of an image, across all folders.</span>
            </div>
            <button className="btn" onClick={onRetryAllThumbnails}>Run now</button>
          </div>
        </section>

        <section className="settings-section">
          <h4>Browser</h4>
          <div className="settings-field">
            <div className="field-label">Browser for "Open in Incognito" (optional)</div>
            <input
              type="text"
              className="settings-text"
              placeholder="Auto-detects Chrome / Edge / Brave / Firefox — leave blank unless it picks the wrong one"
              value={browserPath}
              disabled={loading}
              onChange={(e) => setBrowserPath(e.target.value)}
            />
            <p className="settings-hint">
              Full path to a browser executable, e.g.{' '}
              <code>C:\Program Files\Google\Chrome\Application\chrome.exe</code>.
              Only needed if auto-detection fails or finds the wrong browser.
            </p>
          </div>
        </section>

        <div className="settings-foot">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={handleSave} disabled={loading}>
            {saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
