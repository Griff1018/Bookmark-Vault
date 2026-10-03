import React, { useEffect, useRef, useState } from 'react';

// A single context menu instance. `items` is an array of:
//  { label, onClick, checked?, danger?, separator?, submenu?: [...] }
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x, y });
  const [openSubmenu, setOpenSubmenu] = useState(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    // Keep the menu on-screen if it was opened near an edge.
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const overflowX = rect.right - window.innerWidth;
    const overflowY = rect.bottom - window.innerHeight;
    setPos({
      x: overflowX > 0 ? x - overflowX - 8 : x,
      y: overflowY > 0 ? y - overflowY - 8 : y
    });
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div className="context-menu-sep" key={i} />
        ) : (
          <div
            key={i}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            onMouseEnter={() => setOpenSubmenu(item.submenu ? i : null)}
            onClick={() => {
              if (item.submenu) return;
              item.onClick && item.onClick();
              onClose();
            }}
          >
            <span className="context-menu-check">{item.checked ? '✓' : ''}</span>
            <span className="context-menu-label">{item.label}</span>
            {item.submenu && <span className="context-menu-caret">›</span>}
            {item.submenu && openSubmenu === i && (
              <div className="context-submenu">
                {item.submenu}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
