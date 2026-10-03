import React, { useEffect } from 'react';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div className="toast" key={message}>
      {message}
    </div>
  );
}
