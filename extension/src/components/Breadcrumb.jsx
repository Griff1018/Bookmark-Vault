import React from 'react';

export default function Breadcrumb({ path, onNavigate }) {
  if (path.length === 0) return null;
  return (
    <div className="breadcrumb">
      <span className="breadcrumb-link" onClick={() => onNavigate(null)}>Home</span>
      {path.map((f, i) => (
        <React.Fragment key={f.id}>
          <span className="breadcrumb-sep">/</span>
          {i === path.length - 1 ? (
            <span className="breadcrumb-current">{f.name}</span>
          ) : (
            <span className="breadcrumb-link" onClick={() => onNavigate(f.id)}>{f.name}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
