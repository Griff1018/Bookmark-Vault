import React, { useCallback, useRef } from 'react';

export default function ResizeHandle({ side, onResize }) {
  const dragging = useRef(false);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(ev) {
      if (!dragging.current) return;
      onResize(ev.clientX);
    }

    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [onResize]);

  return (
    <div
      className={`resize-handle resize-handle--${side}`}
      onMouseDown={onMouseDown}
    />
  );
}
